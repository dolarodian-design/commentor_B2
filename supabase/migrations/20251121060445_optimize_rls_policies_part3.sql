/*
  # Optimize RLS Policies - Part 3: Workspaces, Members, Integrations

  ## Changes
  Optimizes RLS policies by wrapping auth.uid() calls with SELECT to prevent
  re-evaluation for each row, significantly improving query performance at scale.

  ## Tables Updated
  - workspaces
  - workspace_members
  - integration_configs
  - integration_syncs
  - audit_logs
*/

-- Workspaces table policies
DROP POLICY IF EXISTS "Users can view their workspaces" ON public.workspaces;
CREATE POLICY "Users can view their workspaces"
  ON public.workspaces
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
      AND workspace_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create workspaces" ON public.workspaces;
CREATE POLICY "Users can create workspaces"
  ON public.workspaces
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Owners can update workspaces" ON public.workspaces;
CREATE POLICY "Owners can update workspaces"
  ON public.workspaces
  FOR UPDATE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Owners can delete workspaces" ON public.workspaces;
CREATE POLICY "Owners can delete workspaces"
  ON public.workspaces
  FOR DELETE
  TO authenticated
  USING (owner_id = (SELECT auth.uid()));

-- Workspace members table policies
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
CREATE POLICY "Members can view workspace members"
  ON public.workspace_members
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can join workspaces" ON public.workspace_members;
CREATE POLICY "Users can join workspaces"
  ON public.workspace_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspace_members.workspace_id
      AND workspace_members.user_id = (SELECT auth.uid())
      AND workspace_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update members" ON public.workspace_members;
CREATE POLICY "Admins can update members"
  ON public.workspace_members
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = (SELECT auth.uid())
      AND wm.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can remove members" ON public.workspace_members;
CREATE POLICY "Admins can remove members"
  ON public.workspace_members
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = (SELECT auth.uid())
      AND wm.role = 'admin'
    )
  );

-- Integration configs table policies
DROP POLICY IF EXISTS "Workspace admins can manage integration configs" ON public.integration_configs;
CREATE POLICY "Workspace admins can manage integration configs"
  ON public.integration_configs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = integration_configs.workspace_id
      AND workspace_members.user_id = (SELECT auth.uid())
      AND workspace_members.role = 'admin'
    )
  );

-- Integration syncs table policies
DROP POLICY IF EXISTS "Workspace members can view integration syncs" ON public.integration_syncs;
CREATE POLICY "Workspace members can view integration syncs"
  ON public.integration_syncs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM integration_configs
      JOIN workspace_members ON workspace_members.workspace_id = integration_configs.workspace_id
      WHERE integration_configs.id = integration_syncs.integration_config_id
      AND workspace_members.user_id = (SELECT auth.uid())
    )
  );

-- Audit logs table policies
DROP POLICY IF EXISTS "Workspace admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Workspace admins can view audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = audit_logs.workspace_id
      AND workspace_members.user_id = (SELECT auth.uid())
      AND workspace_members.role = 'admin'
    )
  );
