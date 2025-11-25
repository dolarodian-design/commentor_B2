import { supabase } from './supabase';

export interface JiraCredentials {
  domain: string;
  email: string;
  apiToken: string;
  projectKey: string;
}

export interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    description: string;
    status: {
      name: string;
    };
    issuetype: {
      name: string;
    };
    created: string;
    updated: string;
  };
}

export interface JiraProject {
  id: string;
  key: string;
  name: string;
}

export class JiraService {
  private domain: string;
  private email: string;
  private apiToken: string;

  constructor(credentials: JiraCredentials) {
    this.domain = credentials.domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
    this.email = credentials.email;
    this.apiToken = credentials.apiToken;
  }

  private getAuthHeader(): string {
    return 'Basic ' + btoa(`${this.email}:${this.apiToken}`);
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `https://${this.domain}/rest/api/3${endpoint}`;

    const response = await fetch(url, {
      ...options,
      headers: {
        'Authorization': this.getAuthHeader(),
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Jira API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('/myself');
      return true;
    } catch (error) {
      console.error('Jira connection test failed:', error);
      return false;
    }
  }

  async getProjects(): Promise<JiraProject[]> {
    const data = await this.makeRequest('/project/search');
    return data.values || [];
  }

  async getProject(projectKey: string): Promise<JiraProject> {
    return await this.makeRequest(`/project/${projectKey}`);
  }

  async createIssue(projectKey: string, summary: string, description: string, issueType: string = 'Task'): Promise<JiraIssue> {
    const payload = {
      fields: {
        project: {
          key: projectKey
        },
        summary,
        description: {
          type: 'doc',
          version: 1,
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'text',
                  text: description
                }
              ]
            }
          ]
        },
        issuetype: {
          name: issueType
        }
      }
    };

    return await this.makeRequest('/issue', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async updateIssue(issueKey: string, summary?: string, description?: string): Promise<void> {
    const fields: any = {};

    if (summary) {
      fields.summary = summary;
    }

    if (description) {
      fields.description = {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: description
              }
            ]
          }
        ]
      };
    }

    await this.makeRequest(`/issue/${issueKey}`, {
      method: 'PUT',
      body: JSON.stringify({ fields })
    });
  }

  async getIssue(issueKey: string): Promise<JiraIssue> {
    return await this.makeRequest(`/issue/${issueKey}`);
  }

  async addComment(issueKey: string, comment: string): Promise<any> {
    const payload = {
      body: {
        type: 'doc',
        version: 1,
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: comment
              }
            ]
          }
        ]
      }
    };

    return await this.makeRequest(`/issue/${issueKey}/comment`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async getComments(issueKey: string): Promise<any[]> {
    const data = await this.makeRequest(`/issue/${issueKey}/comment`);
    return data.comments || [];
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    await this.makeRequest(`/issue/${issueKey}/transitions`, {
      method: 'POST',
      body: JSON.stringify({
        transition: {
          id: transitionId
        }
      })
    });
  }

  async getTransitions(issueKey: string): Promise<any[]> {
    const data = await this.makeRequest(`/issue/${issueKey}/transitions`);
    return data.transitions || [];
  }
}

export async function getJiraConfig(workspaceId: string): Promise<any | null> {
  const { data, error } = await supabase
    .from('integration_configs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('integration_type', 'jira')
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching Jira config:', error);
    return null;
  }

  return data;
}

export async function createOrUpdateJiraConfig(
  workspaceId: string,
  credentials: JiraCredentials,
  autoSync: boolean = false
): Promise<void> {
  const existingConfig = await getJiraConfig(workspaceId);

  const configData = {
    workspace_id: workspaceId,
    integration_type: 'jira',
    jira_domain: credentials.domain,
    jira_email: credentials.email,
    jira_api_token: credentials.apiToken,
    jira_project_key: credentials.projectKey,
    auto_sync_enabled: autoSync,
    is_active: true,
    updated_at: new Date().toISOString()
  };

  if (existingConfig) {
    const { error } = await supabase
      .from('integration_configs')
      .update(configData)
      .eq('id', existingConfig.id);

    if (error) throw error;
  } else {
    const { error } = await supabase
      .from('integration_configs')
      .insert(configData);

    if (error) throw error;
  }
}

export async function getJiraService(workspaceId: string): Promise<JiraService | null> {
  const config = await getJiraConfig(workspaceId);

  if (!config || !config.jira_domain || !config.jira_email || !config.jira_api_token) {
    return null;
  }

  return new JiraService({
    domain: config.jira_domain,
    email: config.jira_email,
    apiToken: config.jira_api_token,
    projectKey: config.jira_project_key
  });
}
