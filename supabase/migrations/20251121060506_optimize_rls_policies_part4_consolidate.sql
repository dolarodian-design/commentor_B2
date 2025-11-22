/*
  # Optimize RLS Policies - Part 4: App Invitations and Consolidation

  ## Changes
  1. Optimizes app_invitations RLS policies with SELECT wrappers
  2. Consolidates duplicate permissive policies into single policies
  
  ## Tables Updated
  - app_invitations (consolidate duplicate SELECT policies)
  - integration_syncs (consolidate duplicate SELECT policies)
*/

-- Drop existing app_invitations policies
DROP POLICY IF EXISTS "Users can view invitations they sent" ON public.app_invitations;
DROP POLICY IF EXISTS "Users can view invitations sent to them" ON public.app_invitations;
DROP POLICY IF EXISTS "Workspace members can create invitations" ON public.app_invitations;
DROP POLICY IF EXISTS "Users can update their invitations" ON public.app_invitations;

-- Create consolidated and optimized app_invitations policies
CREATE POLICY "Users can view their invitations"
  ON public.app_invitations
  FOR SELECT
  TO authenticated
  USING (
    inviter_id = (SELECT auth.uid())
    OR invitee_id = (SELECT auth.uid())
    OR invitee_email = (
      SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Workspace members can create invitations"
  ON public.app_invitations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    inviter_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM apps
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE apps.id = app_invitations.app_id
      AND workspace_members.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update their invitations"
  ON public.app_invitations
  FOR UPDATE
  TO authenticated
  USING (
    invitee_id = (SELECT auth.uid())
    OR invitee_email = (
      SELECT email FROM auth.users WHERE id = (SELECT auth.uid())
    )
  );

-- Drop the duplicate "System can manage integration syncs" policy
-- Keep only "Workspace members can view integration syncs"
DROP POLICY IF EXISTS "System can manage integration syncs" ON public.integration_syncs;

-- Recreate the system management policy with proper scoping
CREATE POLICY "System can manage integration syncs"
  ON public.integration_syncs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM integration_configs
      JOIN workspace_members ON workspace_members.workspace_id = integration_configs.workspace_id
      WHERE integration_configs.id = integration_syncs.integration_config_id
      AND workspace_members.user_id = (SELECT auth.uid())
      AND workspace_members.role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "System can update integration syncs"
  ON public.integration_syncs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM integration_configs
      JOIN workspace_members ON workspace_members.workspace_id = integration_configs.workspace_id
      WHERE integration_configs.id = integration_syncs.integration_config_id
      AND workspace_members.user_id = (SELECT auth.uid())
      AND workspace_members.role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "System can delete integration syncs"
  ON public.integration_syncs
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM integration_configs
      JOIN workspace_members ON workspace_members.workspace_id = integration_configs.workspace_id
      WHERE integration_configs.id = integration_syncs.integration_config_id
      AND workspace_members.user_id = (SELECT auth.uid())
      AND workspace_members.role IN ('admin', 'moderator')
    )
  );
