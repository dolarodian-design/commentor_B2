import { supabase } from './supabase';

export async function checkUserWorkspaces(userId: string): Promise<string | null> {
  const { data: workspaces } = await supabase
    .from('workspace_members')
    .select(`
      workspace_id,
      workspaces!inner(
        id,
        slug,
        updated_at
      )
    `)
    .eq('user_id', userId)
    .order('workspaces(updated_at)', { ascending: false })
    .limit(1);

  if (workspaces && workspaces.length > 0) {
    return `/dashboard`;
  }

  return null;
}

export async function getLastActiveWorkspace(userId: string) {
  const { data: membership } = await supabase
    .from('workspace_members')
    .select(`
      workspace_id,
      workspaces!inner(
        id,
        slug,
        name,
        updated_at
      )
    `)
    .eq('user_id', userId)
    .order('workspaces(updated_at)', { ascending: false })
    .limit(1)
    .maybeSingle();

  return membership?.workspaces;
}
