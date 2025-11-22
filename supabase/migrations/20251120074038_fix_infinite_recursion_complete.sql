/*
  # Complete Fix for RLS Infinite Recursion

  ## Problem
  - Workspaces table policy checks workspace_members
  - Workspace_members policies also check workspace_members
  - This creates infinite recursion

  ## Solution
  - Use a helper function with SECURITY DEFINER to bypass RLS
  - Simplify all policies to avoid recursive checks
  - Create direct, non-recursive policies

  ## Changes
  1. Drop all problematic policies
  2. Create helper functions that bypass RLS
  3. Recreate simple, non-recursive policies
*/

-- Drop all workspace_members policies
DROP POLICY IF EXISTS "Users can view workspace members" ON workspace_members;
DROP POLICY IF EXISTS "Workspace admins can add members" ON workspace_members;
DROP POLICY IF EXISTS "Workspace admins can update members" ON workspace_members;
DROP POLICY IF EXISTS "Workspace admins can delete members" ON workspace_members;

-- Drop all workspace policies
DROP POLICY IF EXISTS "Users can view workspaces they are members of" ON workspaces;
DROP POLICY IF EXISTS "Users can create workspaces" ON workspaces;
DROP POLICY IF EXISTS "Workspace owners can update their workspaces" ON workspaces;
DROP POLICY IF EXISTS "Workspace owners can delete their workspaces" ON workspaces;

-- Create function to check workspace membership without RLS
CREATE OR REPLACE FUNCTION is_workspace_member(workspace_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = workspace_uuid
    AND user_id = user_uuid
  );
$$;

-- Create function to check if user is workspace admin
CREATE OR REPLACE FUNCTION is_workspace_admin(workspace_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = workspace_uuid
    AND user_id = user_uuid
    AND role = 'admin'
  );
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION is_workspace_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_workspace_admin(uuid, uuid) TO authenticated;

-- Create simple workspace policies using helper functions
CREATE POLICY "Users can view their workspaces"
  ON workspaces FOR SELECT
  TO authenticated
  USING (is_workspace_member(id, auth.uid()));

CREATE POLICY "Users can create workspaces"
  ON workspaces FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update workspaces"
  ON workspaces FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can delete workspaces"
  ON workspaces FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Create simple workspace_members policies
-- These don't query workspace_members recursively anymore
CREATE POLICY "Members can view workspace members"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Users can join workspaces"
  ON workspace_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() OR
    is_workspace_admin(workspace_id, auth.uid())
  );

CREATE POLICY "Admins can update members"
  ON workspace_members FOR UPDATE
  TO authenticated
  USING (is_workspace_admin(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_admin(workspace_id, auth.uid()));

CREATE POLICY "Admins can remove members"
  ON workspace_members FOR DELETE
  TO authenticated
  USING (is_workspace_admin(workspace_id, auth.uid()));
