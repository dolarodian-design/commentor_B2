import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, ExternalLink, Clock, User } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import type { Database } from '../lib/database.types';

type App = Database['public']['Tables']['apps']['Row'];
type Collaborator = Database['public']['Tables']['app_collaborators']['Row'] & {
  app: App;
  inviter: {
    full_name: string | null;
    email: string;
  };
};

export function SharedWithMe() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchCollaborators();
    }
  }, [user]);

  const fetchCollaborators = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('app_collaborators')
      .select(`
        *,
        app:apps(*),
        inviter:profiles!app_collaborators_invited_by_fkey(full_name, email)
      `)
      .eq('user_id', user.id)
      .order('invited_at', { ascending: false });

    if (data) {
      setCollaborators(data as any);
    }

    if (error) {
      console.error('Error fetching collaborators:', error);
    }

    setLoading(false);
  };

  const handleAcceptInvitation = async (collaboratorId: string) => {
    await fetchCollaborators();
  };

  const handleOpenReview = (appId: string, collaboratorId: string) => {
    handleAcceptInvitation(collaboratorId);
    navigate(`/review/${appId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Shared With Me</h1>
        <p className="text-slate-600">Apps you've been invited to review and test</p>
      </div>

      {collaborators.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
          <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-900 mb-2">
            No Invitations Yet
          </h2>
          <p className="text-slate-600">
            You haven't been invited to review any apps yet. When someone shares an app with you, it will appear here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {collaborators.map((collab) => (
            <div
              key={collab.id}
              className="bg-white rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-slate-900 mb-1">
                    {collab.app.name}
                  </h3>
                  <p className="text-sm text-slate-500 truncate">
                    {collab.app.base_url}
                  </p>
                </div>
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                  {collab.access_level}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <User className="w-4 h-4" />
                  <span>
                    Invited by {collab.inviter?.full_name || collab.inviter?.email.split('@')[0] || 'Unknown'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-600">
                  <Clock className="w-4 h-4" />
                  <span>{new Date(collab.invited_at).toLocaleDateString()}</span>
                </div>
              </div>

              <button
                onClick={() => handleOpenReview(collab.app.id, collab.id)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open Review</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
