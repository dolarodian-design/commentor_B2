/*
  # Fix Workspace Members Infinite Recursion

  ## Issue
  The workspace_members policies were causing infinite recursion by querying
  workspace_members within the RLS policies for workspace_members.

  ## Solution
  Revert to using the helper functions (is_workspace_member, is_workspace_admin)
  which use SECURITY DEFINER to bypass RLS and prevent recursion, while still
  using (SELECT auth.uid()) for performance optimization.

  ## Tables Updated
  - workspace_members
*/

-- Drop existing workspace_members policies
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can join workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can update members" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.workspace_members;

-- Recreate policies using helper functions to avoid recursion
CREATE POLICY "Members can view workspace members"
  ON public.workspace_members
  FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id, (SELECT auth.uid())));

CREATE POLICY "Users can join workspaces"
  ON public.workspace_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR is_workspace_admin(workspace_id, (SELECT auth.uid()))
  );

CREATE POLICY "Admins can update members"
  ON public.workspace_members
  FOR UPDATE
  TO authenticated
  USING (is_workspace_admin(workspace_id, (SELECT auth.uid())));

CREATE POLICY "Admins can remove members"
  ON public.workspace_members
  FOR DELETE
  TO authenticated
  USING (is_workspace_admin(workspace_id, (SELECT auth.uid())));
