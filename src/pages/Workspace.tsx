import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Mail, Trash2, Edit2, Plus, Crown, X, Save, Building2 } from 'lucide-react';
import { useWorkspace } from '../contexts/WorkspaceContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

interface WorkspaceMember {
  id: string;
  user_id: string;
  role: string;
  joined_at: string;
  profiles: {
    full_name: string;
    email: string;
  };
}

export function Workspace() {
  const { currentWorkspace, workspaces, setWorkspaces, setCurrentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'moderator' | 'commenter' | 'viewer'>('commenter');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [creatingWorkspace, setCreatingWorkspace] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      setWorkspaceName(currentWorkspace.name);
      fetchMembers();
    }
  }, [currentWorkspace]);

  const fetchMembers = async () => {
    if (!currentWorkspace) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('workspace_members')
      .select(`
        id,
        user_id,
        role,
        joined_at,
        profiles:user_id (
          full_name,
          email
        )
      `)
      .eq('workspace_id', currentWorkspace.id)
      .order('joined_at', { ascending: true });

    if (error) {
      console.error('Error fetching members:', error);
    } else {
      setMembers(data as any);
    }
    setLoading(false);
  };

  const handleUpdateWorkspace = async () => {
    if (!currentWorkspace || !workspaceName.trim()) return;

    const { error } = await supabase
      .from('workspaces')
      .update({ name: workspaceName, updated_at: new Date().toISOString() })
      .eq('id', currentWorkspace.id);

    if (error) {
      alert('Failed to update workspace');
    } else {
      const updatedWorkspaces = workspaces.map(w =>
        w.id === currentWorkspace.id ? { ...w, name: workspaceName } : w
      );
      setWorkspaces(updatedWorkspaces);
      setCurrentWorkspace({ ...currentWorkspace, name: workspaceName });
      setIsEditing(false);
    }
  };

  const handleDeleteWorkspace = async () => {
    if (!currentWorkspace) return;

    const { error } = await supabase
      .from('workspaces')
      .delete()
      .eq('id', currentWorkspace.id);

    if (error) {
      alert('Failed to delete workspace');
    } else {
      const remainingWorkspaces = workspaces.filter(w => w.id !== currentWorkspace.id);
      setWorkspaces(remainingWorkspaces);
      if (remainingWorkspaces.length > 0) {
        setCurrentWorkspace(remainingWorkspaces[0]);
        navigate('/dashboard');
      } else {
        navigate('/onboarding');
      }
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newWorkspaceName.trim()) return;

    setCreatingWorkspace(true);

    const slug = generateSlug(newWorkspaceName);

    const { data: existingWorkspace } = await supabase
      .from('workspaces')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();

    if (existingWorkspace) {
      alert('A workspace with this name already exists. Please choose a different name.');
      setCreatingWorkspace(false);
      return;
    }

    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert({
        name: newWorkspaceName.trim(),
        slug,
        owner_id: user.id,
      })
      .select()
      .single();

    if (workspaceError) {
      alert('Failed to create workspace');
      setCreatingWorkspace(false);
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
      alert('Failed to add you as workspace member');
      setCreatingWorkspace(false);
      return;
    }

    const updatedWorkspaces = [...workspaces, workspace];
    setWorkspaces(updatedWorkspaces);
    setCurrentWorkspace(workspace);
    setNewWorkspaceName('');
    setShowCreateWorkspace(false);
    setCreatingWorkspace(false);
  };

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentWorkspace || !inviteEmail.trim()) return;

    const { data: invitedProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', inviteEmail.toLowerCase())
      .maybeSingle();

    if (!invitedProfile) {
      alert('User not found. They need to sign up first.');
      return;
    }

    const { error } = await supabase
      .from('workspace_members')
      .insert({
        workspace_id: currentWorkspace.id,
        user_id: invitedProfile.id,
        role: inviteRole,
        invited_by: user?.id,
      });

    if (error) {
      if (error.code === '23505') {
        alert('User is already a member of this workspace');
      } else {
        alert('Failed to invite member');
      }
    } else {
      setInviteEmail('');
      setInviteRole('commenter');
      setShowInviteForm(false);
      fetchMembers();
    }
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    if (userId === currentWorkspace?.owner_id) {
      alert('Cannot remove workspace owner');
      return;
    }

    const { error } = await supabase
      .from('workspace_members')
      .delete()
      .eq('id', memberId);

    if (error) {
      alert('Failed to remove member');
    } else {
      fetchMembers();
    }
  };

  const handleUpdateMemberRole = async (memberId: string, newRole: string) => {
    const { error } = await supabase
      .from('workspace_members')
      .update({ role: newRole })
      .eq('id', memberId);

    if (error) {
      alert('Failed to update member role');
    } else {
      fetchMembers();
    }
  };

  const currentUserRole = members.find(m => m.user_id === user?.id)?.role;
  const isAdmin = currentUserRole === 'admin';
  const canManage = isAdmin || currentUserRole === 'moderator';

  if (!currentWorkspace) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">No workspace selected</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Workspace Management</h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage your current workspace or create a new one
          </p>
        </div>
        <button
          onClick={() => setShowCreateWorkspace(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
        >
          <Building2 className="w-4 h-4" />
          Create Workspace
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              {isEditing ? (
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={(e) => setWorkspaceName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Workspace name"
                  />
                  <button
                    onClick={handleUpdateWorkspace}
                    className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                  >
                    <Save className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setWorkspaceName(currentWorkspace.name);
                    }}
                    className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-slate-900">{currentWorkspace.name}</h1>
                  {isAdmin && (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
              <p className="text-sm text-slate-500 mt-1">
                Manage your workspace and team members
              </p>
            </div>
            {isAdmin && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Delete Workspace
              </button>
            )}
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-slate-600" />
              <h2 className="text-lg font-semibold text-slate-900">
                Team Members ({members.length})
              </h2>
            </div>
            {canManage && (
              <button
                onClick={() => setShowInviteForm(!showInviteForm)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Invite Member
              </button>
            )}
          </div>

          {showInviteForm && (
            <form onSubmit={handleInviteMember} className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <h3 className="text-sm font-medium text-slate-900 mb-3">Invite New Member</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Email address"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="viewer">Viewer</option>
                  <option value="commenter">Commenter</option>
                  <option value="moderator">Moderator</option>
                  {isAdmin && <option value="admin">Admin</option>}
                </select>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition whitespace-nowrap"
                >
                  Send Invite
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => {
                const isCurrentUser = member.user_id === user?.id;
                const isMemberOwner = member.user_id === currentWorkspace.owner_id;
                return (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-blue-600 font-medium text-sm">
                          {member.profiles.full_name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">
                            {member.profiles.full_name}
                            {isCurrentUser && <span className="text-slate-500 text-sm">(You)</span>}
                          </p>
                          {isMemberOwner && (
                            <Crown className="w-4 h-4 text-yellow-500" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-slate-500">
                          <Mail className="w-3 h-3" />
                          {member.profiles.email}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {canManage && !isMemberOwner ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleUpdateMemberRole(member.id, e.target.value)}
                          className="px-3 py-1 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="viewer">Viewer</option>
                          <option value="commenter">Commenter</option>
                          <option value="moderator">Moderator</option>
                          {isAdmin && <option value="admin">Admin</option>}
                        </select>
                      ) : (
                        <span className="px-3 py-1 text-sm bg-slate-200 text-slate-700 rounded-lg capitalize">
                          {member.role}
                        </span>
                      )}
                      {canManage && !isMemberOwner && !isCurrentUser && (
                        <button
                          onClick={() => handleRemoveMember(member.id, member.user_id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Delete Workspace</h3>
            <p className="text-slate-600 mb-6">
              Are you sure you want to delete "{currentWorkspace.name}"? This will permanently delete all apps, comments, and data associated with this workspace. This action cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteWorkspace}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              >
                Delete Workspace
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateWorkspace && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">Create New Workspace</h3>
            <p className="text-slate-600 mb-6">
              Create a new workspace to organize your apps and collaborate with your team.
            </p>
            <form onSubmit={handleCreateWorkspace}>
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Workspace Name
                </label>
                <input
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder="My Team Workspace"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  autoFocus
                />
              </div>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateWorkspace(false);
                    setNewWorkspaceName('');
                  }}
                  className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition"
                  disabled={creatingWorkspace}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                  disabled={creatingWorkspace}
                >
                  {creatingWorkspace ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Building2 className="w-4 h-4" />
                      Create Workspace
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
