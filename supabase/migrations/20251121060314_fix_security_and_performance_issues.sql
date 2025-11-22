/*
  # Fix Security and Performance Issues

  ## 1. Add Missing Foreign Key Indexes
  Adds indexes for all unindexed foreign keys to improve query performance:
  - apps.owner_id
  - audit_logs.user_id
  - integration_syncs.integration_config_id
  - reactions.user_id
  - threads.resolved_by
  - workspace_members.invited_by
  - workspaces.owner_id

  ## 2. Remove Duplicate and Unused Indexes
  Removes:
  - Duplicate index on integration_syncs
  - Unused indexes that are not being utilized

  ## 3. Fix Function Search Paths
  Sets explicit search paths for all functions to prevent security issues

  ## 4. Notes
  - RLS policy optimization will be done in a separate migration
  - Leaked password protection must be enabled in Supabase Dashboard
*/

-- Add missing foreign key indexes
CREATE INDEX IF NOT EXISTS idx_apps_owner_id ON public.apps(owner_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_syncs_config_id ON public.integration_syncs(integration_config_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON public.reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_threads_resolved_by ON public.threads(resolved_by);
CREATE INDEX IF NOT EXISTS idx_workspace_members_invited_by ON public.workspace_members(invited_by);
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON public.workspaces(owner_id);

-- Remove duplicate index (keep idx_integration_syncs_comment, drop idx_integration_syncs_comment_id)
DROP INDEX IF EXISTS public.idx_integration_syncs_comment_id;

-- Remove unused indexes
DROP INDEX IF EXISTS public.idx_comments_author;
DROP INDEX IF EXISTS public.idx_mentions_user;
DROP INDEX IF EXISTS public.idx_reactions_comment;
DROP INDEX IF EXISTS public.idx_audit_logs_workspace;
DROP INDEX IF EXISTS public.idx_audit_logs_created;
DROP INDEX IF EXISTS public.idx_app_invitations_app_id;
DROP INDEX IF EXISTS public.idx_app_invitations_invitee_email;
DROP INDEX IF EXISTS public.idx_app_invitations_inviter_id;
DROP INDEX IF EXISTS public.idx_app_invitations_invitee_id;
DROP INDEX IF EXISTS public.idx_integration_syncs_external_id;

-- Fix function search paths for security
ALTER FUNCTION public.handle_new_user() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp;
ALTER FUNCTION public.update_app_invitations_updated_at() SET search_path = public, pg_temp;
ALTER FUNCTION public.link_invitation_to_user() SET search_path = public, pg_temp;
