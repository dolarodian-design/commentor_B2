import { supabase } from './supabase';
import { JiraService, getJiraService } from './jira';

export interface SyncResult {
  success: boolean;
  issueKey?: string;
  error?: string;
}

export class JiraSyncEngine {
  private workspaceId: string;
  private jiraService: JiraService | null = null;

  constructor(workspaceId: string) {
    this.workspaceId = workspaceId;
  }

  async initialize(): Promise<boolean> {
    this.jiraService = await getJiraService(this.workspaceId);
    return this.jiraService !== null;
  }

  async syncThreadToJira(threadId: string): Promise<SyncResult> {
    if (!this.jiraService) {
      return { success: false, error: 'Jira service not initialized' };
    }

    try {
      const thread = await this.getThreadWithComments(threadId);
      if (!thread) {
        return { success: false, error: 'Thread not found' };
      }

      const existingSync = await this.getExistingSync(threadId);

      if (existingSync && existingSync.external_id) {
        await this.updateJiraIssue(existingSync.external_id, thread);
        return { success: true, issueKey: existingSync.external_id };
      } else {
        const issueKey = await this.createJiraIssue(thread);
        await this.recordSync(threadId, issueKey);
        return { success: true, issueKey };
      }
    } catch (error: any) {
      console.error('Error syncing to Jira:', error);
      return { success: false, error: error.message };
    }
  }

  async syncJiraToThread(issueKey: string, threadId: string): Promise<SyncResult> {
    if (!this.jiraService) {
      return { success: false, error: 'Jira service not initialized' };
    }

    try {
      const issue = await this.jiraService.getIssue(issueKey);
      const jiraComments = await this.jiraService.getComments(issueKey);

      await this.updateThreadFromJira(threadId, issue);
      await this.syncCommentsFromJira(threadId, jiraComments);

      return { success: true, issueKey };
    } catch (error: any) {
      console.error('Error syncing from Jira:', error);
      return { success: false, error: error.message };
    }
  }

  private async getThreadWithComments(threadId: string): Promise<any> {
    const { data: thread, error: threadError } = await supabase
      .from('threads')
      .select(`
        *,
        app:apps(name, base_url),
        comments(
          id,
          content,
          comment_type,
          created_at,
          author:profiles(full_name, email)
        )
      `)
      .eq('id', threadId)
      .single();

    if (threadError) throw threadError;
    return thread;
  }

  private async getExistingSync(threadId: string): Promise<any> {
    const { data: comments } = await supabase
      .from('comments')
      .select('id')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!comments || comments.length === 0) return null;

    const { data, error } = await supabase
      .from('integration_syncs')
      .select('*')
      .eq('comment_id', comments[0].id)
      .eq('sync_direction', 'outbound')
      .maybeSingle();

    if (error) {
      console.error('Error fetching existing sync:', error);
      return null;
    }

    return data;
  }

  private async createJiraIssue(thread: any): Promise<string> {
    if (!this.jiraService) throw new Error('Jira service not initialized');

    const { data: config } = await supabase
      .from('integration_configs')
      .select('jira_project_key')
      .eq('workspace_id', this.workspaceId)
      .eq('integration_type', 'jira')
      .single();

    if (!config?.jira_project_key) {
      throw new Error('Jira project key not configured');
    }

    const firstComment = thread.comments?.[0];
    const summary = `[CommentSync] ${thread.app?.name || 'App'} - ${thread.page_url}`;
    const description = this.buildIssueDescription(thread, firstComment);

    const issue = await this.jiraService.createIssue(
      config.jira_project_key,
      summary,
      description,
      this.mapCommentTypeToIssueType(firstComment?.comment_type)
    );

    for (let i = 1; i < thread.comments.length; i++) {
      const comment = thread.comments[i];
      await this.jiraService.addComment(
        issue.key,
        `${comment.author?.full_name || 'User'}: ${comment.content}`
      );
    }

    return issue.key;
  }

  private async updateJiraIssue(issueKey: string, thread: any): Promise<void> {
    if (!this.jiraService) throw new Error('Jira service not initialized');

    const existingCommentIds = await this.getSyncedCommentIds(issueKey);
    const newComments = thread.comments.filter(
      (c: any) => !existingCommentIds.includes(c.id)
    );

    for (const comment of newComments) {
      await this.jiraService.addComment(
        issueKey,
        `${comment.author?.full_name || 'User'}: ${comment.content}`
      );
      await this.recordCommentSync(comment.id, issueKey);
    }
  }

  private async updateThreadFromJira(threadId: string, issue: any): Promise<void> {
    const newStatus = this.mapJiraStatusToThreadStatus(issue.fields.status.name);

    const { error } = await supabase
      .from('threads')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', threadId);

    if (error) {
      console.error('Error updating thread status:', error);
    }
  }

  private async syncCommentsFromJira(threadId: string, jiraComments: any[]): Promise<void> {
    const { data: existingComments } = await supabase
      .from('comments')
      .select('id, metadata')
      .eq('thread_id', threadId);

    const syncedJiraCommentIds = new Set(
      existingComments
        ?.filter(c => c.metadata?.jira_comment_id)
        .map(c => c.metadata.jira_comment_id) || []
    );

    for (const jiraComment of jiraComments) {
      if (syncedJiraCommentIds.has(jiraComment.id)) {
        continue;
      }

      const { data: systemUser } = await supabase
        .from('profiles')
        .select('id')
        .limit(1)
        .single();

      if (systemUser) {
        await supabase.from('comments').insert({
          thread_id: threadId,
          author_id: systemUser.id,
          content: `[From Jira] ${jiraComment.body?.content?.[0]?.content?.[0]?.text || 'Comment'}`,
          metadata: {
            jira_comment_id: jiraComment.id,
            jira_author: jiraComment.author?.displayName || 'Unknown'
          }
        });
      }
    }
  }

  private async recordSync(threadId: string, issueKey: string): Promise<void> {
    const { data: comments } = await supabase
      .from('comments')
      .select('id')
      .eq('thread_id', threadId)
      .order('created_at', { ascending: true })
      .limit(1);

    if (!comments || comments.length === 0) return;

    const { data: config } = await supabase
      .from('integration_configs')
      .select('id')
      .eq('workspace_id', this.workspaceId)
      .eq('integration_type', 'jira')
      .single();

    if (!config) return;

    await supabase.from('integration_syncs').insert({
      comment_id: comments[0].id,
      integration_config_id: config.id,
      external_id: issueKey,
      external_url: `https://${await this.getJiraDomain()}/browse/${issueKey}`,
      sync_status: 'synced',
      sync_direction: 'outbound'
    });
  }

  private async recordCommentSync(commentId: string, issueKey: string): Promise<void> {
    const { data: config } = await supabase
      .from('integration_configs')
      .select('id')
      .eq('workspace_id', this.workspaceId)
      .eq('integration_type', 'jira')
      .single();

    if (!config) return;

    await supabase.from('integration_syncs').insert({
      comment_id: commentId,
      integration_config_id: config.id,
      external_id: issueKey,
      sync_status: 'synced',
      sync_direction: 'outbound'
    });
  }

  private async getSyncedCommentIds(issueKey: string): Promise<string[]> {
    const { data } = await supabase
      .from('integration_syncs')
      .select('comment_id')
      .eq('external_id', issueKey);

    return data?.map(s => s.comment_id) || [];
  }

  private async getJiraDomain(): Promise<string> {
    const { data } = await supabase
      .from('integration_configs')
      .select('jira_domain')
      .eq('workspace_id', this.workspaceId)
      .eq('integration_type', 'jira')
      .single();

    return data?.jira_domain || '';
  }

  private buildIssueDescription(thread: any, firstComment: any): string {
    const lines = [
      `Feedback from CommentSync`,
      ``,
      `App: ${thread.app?.name || 'Unknown'}`,
      `Page: ${thread.page_url}`,
      `Location: x:${thread.position_data?.x || 0}, y:${thread.position_data?.y || 0}`,
      ``,
      `Initial Comment:`,
      firstComment?.content || 'No content',
      ``,
      `Posted by: ${firstComment?.author?.full_name || 'Anonymous'} (${firstComment?.author?.email || 'no email'})`,
    ];

    return lines.join('\n');
  }

  private mapCommentTypeToIssueType(commentType?: string): string {
    const mapping: Record<string, string> = {
      'bug': 'Bug',
      'suggestion': 'Task',
      'question': 'Task',
      'approved': 'Task',
      'general': 'Task'
    };

    return mapping[commentType || 'general'] || 'Task';
  }

  private mapJiraStatusToThreadStatus(jiraStatus: string): string {
    const lowerStatus = jiraStatus.toLowerCase();

    if (lowerStatus.includes('done') || lowerStatus.includes('resolved') || lowerStatus.includes('closed')) {
      return 'resolved';
    }

    return 'open';
  }
}

export async function syncThreadToJira(workspaceId: string, threadId: string): Promise<SyncResult> {
  const engine = new JiraSyncEngine(workspaceId);
  const initialized = await engine.initialize();

  if (!initialized) {
    return { success: false, error: 'Jira not configured for this workspace' };
  }

  return await engine.syncThreadToJira(threadId);
}

export async function syncJiraToThread(workspaceId: string, issueKey: string, threadId: string): Promise<SyncResult> {
  const engine = new JiraSyncEngine(workspaceId);
  const initialized = await engine.initialize();

  if (!initialized) {
    return { success: false, error: 'Jira not configured for this workspace' };
  }

  return await engine.syncJiraToThread(issueKey, threadId);
}
