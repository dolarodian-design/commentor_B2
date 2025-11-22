import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageSquare, FolderOpen, Plus, Clock, CheckCircle2 } from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type App = Database['public']['Tables']['apps']['Row'];
type Profile = Database['public']['Tables']['profiles']['Row'];

interface AppWithStats extends App {
  totalComments: number;
  unresolvedComments: number;
  owner: Profile;
}

interface CommentActivity {
  id: string;
  content: string;
  created_at: string;
  author: Profile;
  thread: {
    page_url: string;
    app: {
      name: string;
    };
  };
}

export function Dashboard() {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const [ownedApps, setOwnedApps] = useState<AppWithStats[]>([]);
  const [recentActivity, setRecentActivity] = useState<CommentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (currentWorkspace && user) {
      fetchDashboardData();
    }
  }, [currentWorkspace, user]);

  const fetchDashboardData = async () => {
    if (!currentWorkspace || !user) return;

    const { data: apps } = await supabase
      .from('apps')
      .select(`
        *,
        owner:profiles!apps_owner_id_fkey(*)
      `)
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false });

    if (apps) {
      const appsWithStats = await Promise.all(
        apps.map(async (app) => {
          const { data: threads } = await supabase
            .from('threads')
            .select('id, status, comments(count)')
            .eq('app_id', app.id);

          const totalComments = threads?.reduce(
            (sum, thread: any) => sum + (thread.comments[0]?.count || 0),
            0
          ) || 0;

          const unresolvedComments = threads?.filter(t => t.status === 'open').length || 0;

          return {
            ...app,
            totalComments,
            unresolvedComments,
          };
        })
      );

      setOwnedApps(appsWithStats as AppWithStats[]);
    }

    const { data: comments } = await supabase
      .from('comments')
      .select(`
        id,
        content,
        created_at,
        author:profiles!comments_author_id_fkey(*),
        thread:threads!comments_thread_id_fkey(
          page_url,
          app:apps!threads_app_id_fkey(name)
        )
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (comments) {
      setRecentActivity(comments as any);
    }

    setLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-600 mt-1">Overview of your feedback and comments</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FolderOpen className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Total Apps</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">{ownedApps.length}</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Unresolved</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {ownedApps.reduce((sum, app) => sum + app.unresolvedComments, 0)}
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-green-600" />
            </div>
            <h3 className="font-semibold text-slate-900">Total Comments</h3>
          </div>
          <p className="text-3xl font-bold text-slate-900">
            {ownedApps.reduce((sum, app) => sum + app.totalComments, 0)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-900">Your Apps</h2>
            <Link
              to="/dashboard/apps/new"
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" />
              <span>New App</span>
            </Link>
          </div>

          {ownedApps.length === 0 ? (
            <div className="text-center py-12">
              <FolderOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 mb-4">No apps yet</p>
              <Link
                to="/dashboard/apps/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
              >
                <Plus className="w-4 h-4" />
                <span>Create your first app</span>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {ownedApps.map((app) => (
                <Link
                  key={app.id}
                  to={`/dashboard/apps/${app.id}`}
                  className="block p-4 border border-slate-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-900 mb-1">{app.name}</h3>
                      <p className="text-sm text-slate-500 mb-2">{app.base_url}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-600">
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {app.totalComments} comments
                        </span>
                        {app.unresolvedComments > 0 && (
                          <span className="flex items-center gap-1 text-amber-600">
                            <Clock className="w-3 h-3" />
                            {app.unresolvedComments} unresolved
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-xl font-semibold text-slate-900 mb-6">Recent Activity</h2>

          {recentActivity.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600">No recent activity</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivity.slice(0, 5).map((comment) => (
                <div key={comment.id} className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                    <span className="text-xs font-medium text-slate-600">
                      {comment.author.full_name?.[0] || comment.author.email[0].toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-900">
                      <span className="font-medium">{comment.author.full_name || comment.author.email}</span>
                      {' commented on '}
                      <span className="font-medium">{comment.thread.app.name}</span>
                    </p>
                    <p className="text-sm text-slate-600 truncate">{comment.content}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      {new Date(comment.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
