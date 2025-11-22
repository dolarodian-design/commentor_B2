/*
  # Optimize RLS Policies - Part 1: Profiles, Apps, Threads

  ## Changes
  Optimizes RLS policies by wrapping auth.uid() calls with SELECT to prevent
  re-evaluation for each row, significantly improving query performance at scale.

  ## Tables Updated
  - profiles
  - apps
  - threads
*/

-- Profiles table policies
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));

-- Apps table policies
DROP POLICY IF EXISTS "Workspace members can view apps" ON public.apps;
CREATE POLICY "Workspace members can view apps"
  ON public.apps
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = apps.workspace_id
      AND workspace_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Workspace admins and moderators can create apps" ON public.apps;
CREATE POLICY "Workspace admins and moderators can create apps"
  ON public.apps
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = apps.workspace_id
      AND workspace_members.user_id = (SELECT auth.uid())
      AND workspace_members.role IN ('admin', 'moderator')
    )
  );

DROP POLICY IF EXISTS "App owners and workspace admins can update apps" ON public.apps;
CREATE POLICY "App owners and workspace admins can update apps"
  ON public.apps
  FOR UPDATE
  TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = apps.workspace_id
      AND workspace_members.user_id = (SELECT auth.uid())
      AND workspace_members.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "App owners and workspace admins can delete apps" ON public.apps;
CREATE POLICY "App owners and workspace admins can delete apps"
  ON public.apps
  FOR DELETE
  TO authenticated
  USING (
    owner_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = apps.workspace_id
      AND workspace_members.user_id = (SELECT auth.uid())
      AND workspace_members.role = 'admin'
    )
  );

-- Threads table policies
DROP POLICY IF EXISTS "Workspace members can view threads" ON public.threads;
CREATE POLICY "Workspace members can view threads"
  ON public.threads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM apps
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE apps.id = threads.app_id
      AND workspace_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Workspace members can create threads" ON public.threads;
CREATE POLICY "Workspace members can create threads"
  ON public.threads
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM apps
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE apps.id = threads.app_id
      AND workspace_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Thread resolvers can update threads" ON public.threads;
CREATE POLICY "Thread resolvers can update threads"
  ON public.threads
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM apps
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE apps.id = threads.app_id
      AND workspace_members.user_id = (SELECT auth.uid())
      AND workspace_members.role IN ('admin', 'moderator')
    )
  );
