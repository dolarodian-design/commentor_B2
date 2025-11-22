import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  MessageSquare,
  X,
  Send,
  Paperclip,
  ChevronRight,
  ChevronLeft,
  MoreVertical,
  Share2,
  UserPlus,
  Mail,
  ExternalLink,
  Trash2,
  CheckCircle,
  RefreshCw,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { syncThreadToJira } from '../lib/jiraSyncEngine';
import { uploadAttachment, formatFileSize, getFileIcon, isImageFile, type Attachment } from '../lib/attachments';
import type { Database } from '../lib/database.types';

type App = Database['public']['Tables']['apps']['Row'];
type Thread = Database['public']['Tables']['threads']['Row'];
type Comment = Database['public']['Tables']['comments']['Row'];

interface ThreadWithComments extends Thread {
  comments: (Comment & {
    author: {
      full_name: string | null;
      email: string;
    };
  })[];
}

interface CommentPin {
  threadId: string;
  x: number;
  y: number;
}

export function AppDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const [app, setApp] = useState<App | null>(null);
  const [threads, setThreads] = useState<ThreadWithComments[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [selectedThread, setSelectedThread] = useState<ThreadWithComments | null>(null);
  const [commentPins, setCommentPins] = useState<CommentPin[]>([]);
  const [replyText, setReplyText] = useState('');
  const [showCommentOverlay, setShowCommentOverlay] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [isCommentsSidebarCollapsed, setIsCommentsSidebarCollapsed] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingThread, setDeletingThread] = useState<ThreadWithComments | null>(null);
  const [syncingToJira, setSyncingToJira] = useState(false);
  const [jiraSyncStatus, setJiraSyncStatus] = useState<{threadId: string, issueKey: string} | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [selectedPageUrl, setSelectedPageUrl] = useState<string | null>(null);
  const [screenshotForPage, setScreenshotForPage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (id) {
      fetchAppDetails();
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;

    const threadsChannel = supabase
      .channel(`threads:${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'threads',
          filter: `app_id=eq.${id}`,
        },
        () => {
          fetchAppDetails();
        }
      )
      .subscribe();

    const commentsChannel = supabase
      .channel(`comments:${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'comments',
        },
        () => {
          fetchAppDetails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(threadsChannel);
      supabase.removeChannel(commentsChannel);
    };
  }, [id]);

  useEffect(() => {
    if (threads.length > 0) {
      const uniquePages = Array.from(new Set(threads.map(t => t.page_url)));
      if (!selectedPageUrl && uniquePages.length > 0) {
        setSelectedPageUrl(uniquePages[0]);
      }
    }
  }, [threads]);

  useEffect(() => {
    if (selectedPageUrl && threads.length > 0) {
      const pageThreads = threads.filter(t => t.page_url === selectedPageUrl);
      updateCommentPins(pageThreads);

      const threadWithScreenshot = pageThreads.find(t => {
        const firstComment = t.comments[0];
        if (!firstComment?.metadata) return false;
        const metadata = typeof firstComment.metadata === 'string'
          ? JSON.parse(firstComment.metadata)
          : firstComment.metadata;
        return metadata && 'screenshot' in metadata;
      });

      if (threadWithScreenshot) {
        const firstComment = threadWithScreenshot.comments[0];
        const metadata = typeof firstComment.metadata === 'string'
          ? JSON.parse(firstComment.metadata)
          : firstComment.metadata;
        setScreenshotForPage(metadata?.screenshot || null);
      } else {
        setScreenshotForPage(null);
      }
    }
  }, [selectedPageUrl, threads]);

  const updateCommentPins = (threadsData: ThreadWithComments[]) => {
    const pins: CommentPin[] = threadsData
      .filter(thread => thread.position_data)
      .map(thread => {
        const pos = typeof thread.position_data === 'string'
          ? JSON.parse(thread.position_data)
          : thread.position_data;
        return {
          threadId: thread.id,
          x: pos.x || 0,
          y: pos.y || 0,
        };
      });
    setCommentPins(pins);
  };

  const fetchAppDetails = async () => {
    if (!id) return;

    const { data: appData } = await supabase
      .from('apps')
      .select('*')
      .eq('id', id)
      .single();

    if (!appData) {
      navigate('/dashboard/apps');
      return;
    }

    setApp(appData);

    const { data: threadsData } = await supabase
      .from('threads')
      .select(`
        *,
        comments(
          *,
          author:profiles!comments_author_id_fkey(full_name, email)
        )
      `)
      .eq('app_id', id)
      .order('created_at', { ascending: false });

    if (threadsData) {
      setThreads(threadsData as any);
    }

    setLoading(false);
  };

  const shareUrl = app
    ? `${window.location.origin}/review/${app.id}`
    : '';

  const copyShareUrl = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInviteTester = async () => {
    if (!inviteEmail.trim() || !id || !user) return;

    setInviteSending(true);
    try {
      const email = inviteEmail.toLowerCase().trim();

      const { data: inviteeProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      if (!inviteeProfile) {
        alert('User not found. They need to sign up first.');
        setInviteSending(false);
        return;
      }

      const { error } = await supabase.from('app_collaborators').insert({
        app_id: id,
        user_id: inviteeProfile.id,
        access_level: 'commenter',
        invited_by: user.id,
      });

      if (error) {
        console.error('Invitation error:', error);
        alert('Failed to send invitation. Please try again.');
        return;
      }

      alert(`${email} added as a collaborator`);
      setInviteEmail('');
      setShowInviteModal(false);
    } catch (error) {
      console.error('Error sending invitation:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setInviteSending(false);
    }
  };

  const handleThreadClick = (thread: ThreadWithComments) => {
    setSelectedThread(thread);
    setShowCommentOverlay(true);
  };

  const closeCommentOverlay = () => {
    setShowCommentOverlay(false);
    setTimeout(() => setSelectedThread(null), 300);
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || !user) return;

    setUploadingFiles(true);
    try {
      const uploadedFiles: Attachment[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const attachment = await uploadAttachment(file, user.id);
        if (attachment) {
          uploadedFiles.push(attachment);
        }
      }

      setAttachments([...attachments, ...uploadedFiles]);
    } catch (error) {
      console.error('Error uploading files:', error);
      alert('Failed to upload files. Please try again.');
    } finally {
      setUploadingFiles(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setAttachments(attachments.filter(a => a.id !== attachmentId));
  };

  const handleSendReply = async () => {
    if ((!replyText.trim() && attachments.length === 0) || !selectedThread || !user) return;

    try {
      const { error } = await supabase.from('comments').insert({
        thread_id: selectedThread.id,
        author_id: user.id,
        content: replyText || '(Attachment)',
        attachments: attachments,
      });

      if (error) throw error;

      setReplyText('');
      setAttachments([]);
      await fetchAppDetails();

      const { data: updatedThread } = await supabase
        .from('threads')
        .select(`
          *,
          comments(
            *,
            author:profiles!comments_author_id_fkey(full_name, email)
          )
        `)
        .eq('id', selectedThread.id)
        .single();

      if (updatedThread) {
        setSelectedThread(updatedThread as any);
      }
    } catch (error) {
      console.error('Error sending reply:', error);
    }
  };

  const handleToggleResolve = async (thread: ThreadWithComments) => {
    try {
      const newStatus = thread.status === 'resolved' ? 'open' : 'resolved';
      const { error } = await supabase
        .from('threads')
        .update({ status: newStatus })
        .eq('id', thread.id);

      if (error) throw error;

      await fetchAppDetails();
      if (selectedThread?.id === thread.id) {
        setSelectedThread({ ...thread, status: newStatus });
      }
    } catch (error) {
      console.error('Error toggling thread status:', error);
    }
  };

  const handleDeleteThread = async () => {
    if (!deletingThread) return;

    try {
      const { error } = await supabase
        .from('threads')
        .delete()
        .eq('id', deletingThread.id);

      if (error) throw error;

      await fetchAppDetails();
      if (selectedThread?.id === deletingThread.id) {
        setShowCommentOverlay(false);
        setSelectedThread(null);
      }
      setShowDeleteModal(false);
      setDeletingThread(null);
    } catch (error) {
      console.error('Error deleting thread:', error);
    }
  };

  const handleSyncToJira = async (thread: ThreadWithComments) => {
    if (!currentWorkspace?.id) {
      alert('No workspace selected');
      return;
    }

    setSyncingToJira(true);

    try {
      const result = await syncThreadToJira(currentWorkspace.id, thread.id);

      if (result.success && result.issueKey) {
        setJiraSyncStatus({ threadId: thread.id, issueKey: result.issueKey });
        alert(`Successfully synced to Jira: ${result.issueKey}`);
      } else {
        alert(`Failed to sync: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error syncing to Jira:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setSyncingToJira(false);
    }
  };

  const getAuthorInitials = (author: { full_name: string | null; email: string }) => {
    return author.full_name?.[0] || author.email[0].toUpperCase();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!app) {
    return null;
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <header className="flex items-center justify-between px-6 py-2 bg-white/5 backdrop-blur-xl border-b border-white/10 flex-shrink-0 shadow-lg">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard/apps')}
            className="flex items-center gap-2 text-slate-300 hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Apps</span>
          </button>
          <div className="h-4 w-px bg-white/20" />
          <h1 className="text-base font-semibold text-white">{app.name}</h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/10 backdrop-blur-md text-slate-200 rounded-lg hover:bg-white/20 transition text-sm border border-white/10"
          >
            <UserPlus className="w-4 h-4" />
            <span>Invite</span>
          </button>

          <button
            onClick={copyShareUrl}
            className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/30 backdrop-blur-md text-blue-100 rounded-lg hover:bg-blue-500/40 transition text-sm border border-blue-400/30"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>Share URL</span>
              </>
            )}
          </button>
        </div>
      </header>

      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                  <Mail className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Invite Tester</h3>
                  <p className="text-sm text-slate-400">Send review invitation</p>
                </div>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-2 hover:bg-slate-700 rounded-lg transition"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Tester Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !inviteSending) {
                      handleInviteTester();
                    }
                  }}
                  placeholder="tester@example.com"
                  autoFocus
                  className="w-full px-4 py-3 bg-slate-700 text-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
              </div>

              <div className="bg-slate-700/50 rounded-lg p-4">
                <p className="text-xs text-slate-400 leading-relaxed">
                  The tester will receive an invitation and can access the review page. They'll need to log in to start testing.
                </p>
              </div>
            </div>

            <div className="flex gap-3 p-6 border-t border-slate-700">
              <button
                onClick={() => setShowInviteModal(false)}
                className="flex-1 px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition"
              >
                Cancel
              </button>
              <button
                onClick={handleInviteTester}
                disabled={!inviteEmail.trim() || inviteSending}
                className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition flex items-center justify-center gap-2"
              >
                <Mail className="w-4 h-4" />
                <span className="font-medium">{inviteSending ? 'Sending...' : 'Send Invitation'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 bg-slate-900 overflow-hidden flex flex-col">
          {threads.length > 0 && (
            <div className="bg-slate-800/50 border-b border-slate-700 px-4 py-3 flex items-center gap-3 overflow-x-auto">
              <span className="text-xs text-slate-400 whitespace-nowrap font-medium">Pages with Feedback:</span>
              {Array.from(new Set(threads.map(t => t.page_url))).map((pageUrl) => {
                const pageThreads = threads.filter(t => t.page_url === pageUrl);
                const url = new URL(pageUrl);
                const displayPath = url.pathname === '/' ? url.hostname : url.pathname;
                const pageTitle = pageThreads[0]?.comments[0]?.metadata
                  ? (typeof pageThreads[0].comments[0].metadata === 'string'
                      ? JSON.parse(pageThreads[0].comments[0].metadata).page_title
                      : pageThreads[0].comments[0].metadata.page_title)
                  : null;

                return (
                  <button
                    key={pageUrl}
                    onClick={() => setSelectedPageUrl(pageUrl)}
                    className={`px-3 py-2 rounded-lg text-xs font-medium transition whitespace-nowrap flex items-center gap-2 ${
                      selectedPageUrl === pageUrl
                        ? 'bg-blue-600 text-white shadow-lg'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                    title={pageUrl}
                  >
                    <span>{pageTitle || displayPath}</span>
                    <span className={`px-1.5 py-0.5 rounded text-xs font-bold ${
                      selectedPageUrl === pageUrl
                        ? 'bg-white/20'
                        : 'bg-slate-600'
                    }`}>
                      {pageThreads.length}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex-1 overflow-auto relative bg-slate-900">
            {threads.length > 0 && selectedPageUrl ? (
              screenshotForPage ? (
                <div className="relative inline-block min-w-full">
                  <img
                    src={screenshotForPage}
                    alt="Page screenshot"
                    className="w-full h-auto shadow-2xl"
                  />

                  {commentPins.map((pin) => {
                    const thread = threads.find(t => t.id === pin.threadId);
                    if (!thread) return null;
                    const isSelected = selectedThread?.id === thread.id && showCommentOverlay;

                    return (
                      <button
                        key={pin.threadId}
                        onClick={() => handleThreadClick(thread)}
                        className={`absolute w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-xl transition-all hover:scale-110 border-2 border-white ${
                          isSelected
                            ? 'bg-blue-600 scale-110 ring-4 ring-blue-300'
                            : thread.status === 'resolved'
                            ? 'bg-green-500 hover:bg-green-600'
                            : 'bg-red-500 hover:bg-red-600'
                        }`}
                        style={{
                          left: `${pin.x}px`,
                          top: `${pin.y}px`,
                          transform: 'translate(-50%, -50%)'
                        }}
                        title={`${thread.comments.length} comment${thread.comments.length !== 1 ? 's' : ''} - ${thread.status}`}
                      >
                        {thread.comments.length}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-400">
                  <div className="text-center max-w-md px-4">
                    <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-full flex items-center justify-center">
                      <MessageSquare className="w-8 h-8 text-slate-600" />
                    </div>
                    <p className="text-lg font-medium text-slate-300 mb-2">Screenshot Not Available</p>
                    <p className="text-sm text-slate-500">
                      This page has comments but no screenshot was captured. The comments are still available in the sidebar.
                    </p>
                  </div>
                </div>
              )
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                <div className="text-center max-w-md px-4">
                  <div className="w-20 h-20 mx-auto mb-6 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-full flex items-center justify-center">
                    <MessageSquare className="w-10 h-10 text-blue-500/50" />
                  </div>
                  <p className="text-xl font-semibold text-slate-300 mb-3">No Feedback Yet</p>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Share the review URL with your testers to start collecting feedback. Comments will appear here with screenshots showing exactly where issues were found.
                  </p>
                </div>
              </div>
            )}
          </div>

          {showCommentOverlay && selectedThread && (
                  <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200">
                    <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                      <div className="flex items-center justify-between p-6 border-b border-slate-700">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            selectedThread.status === 'resolved' ? 'bg-green-500' : 'bg-amber-500'
                          }`} />
                          <div>
                            <h3 className="text-lg font-semibold text-white">Comment Thread</h3>
                            <p className="text-xs text-slate-400 truncate max-w-md">
                              {selectedThread.page_url}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleSyncToJira(selectedThread)}
                            disabled={syncingToJira}
                            className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Sync to Jira"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${syncingToJira ? 'animate-spin' : ''}`} />
                            {syncingToJira ? 'Syncing...' : 'Sync to Jira'}
                          </button>
                          <button
                            onClick={() => handleToggleResolve(selectedThread)}
                            className={`flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                              selectedThread.status === 'resolved'
                                ? 'bg-green-500/20 text-green-300 hover:bg-green-500/30'
                                : 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                            }`}
                            title={selectedThread.status === 'resolved' ? 'Reopen thread' : 'Mark as resolved'}
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            {selectedThread.status === 'resolved' ? 'Resolved' : 'Open'}
                          </button>
                          <button
                            onClick={() => {
                              setDeletingThread(selectedThread);
                              setShowDeleteModal(true);
                            }}
                            className="p-2 hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition"
                            title="Delete thread"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={closeCommentOverlay}
                            className="p-2 hover:bg-slate-700 rounded-lg transition"
                          >
                            <X className="w-5 h-5 text-slate-400" />
                          </button>
                        </div>
                      </div>

                      <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {selectedThread.comments.map((comment, index) => (
                          <div key={comment.id} className="flex gap-3">
                            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                              <span className="text-sm font-semibold text-white">
                                {getAuthorInitials(comment.author)}
                              </span>
                            </div>
                            <div className="flex-1">
                              <div className="bg-slate-700 rounded-2xl p-4 shadow-lg">
                                <div className="flex items-start justify-between mb-2">
                                  <div>
                                    <p className="text-sm font-semibold text-white">
                                      {comment.author.full_name || comment.author.email}
                                    </p>
                                    <p className="text-xs text-slate-400">
                                      {new Date(comment.created_at).toLocaleString()}
                                    </p>
                                  </div>
                                  <button className="p-1 hover:bg-slate-600 rounded transition">
                                    <MoreVertical className="w-4 h-4 text-slate-400" />
                                  </button>
                                </div>
                                <p className="text-sm text-slate-200 leading-relaxed">
                                  {comment.content}
                                </p>
                                {comment.attachments && Array.isArray(comment.attachments) && comment.attachments.length > 0 && (
                                  <div className="mt-3 pt-3 border-t border-slate-600 space-y-2">
                                    {(comment.attachments as Attachment[]).map((attachment, idx) => (
                                      <div key={idx} className="flex items-center gap-2 bg-slate-600/50 rounded-lg p-2">
                                        {isImageFile(attachment.type) ? (
                                          <a
                                            href={attachment.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1"
                                          >
                                            <img
                                              src={attachment.url}
                                              alt={attachment.name}
                                              className="max-w-full max-h-48 rounded"
                                            />
                                          </a>
                                        ) : (
                                          <a
                                            href={attachment.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-2 flex-1 hover:bg-slate-600 p-2 rounded transition"
                                          >
                                            <span className="text-2xl">{getFileIcon(attachment.type)}</span>
                                            <div className="flex-1 min-w-0">
                                              <p className="text-xs text-slate-200 truncate">{attachment.name}</p>
                                              <p className="text-xs text-slate-400">{formatFileSize(attachment.size)}</p>
                                            </div>
                                            <ExternalLink className="w-4 h-4 text-slate-400" />
                                          </a>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="p-4 border-t border-slate-700 bg-slate-750">
                        {attachments.length > 0 && (
                          <div className="mb-3 flex flex-wrap gap-2">
                            {attachments.map((attachment) => (
                              <div key={attachment.id} className="flex items-center gap-2 bg-slate-700 rounded-lg p-2 text-xs">
                                <span>{getFileIcon(attachment.type)}</span>
                                <span className="text-slate-300 truncate max-w-[120px]">{attachment.name}</span>
                                <button
                                  onClick={() => handleRemoveAttachment(attachment.id)}
                                  className="text-slate-400 hover:text-red-400 transition"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <div className="flex-1 relative">
                            <input
                              type="text"
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey && !uploadingFiles) {
                                  e.preventDefault();
                                  handleSendReply();
                                }
                              }}
                              placeholder="Write a reply..."
                              className="w-full px-4 py-3 bg-slate-700 text-slate-200 text-sm rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition"
                            />
                          </div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            onChange={handleFileSelect}
                            className="hidden"
                            accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,video/mp4,video/quicktime"
                          />
                          <button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploadingFiles}
                            className="p-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition disabled:opacity-50"
                            title="Attach files"
                          >
                            <Paperclip className="w-5 h-5 text-slate-400" />
                          </button>
                          <button
                            onClick={handleSendReply}
                            disabled={(!replyText.trim() && attachments.length === 0) || uploadingFiles}
                            className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition flex items-center gap-2"
                          >
                            <Send className="w-5 h-5 text-white" />
                            <span className="text-sm font-medium text-white">{uploadingFiles ? 'Uploading...' : 'Send'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
        </div>

        <div className={`absolute top-0 right-0 bottom-0 bg-slate-800 border-l border-slate-700 flex flex-col transition-all duration-300 shadow-2xl ${
          isCommentsSidebarCollapsed ? 'w-14' : 'w-96'
        }`}>
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
            {!isCommentsSidebarCollapsed && (
              <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4" />
                Comments
                <span className="ml-auto text-xs font-normal text-slate-400">
                  {threads.length}
                </span>
              </h2>
            )}
            <button
              onClick={() => setIsCommentsSidebarCollapsed(!isCommentsSidebarCollapsed)}
              className={`p-1 hover:bg-slate-700 rounded transition ${
                isCommentsSidebarCollapsed ? 'mx-auto' : ''
              }`}
              title={isCommentsSidebarCollapsed ? 'Expand comments' : 'Collapse comments'}
            >
              {isCommentsSidebarCollapsed ? (
                <ChevronLeft className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronRight className="w-4 h-4 text-slate-400" />
              )}
            </button>
          </div>

          {!isCommentsSidebarCollapsed && (
            <div className="flex-1 overflow-y-auto">
              {threads.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400">
                  <div className="text-center px-4">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="text-sm">No comments yet</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Share the URL with testers to collect feedback
                    </p>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-slate-700">
                  {threads.map((thread) => {
                    const latestComment = thread.comments[thread.comments.length - 1];
                    return (
                      <button
                        key={thread.id}
                        onClick={() => handleThreadClick(thread)}
                        className="w-full text-left p-4 hover:bg-slate-700/50 transition"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-9 h-9 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-md">
                            <span className="text-xs font-semibold text-white">
                              {getAuthorInitials(latestComment.author)}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-medium text-white truncate">
                                {latestComment.author.full_name || latestComment.author.email.split('@')[0]}
                              </span>
                              <span className={`px-1.5 py-0.5 text-xs font-medium rounded ${
                                thread.status === 'resolved'
                                  ? 'bg-green-500/20 text-green-300'
                                  : 'bg-amber-500/20 text-amber-300'
                              }`}>
                                {thread.status === 'resolved' ? 'Resolved' : 'Open'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 line-clamp-2 mb-2">
                              {latestComment.content}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <span>{thread.comments.length} comment{thread.comments.length !== 1 ? 's' : ''}</span>
                              <span>•</span>
                              <span>{new Date(latestComment.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {showDeleteModal && deletingThread && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">Delete Thread</h3>
                <p className="text-sm text-slate-400">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-300 mb-6">
              Are you sure you want to delete this thread and all its comments? This will permanently remove all feedback from this location.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingThread(null);
                }}
                className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteThread}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Thread
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
