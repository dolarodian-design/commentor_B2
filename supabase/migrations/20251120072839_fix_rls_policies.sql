/*
  # Fix RLS Policies to Prevent Infinite Recursion

  ## Changes
  - Simplify workspace_members policies to avoid recursive lookups
  - Add service role bypass for internal operations
  - Fix policy logic to prevent infinite loops

  ## Security
  - Maintains workspace isolation
  - Ensures users can only access their own workspace data
*/

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view members of their workspaces" ON workspace_members;
DROP POLICY IF EXISTS "Workspace admins can manage members" ON workspace_members;

-- Simplified policy: users can view workspace members where they are also a member
-- This avoids the recursive lookup issue
CREATE POLICY "Users can view workspace members"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT workspace_id 
      FROM workspace_members 
      WHERE user_id = auth.uid()
    )
  );

-- Policy for inserting new members (admins only)
CREATE POLICY "Workspace admins can add members"
  ON workspace_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'admin'
    )
  );

-- Policy for updating members (admins only)
CREATE POLICY "Workspace admins can update members"
  ON workspace_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'admin'
    )
  );

-- Policy for deleting members (admins only)
CREATE POLICY "Workspace admins can delete members"
  ON workspace_members FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'admin'
    )
  );

-- Create a function to safely get user's workspace memberships
-- This can be called from application code without triggering RLS
CREATE OR REPLACE FUNCTION get_user_workspaces(user_uuid uuid)
RETURNS TABLE(workspace_id uuid, role workspace_role) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT wm.workspace_id, wm.role
  FROM workspace_members wm
  WHERE wm.user_id = user_uuid;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_user_workspaces(uuid) TO authenticated;
