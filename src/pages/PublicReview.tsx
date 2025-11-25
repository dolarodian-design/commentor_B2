import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  X,
  Send,
  Paperclip,
  MoreVertical,
  Check,
  Target,
  MousePointer2,
  Edit,
  Save,
  Trash2,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { ElementSelector } from '../components/ElementSelector';
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

export function PublicReview() {
  const { appId } = useParams<{ appId: string }>();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [app, setApp] = useState<App | null>(null);
  const [threads, setThreads] = useState<ThreadWithComments[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedThread, setSelectedThread] = useState<ThreadWithComments | null>(null);
  const [iframeUrl, setIframeUrl] = useState('');
  const [commentPins, setCommentPins] = useState<CommentPin[]>([]);
  const [replyText, setReplyText] = useState('');
  const [showCommentOverlay, setShowCommentOverlay] = useState(false);
  const [isAddingComment, setIsAddingComment] = useState(false);
  const [newCommentPosition, setNewCommentPosition] = useState<{ x: number; y: number } | null>(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [commentMode, setCommentMode] = useState<'off' | 'spatial' | 'element'>('off');
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [commentMenuOpen, setCommentMenuOpen] = useState<string | null>(null);
  const [capturingScreenshot, setCapturingScreenshot] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          if (commentMode === 'off' && !showCommentOverlay) {
            setCommentMode('spatial');
          }
        }
      }
      if (e.key === 'Escape') {
        setCommentMode('off');
        setIsAddingComment(false);
        setSelectedElement(null);
        closeCommentOverlay();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [commentMode, showCommentOverlay]);

  useEffect(() => {
    if (appId) {
      fetchAppDetails();
      const interval = setInterval(fetchThreads, 5000);
      return () => clearInterval(interval);
    }
  }, [appId]);

  useEffect(() => {
    if (app) {
      let url = app.base_url;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }
      setIframeUrl(url);
    }
  }, [app]);

  useEffect(() => {
    if (threads.length > 0) {
      updateCommentPins(threads);
    }
  }, [threads]);

  const fetchAppDetails = async () => {
    if (!appId) return;

    const { data: appData } = await supabase
      .from('apps')
      .select('*')
      .eq('id', appId)
      .maybeSingle();

    if (appData) {
      setApp(appData);
      await fetchThreads();
    }

    setLoading(false);
  };

  const fetchThreads = async () => {
    if (!appId) return;

    const { data: threadsData } = await supabase
      .from('threads')
      .select(`
        *,
        comments(
          *,
          author:profiles!comments_author_id_fkey(full_name, email)
        )
      `)
      .eq('app_id', appId)
      .order('created_at', { ascending: false});

    if (threadsData) {
      setThreads(threadsData as any);
    }
  };

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

  const handleIframeClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (commentMode === 'off' || !iframeContainerRef.current) return;

    const rect = iframeContainerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setNewCommentPosition({ x, y });
    setShowCommentOverlay(true);
    setIsAddingComment(true);
  };

  const handleThreadClick = (thread: ThreadWithComments) => {
    setSelectedThread(thread);
    setShowCommentOverlay(true);
    setIsAddingComment(false);
    setNewCommentPosition(null);
  };

  const closeCommentOverlay = () => {
    setShowCommentOverlay(false);
    setCommentMode('off');
    setTimeout(() => {
      setSelectedThread(null);
      setNewCommentPosition(null);
      setNewCommentText('');
      setSelectedElement(null);
    }, 300);
  };

  const handleElementSelected = (selector: string, position: { x: number; y: number }) => {
    setSelectedElement(selector || null);
    setNewCommentPosition(position);
    setShowCommentOverlay(true);
    setIsAddingComment(true);
  };

  const captureScreenshot = async (): Promise<string | null> => {
    if (!iframeRef.current) return null;

    try {
      setCapturingScreenshot(true);
      const iframeDocument = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;

      if (!iframeDocument || !iframeDocument.body) {
        console.warn('Cannot access iframe document for screenshot');
        return null;
      }

      const canvas = await html2canvas(iframeDocument.body, {
        allowTaint: true,
        useCORS: true,
        scale: 0.5,
        logging: false,
        backgroundColor: '#ffffff',
      });

      return canvas.toDataURL('image/jpeg', 0.7);
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return null;
    } finally {
      setCapturingScreenshot(false);
    }
  };

  const handleCreateComment = async () => {
    if (!newCommentText.trim() || !newCommentPosition || !appId || !user) return;

    try {
      const screenshot = await captureScreenshot();
      const pageTitle = iframeRef.current?.contentDocument?.title || 'Untitled Page';

      const threadData: any = {
        app_id: appId,
        page_url: iframeUrl,
        position_data: newCommentPosition,
        status: 'open',
      };

      if (selectedElement) {
        threadData.dom_selector = { selector: selectedElement };
      } else {
        threadData.dom_selector = null;
      }

      const { data: thread, error: threadError } = await supabase
        .from('threads')
        .insert(threadData)
        .select()
        .single();

      if (threadError) {
        console.error('Thread creation error:', threadError);
        alert('Failed to create comment thread. Please try again.');
        return;
      }

      if (thread) {
        const metadata: any = {
          page_title: pageTitle,
        };

        if (screenshot) {
          metadata.screenshot = screenshot;
        }

        const { error: commentError } = await supabase.from('comments').insert({
          thread_id: thread.id,
          author_id: user.id,
          content: newCommentText,
          metadata,
        });

        if (commentError) {
          console.error('Comment creation error:', commentError);
          alert('Failed to create comment. Please try again.');
          return;
        }

        await fetchThreads();
        closeCommentOverlay();
        setIsAddingComment(false);
        setNewCommentText('');
        setSelectedElement(null);
      }
    } catch (error) {
      console.error('Error creating comment:', error);
      alert('An error occurred. Please try again.');
    }
  };

  const handleSendReply = async () => {
    if (!replyText.trim() || !selectedThread || !user) return;

    try {
      const { error } = await supabase.from('comments').insert({
        thread_id: selectedThread.id,
        author_id: user.id,
        content: replyText,
      });

      if (error) {
        console.error('Reply error:', error);
        alert('Failed to send reply. Please try again.');
        return;
      }

      setReplyText('');
      await fetchThreads();
    } catch (error) {
      console.error('Error sending reply:', error);
    }
  };

  const handleEditComment = (comment: Comment & { author: any }) => {
    setEditingComment(comment.id);
    setEditText(comment.content);
    setCommentMenuOpen(null);
  };

  const handleSaveEdit = async (commentId: string) => {
    if (!editText.trim()) return;

    try {
      const { error } = await supabase
        .from('comments')
        .update({
          content: editText,
          edited_at: new Date().toISOString()
        })
        .eq('id', commentId);

      if (error) throw error;

      await fetchThreads();
      setEditingComment(null);
      setEditText('');
    } catch (error) {
      console.error('Error updating comment:', error);
      alert('Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId: string, threadId: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;

      const { data: remainingComments } = await supabase
        .from('comments')
        .select('id')
        .eq('thread_id', threadId);

      if (!remainingComments || remainingComments.length === 0) {
        await supabase
          .from('threads')
          .delete()
          .eq('id', threadId);

        setShowCommentOverlay(false);
        setSelectedThread(null);
      }

      await fetchThreads();
      setCommentMenuOpen(null);
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment');
    }
  };

  const getAuthorInitials = (author: { full_name: string | null; email: string }) => {
    return author.full_name?.[0] || author.email[0].toUpperCase();
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center">
          <MessageSquare className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">Authentication Required</h1>
          <p className="text-slate-400 mb-6">Please log in to access this review page</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (!app) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900">
        <div className="text-center">
          <MessageSquare className="w-16 h-16 text-slate-600 mx-auto mb-4" />
          <h1 className="text-xl font-semibold text-white mb-2">App Not Found</h1>
          <p className="text-slate-400">The review link may be invalid or expired</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      <header className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-4">
          <MessageSquare className="w-6 h-6 text-blue-500" />
          <div>
            <h1 className="text-lg font-semibold text-white">{app.name}</h1>
            <p className="text-xs text-slate-400">Review Mode</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            Press <kbd className="px-2 py-1 bg-slate-700 rounded text-slate-300 font-mono">C</kbd> to comment
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCommentMode(commentMode === 'spatial' ? 'off' : 'spatial')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition ${
                commentMode === 'spatial'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <MousePointer2 className="w-4 h-4" />
              <span>{commentMode === 'spatial' ? 'Click to Comment' : 'Spatial Comment'}</span>
            </button>
            <button
              onClick={() => setCommentMode(commentMode === 'element' ? 'off' : 'element')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition relative ${
                commentMode === 'element'
                  ? 'bg-purple-600 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
              title="Advanced: Select specific elements"
            >
              <Target className="w-4 h-4" />
              <span>{commentMode === 'element' ? 'Select Element' : 'Element Selector'}</span>
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded-full">PRO</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative bg-slate-900">
          <div
            ref={iframeContainerRef}
            className={`absolute inset-4 bg-white rounded-lg shadow-2xl overflow-hidden ${
              commentMode === 'spatial' ? 'cursor-crosshair' : commentMode === 'element' ? 'cursor-pointer' : ''
            }`}
            onClick={commentMode === 'spatial' ? handleIframeClick : undefined}
          >
            {iframeUrl ? (
              <>
                <iframe
                  ref={iframeRef}
                  src={iframeUrl}
                  className={`w-full h-full ${
                    commentMode === 'off' ? 'pointer-events-auto' : 'pointer-events-none'
                  }`}
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                />

                {commentMode === 'off' && commentPins.map((pin) => {
                  const thread = threads.find(t => t.id === pin.threadId);
                  if (!thread) return null;
                  const isSelected = selectedThread?.id === thread.id && showCommentOverlay;

                  return (
                    <button
                      key={pin.threadId}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleThreadClick(thread);
                      }}
                      className={`absolute w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg transition-all hover:scale-110 pointer-events-auto z-50 ${
                        isSelected
                          ? 'bg-blue-600 scale-110 ring-4 ring-blue-300'
                          : thread.status === 'resolved'
                          ? 'bg-green-500 hover:bg-green-600'
                          : 'bg-amber-500 hover:bg-amber-600'
                      }`}
                      style={{
                        left: `${pin.x}px`,
                        top: `${pin.y}px`,
                        transform: 'translate(-50%, -50%)'
                      }}
                    >
                      {thread.comments.length}
                    </button>
                  );
                })}

                {commentMode !== 'off' && (
                  <div
                    className="absolute inset-0 pointer-events-none z-10"
                    style={{ backgroundColor: commentMode === 'element' ? 'rgba(0,0,0,0.05)' : 'transparent' }}
                  >
                    {commentMode === 'element' && (
                      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-medium shadow-lg max-w-md text-center">
                        <div className="font-semibold mb-1">Element Selector Mode</div>
                        <div className="text-xs opacity-90">Note: Due to browser security, this works on UI overlays. Click anywhere to add a spatial comment.</div>
                      </div>
                    )}
                  </div>
                )}

                {commentMode === 'element' && !showCommentOverlay && (
                  <ElementSelector
                    isActive={commentMode === 'element' && !showCommentOverlay}
                    onElementSelected={handleElementSelected}
                    containerRef={iframeContainerRef}
                  />
                )}

                {newCommentPosition && (
                  <div
                    className="absolute w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shadow-lg ring-4 ring-blue-300 animate-pulse pointer-events-none z-20"
                    style={{
                      left: `${newCommentPosition.x}px`,
                      top: `${newCommentPosition.y}px`,
                      transform: 'translate(-50%, -50%)'
                    }}
                  >
                    <MessageSquare className="w-4 h-4" />
                  </div>
                )}

                {showCommentOverlay && (
                  <div className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-8 animate-in fade-in duration-200 pointer-events-auto z-50">
                    <div className="bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col animate-in slide-in-from-bottom-4 duration-300">
                      <div className="flex items-center justify-between p-6 border-b border-slate-700">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${
                            selectedThread ?
                              (selectedThread.status === 'resolved' ? 'bg-green-500' : 'bg-amber-500')
                              : 'bg-blue-500'
                          }`} />
                          <div>
                            <h3 className="text-lg font-semibold text-white">
                              {newCommentPosition ? 'New Comment' : 'Comment Thread'}
                            </h3>
                            {selectedThread && (
                              <p className="text-xs text-slate-400 truncate max-w-md">
                                {selectedThread.page_url}
                              </p>
                            )}
                            {selectedElement && newCommentPosition && (
                              <p className="text-xs text-purple-400 truncate max-w-md font-mono mt-1">
                                📍 {selectedElement}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={closeCommentOverlay}
                          className="p-2 hover:bg-slate-700 rounded-lg transition"
                        >
                          <X className="w-5 h-5 text-slate-400" />
                        </button>
                      </div>

                      <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {newCommentPosition && !selectedThread ? (
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-slate-300 mb-2">
                                Comment
                              </label>
                              <textarea
                                value={newCommentText}
                                onChange={(e) => setNewCommentText(e.target.value)}
                                placeholder="Describe the issue or feedback..."
                                rows={6}
                                autoFocus
                                className="w-full px-4 py-3 bg-slate-700 text-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                              />
                            </div>
                          </div>
                        ) : (
                          selectedThread?.comments.map((comment) => (
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
                                        {comment.edited_at && ' (edited)'}
                                      </p>
                                    </div>
                                    {comment.author_id === user?.id && (
                                      <div className="relative">
                                        <button
                                          onClick={() => setCommentMenuOpen(commentMenuOpen === comment.id ? null : comment.id)}
                                          className="p-1 hover:bg-slate-600 rounded transition"
                                        >
                                          <MoreVertical className="w-4 h-4 text-slate-400" />
                                        </button>
                                        {commentMenuOpen === comment.id && (
                                          <div className="absolute right-0 mt-1 w-32 bg-slate-800 rounded-lg shadow-xl border border-slate-700 py-1 z-50">
                                            <button
                                              onClick={() => handleEditComment(comment)}
                                              className="w-full px-4 py-2 text-left text-sm text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                                            >
                                              <Edit className="w-3.5 h-3.5" />
                                              Edit
                                            </button>
                                            <button
                                              onClick={() => handleDeleteComment(comment.id, comment.thread_id)}
                                              className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-slate-700 flex items-center gap-2"
                                            >
                                              <Trash2 className="w-3.5 h-3.5" />
                                              Delete
                                            </button>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {editingComment === comment.id ? (
                                    <div className="space-y-2">
                                      <textarea
                                        value={editText}
                                        onChange={(e) => setEditText(e.target.value)}
                                        className="w-full bg-slate-600 text-slate-200 rounded-lg p-2 text-sm border border-slate-500 focus:border-blue-500 focus:outline-none resize-none"
                                        rows={3}
                                        autoFocus
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          onClick={() => handleSaveEdit(comment.id)}
                                          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded-lg flex items-center gap-1.5 transition"
                                        >
                                          <Save className="w-3.5 h-3.5" />
                                          Save
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingComment(null);
                                            setEditText('');
                                          }}
                                          className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-slate-300 text-xs rounded-lg transition"
                                        >
                                          Cancel
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-sm text-slate-200 leading-relaxed">
                                      {comment.content}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="p-4 border-t border-slate-700 bg-slate-750">
                        {newCommentPosition && !selectedThread ? (
                          <div className="flex gap-2">
                            <button
                              onClick={closeCommentOverlay}
                              className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleCreateComment}
                              disabled={!newCommentText.trim() || capturingScreenshot}
                              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl transition flex items-center justify-center gap-2"
                            >
                              <Check className="w-5 h-5" />
                              <span className="font-medium">
                                {capturingScreenshot ? 'Capturing...' : 'Create Comment'}
                              </span>
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSendReply();
                                }
                              }}
                              placeholder="Write a reply..."
                              className="flex-1 px-4 py-3 bg-slate-700 text-slate-200 text-sm rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition"
                            />
                            <button className="p-3 bg-slate-700 hover:bg-slate-600 rounded-xl transition">
                              <Paperclip className="w-5 h-5 text-slate-400" />
                            </button>
                            <button
                              onClick={handleSendReply}
                              disabled={!replyText.trim()}
                              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl transition flex items-center gap-2"
                            >
                              <Send className="w-5 h-5 text-white" />
                              <span className="text-sm font-medium text-white">Send</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Loading application...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-80 bg-slate-800 border-l border-slate-700 flex flex-col">
          <div className="p-4 border-b border-slate-700">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Comments
              <span className="ml-auto text-xs font-normal text-slate-400">
                {threads.length}
              </span>
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 ? (
              <div className="flex items-center justify-center h-full text-slate-400">
                <div className="text-center px-4">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No comments yet</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Press C or click "Add Comment" to start
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
        </div>
      </div>
    </div>
  );
}
