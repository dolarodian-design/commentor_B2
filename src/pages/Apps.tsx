import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, ExternalLink, Clock, MessageSquare, Users, UserCheck, CheckCircle, Calendar, MoreVertical, Trash2, Settings, Power, PowerOff } from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type App = Database['public']['Tables']['apps']['Row'];

interface AppWithStats extends App {
  totalThreads: number;
  unresolvedThreads: number;
  resolvedThreads: number;
  totalInvited: number;
  totalTesters: number;
  totalComments: number;
}

export function Apps() {
  const { currentWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const [apps, setApps] = useState<AppWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<'all' | 'month'>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingApp, setDeletingApp] = useState<AppWithStats | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (currentWorkspace) {
      fetchApps();
    }
  }, [currentWorkspace, dateFilter]);

  const getDateFilter = () => {
    if (dateFilter === 'month') {
      const now = new Date();
      const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return firstDayOfMonth.toISOString();
    }
    return null;
  };

  const fetchApps = async () => {
    if (!currentWorkspace) return;

    const { data: appsData } = await supabase
      .from('apps')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false });

    if (appsData) {
      const dateFilterValue = getDateFilter();

      const appsWithStats = await Promise.all(
        appsData.map(async (app) => {
          let threadsQuery = supabase
            .from('threads')
            .select('id, status, created_at')
            .eq('app_id', app.id);

          if (dateFilterValue) {
            threadsQuery = threadsQuery.gte('created_at', dateFilterValue);
          }

          const { data: threads } = await threadsQuery;

          let commentsQuery = supabase
            .from('comments')
            .select('id, created_at, thread_id')
            .in('thread_id', threads?.map(t => t.id) || []);

          if (dateFilterValue) {
            commentsQuery = commentsQuery.gte('created_at', dateFilterValue);
          }

          const { data: comments } = await commentsQuery;

          let collaboratorsQuery = supabase
            .from('app_collaborators')
            .select('id, user_id, invited_at')
            .eq('app_id', app.id);

          if (dateFilterValue) {
            collaboratorsQuery = collaboratorsQuery.gte('invited_at', dateFilterValue);
          }

          const { data: collaborators } = await collaboratorsQuery;

          const totalThreads = threads?.length || 0;
          const unresolvedThreads = threads?.filter(t => t.status === 'open').length || 0;
          const resolvedThreads = threads?.filter(t => t.status === 'resolved').length || 0;
          const totalInvited = collaborators?.length || 0;
          const totalTesters = collaborators?.length || 0;
          const totalComments = comments?.length || 0;

          return {
            ...app,
            totalThreads,
            unresolvedThreads,
            resolvedThreads,
            totalInvited,
            totalTesters,
            totalComments,
          };
        })
      );

      setApps(appsWithStats);
    }

    setLoading(false);
  };

  const handleDeleteApp = async () => {
    if (!deletingApp) return;

    try {
      const { error } = await supabase
        .from('apps')
        .delete()
        .eq('id', deletingApp.id);

      if (error) throw error;

      await fetchApps();
      setShowDeleteModal(false);
      setDeletingApp(null);
    } catch (error) {
      console.error('Error deleting app:', error);
      alert('Failed to delete app. Please try again.');
    }
  };

  const handleToggleActive = async (app: AppWithStats, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    try {
      const { error } = await supabase
        .from('apps')
        .update({ is_active: !app.is_active })
        .eq('id', app.id);

      if (error) throw error;

      await fetchApps();
      setOpenMenuId(null);
    } catch (error) {
      console.error('Error toggling app status:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Apps</h1>
          <p className="text-slate-600 mt-1">Manage applications you collect feedback on</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-1">
            <button
              onClick={() => setDateFilter('all')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                dateFilter === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All Time
            </button>
            <button
              onClick={() => setDateFilter('month')}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition flex items-center gap-1 ${
                dateFilter === 'month'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar className="w-4 h-4" />
              This Month
            </button>
          </div>
          <Link
            to="/dashboard/apps/new"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            <span>New App</span>
          </Link>
        </div>
      </div>

      {apps.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <FolderOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No apps yet</h3>
          <p className="text-slate-600 mb-6">
            Create your first app to start collecting contextual feedback
          </p>
          <Link
            to="/dashboard/apps/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Create your first app</span>
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map((app) => (
            <div key={app.id} className="relative">
              <Link
                to={`/dashboard/apps/${app.id}`}
                className="block bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:border-blue-300 hover:shadow-md transition group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <FolderOpen className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex items-center gap-2">
                    {app.is_active ? (
                      <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-slate-100 text-slate-700 text-xs font-medium rounded">
                        Inactive
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setOpenMenuId(openMenuId === app.id ? null : app.id);
                      }}
                      className="p-1 hover:bg-slate-100 rounded transition"
                    >
                      <MoreVertical className="w-4 h-4 text-slate-600" />
                    </button>
                  </div>
                </div>

              <h3 className="text-lg font-semibold text-slate-900 mb-2 group-hover:text-blue-600 transition">
                {app.name}
              </h3>

              <div className="flex items-center gap-1 text-sm text-slate-500 mb-4">
                <ExternalLink className="w-3 h-3" />
                <span className="truncate">{app.base_url}</span>
              </div>

              {app.description && (
                <p className="text-sm text-slate-600 mb-4 line-clamp-2">{app.description}</p>
              )}

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                <div className="flex flex-col">
                  <span className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                    <Users className="w-3 h-3" />
                    Invited
                  </span>
                  <span className="text-lg font-semibold text-slate-900">{app.totalInvited}</span>
                </div>
                <div className="flex flex-col">
                  <span className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                    <UserCheck className="w-3 h-3" />
                    Testers
                  </span>
                  <span className="text-lg font-semibold text-slate-900">{app.totalTesters}</span>
                </div>
                <div className="flex flex-col">
                  <span className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                    <MessageSquare className="w-3 h-3" />
                    Comments
                  </span>
                  <span className="text-lg font-semibold text-slate-900">{app.totalComments}</span>
                </div>
                <div className="flex flex-col">
                  <span className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                    <CheckCircle className="w-3 h-3" />
                    Resolved
                  </span>
                  <span className="text-lg font-semibold text-green-600">{app.resolvedThreads}</span>
                </div>
              </div>

              {app.unresolvedThreads > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <span className="flex items-center gap-1 text-sm text-amber-600 font-medium">
                    <Clock className="w-4 h-4" />
                    {app.unresolvedThreads} open thread{app.unresolvedThreads !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              </Link>

              {openMenuId === app.id && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setOpenMenuId(null)}
                  />
                  <div className="absolute top-14 right-6 z-20 w-48 bg-white rounded-lg shadow-lg border border-slate-200 py-1">
                    <button
                      onClick={(e) => handleToggleActive(app, e)}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                    >
                      {app.is_active ? (
                        <PowerOff className="w-4 h-4" />
                      ) : (
                        <Power className="w-4 h-4" />
                      )}
                      {app.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        navigate(`/dashboard/apps/${app.id}/settings`);
                        setOpenMenuId(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </button>
                    <div className="my-1 border-t border-slate-200" />
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeletingApp(app);
                        setShowDeleteModal(true);
                        setOpenMenuId(null);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition"
                    >
                      <Trash2 className="w-4 h-4" />
                      Delete App
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {showDeleteModal && deletingApp && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Delete App</h3>
                <p className="text-sm text-slate-600">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-slate-700 mb-2">
              Are you sure you want to delete <strong>{deletingApp.name}</strong>?
            </p>
            <p className="text-sm text-slate-600 mb-6">
              This will permanently delete the app and all associated threads, comments, and invitations.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingApp(null);
                }}
                className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteApp}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete App
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
