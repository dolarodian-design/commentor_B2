import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { checkUserWorkspaces } from '../lib/workspaceHelpers';

export function Onboarding() {
  const [workspaceName, setWorkspaceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const checkExistingWorkspace = async () => {
      if (!user) {
        navigate('/login');
        return;
      }

      const workspacePath = await checkUserWorkspaces(user.id);
      if (workspacePath) {
        navigate(workspacePath);
      } else {
        setChecking(false);
      }
    };

    checkExistingWorkspace();
  }, [user, navigate]);

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');

    const slug = generateSlug(workspaceName);

    const { data: existingWorkspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existingWorkspace) {
      setError('A workspace with this name already exists. Please choose a different name.');
      setLoading(false);
      return;
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name: workspaceName,
        slug,
        owner_id: user.id,
      })
      .select()
      .single();

    if (workspaceError) {
      setError(workspaceError.message);
      setLoading(false);
      return;
    }

    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: 'admin',
      });

    if (memberError) {
      setError(memberError.message);
      setLoading(false);
      return;
    }

    navigate('/dashboard');
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">Create your workspace</h2>
          <p className="text-slate-600 mb-6">A workspace is where your team collaborates on feedback and comments.</p>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="workspaceName" className="block text-sm font-medium text-slate-700 mb-1">
                Workspace name
              </label>
              <input
                id="workspaceName"
                type="text"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                placeholder="My Team"
              />
              {workspaceName && (
                <p className="mt-1 text-xs text-slate-500">
                  Workspace URL: {generateSlug(workspaceName) || 'workspace-url'}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating workspace...' : 'Create workspace'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
