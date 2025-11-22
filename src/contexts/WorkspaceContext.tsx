import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import type { Database } from '../lib/database.types';

type Workspace = Database['public']['Tables']['workspaces']['Row'];
type WorkspaceMember = Database['public']['Tables']['workspace_members']['Row'];

interface WorkspaceContextType {
  workspaces: Workspace[];
  currentWorkspace: Workspace | null;
  currentMembership: WorkspaceMember | null;
  loading: boolean;
  setCurrentWorkspace: (workspace: Workspace | null) => void;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [currentMembership, setCurrentMembership] = useState<WorkspaceMember | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchWorkspaces = async () => {
    if (!user) {
      setWorkspaces([]);
      setCurrentWorkspace(null);
      setCurrentMembership(null);
      setLoading(false);
      return;
    }

    try {
      const { data: membershipData, error: membershipError } = await supabase
        .rpc('get_user_workspaces', { user_uuid: user.id });

      if (membershipError || !membershipData || membershipData.length === 0) {
        setWorkspaces([]);
        setCurrentWorkspace(null);
        setCurrentMembership(null);
        setLoading(false);
        return;
      }

      const workspaceIds = membershipData.map((m: any) => m.workspace_id);
      const { data: workspaceData } = await supabase
        .from('workspaces')
        .select('*')
        .in('id', workspaceIds)
        .order('created_at', { ascending: false });

      if (workspaceData) {
        setWorkspaces(workspaceData);

        const savedWorkspaceId = localStorage.getItem('currentWorkspaceId');
        const savedWorkspace = workspaceData.find(w => w.id === savedWorkspaceId);

        const initialWorkspace = savedWorkspace || workspaceData[0];
        setCurrentWorkspace(initialWorkspace);

        const membership = membershipData.find((m: any) => m.workspace_id === initialWorkspace.id);
        if (membership) {
          setCurrentMembership({
            id: '',
            workspace_id: initialWorkspace.id,
            user_id: user.id,
            role: membership.role,
            invited_by: null,
            joined_at: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      console.error('Error fetching workspaces:', error);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [user]);

  useEffect(() => {
    if (currentWorkspace && user) {
      localStorage.setItem('currentWorkspaceId', currentWorkspace.id);

      supabase
        .rpc('get_user_workspaces', { user_uuid: user.id })
        .then(({ data }) => {
          if (data) {
            const membership = data.find((m: any) => m.workspace_id === currentWorkspace.id);
            if (membership) {
              setCurrentMembership({
                id: '',
                workspace_id: currentWorkspace.id,
                user_id: user.id,
                role: membership.role,
                invited_by: null,
                joined_at: new Date().toISOString(),
              });
            }
          }
        });
    }
  }, [currentWorkspace, user]);

  const value = {
    workspaces,
    currentWorkspace,
    currentMembership,
    loading,
    setCurrentWorkspace,
    refreshWorkspaces: fetchWorkspaces,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
