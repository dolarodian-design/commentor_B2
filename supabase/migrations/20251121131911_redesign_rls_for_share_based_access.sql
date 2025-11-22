/*
  # Redesign RLS for Share-Based Access Model

  ## Overview
  Completely redesign the access control to use a share-based model instead of
  workspace membership checks that cause infinite recursion.

  ## New Access Model
  1. Users own their workspaces, apps, and content
  2. Access is granted via share tokens (for public review links)
  3. Direct invitations create explicit access grants
  4. No recursive workspace membership checks in RLS

  ## New Tables
  - `app_access_tokens`: Share tokens for apps (generated links)
  - `app_collaborators`: Explicit user access to apps (via email invitation)

  ## Changes
  1. Drop all existing RLS policies that cause recursion
  2. Create new share token and collaborator tables
  3. Implement simple, non-recursive RLS policies
  4. Use owner checks and explicit access grants only
*/

-- First, create the new access control tables
CREATE TABLE IF NOT EXISTS public.app_access_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'base64'),
  access_level text NOT NULL DEFAULT 'reviewer' CHECK (access_level IN ('reviewer', 'commenter', 'editor')),
  expires_at timestamptz,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true
);

CREATE TABLE IF NOT EXISTS public.app_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid NOT NULL REFERENCES public.apps(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_level text NOT NULL DEFAULT 'commenter' CHECK (access_level IN ('viewer', 'commenter', 'moderator', 'admin')),
  invited_by uuid REFERENCES public.profiles(id),
  invited_at timestamptz DEFAULT now(),
  UNIQUE(app_id, user_id)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_app_access_tokens_app_id ON public.app_access_tokens(app_id);
CREATE INDEX IF NOT EXISTS idx_app_access_tokens_token ON public.app_access_tokens(token) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_app_collaborators_app_id ON public.app_collaborators(app_id);
CREATE INDEX IF NOT EXISTS idx_app_collaborators_user_id ON public.app_collaborators(user_id);

-- Enable RLS on new tables
ALTER TABLE public.app_access_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_collaborators ENABLE ROW LEVEL SECURITY;

-- Drop ALL existing problematic policies that check workspace membership
DROP POLICY IF EXISTS "Members can view workspace members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can join workspaces" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can update members" ON public.workspace_members;
DROP POLICY IF EXISTS "Admins can remove members" ON public.workspace_members;
DROP POLICY IF EXISTS "Users can view their workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Users can create workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can update workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Owners can delete workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "Workspace members can view apps" ON public.apps;
DROP POLICY IF EXISTS "Workspace admins and moderators can create apps" ON public.apps;
DROP POLICY IF EXISTS "App owners and workspace admins can update apps" ON public.apps;
DROP POLICY IF EXISTS "App owners and workspace admins can delete apps" ON public.apps;
DROP POLICY IF EXISTS "Workspace members can view threads" ON public.threads;
DROP POLICY IF EXISTS "Workspace members can create threads" ON public.threads;
DROP POLICY IF EXISTS "Thread resolvers can update threads" ON public.threads;
DROP POLICY IF EXISTS "Workspace members can view comments" ON public.comments;
DROP POLICY IF EXISTS "Workspace members can create comments" ON public.comments;
DROP POLICY IF EXISTS "Comment authors can update own comments" ON public.comments;
DROP POLICY IF EXISTS "Comment authors and moderators can delete comments" ON public.comments;

-- Create helper function to check app access without recursion
CREATE OR REPLACE FUNCTION public.has_app_access(app_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    -- Owner has access
    SELECT 1 FROM public.apps WHERE id = app_id_param AND owner_id = user_id_param
    UNION
    -- Explicit collaborator has access
    SELECT 1 FROM public.app_collaborators 
    WHERE app_id = app_id_param AND user_id = user_id_param
    UNION
    -- Workspace owner has access
    SELECT 1 FROM public.apps a
    JOIN public.workspaces w ON a.workspace_id = w.id
    WHERE a.id = app_id_param AND w.owner_id = user_id_param
  );
$$;

-- Simple RLS policies without recursion

-- WORKSPACES: Only owners and direct members
CREATE POLICY "Users can view their own workspaces"
  ON public.workspaces FOR SELECT
  TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can create workspaces"
  ON public.workspaces FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update their workspaces"
  ON public.workspaces FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can delete their workspaces"
  ON public.workspaces FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- WORKSPACE_MEMBERS: Simple owner-based access
CREATE POLICY "Owners can view workspace members"
  ON public.workspace_members FOR SELECT
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
    OR user_id = auth.uid()
  );

CREATE POLICY "Owners can manage workspace members"
  ON public.workspace_members FOR ALL
  TO authenticated
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
    )
  );

-- APPS: Owner, workspace owner, or collaborator access
CREATE POLICY "Users can view accessible apps"
  ON public.apps FOR SELECT
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    OR has_app_access(id, auth.uid())
  );

CREATE POLICY "Users can create apps in their workspaces"
  ON public.apps FOR INSERT
  TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT id FROM public.workspaces WHERE owner_id = auth.uid())
    AND owner_id = auth.uid()
  );

CREATE POLICY "App owners can update their apps"
  ON public.apps FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "App owners can delete their apps"
  ON public.apps FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- THREADS: Accessible if user has app access
CREATE POLICY "Users can view threads in accessible apps"
  ON public.threads FOR SELECT
  TO authenticated
  USING (has_app_access(app_id, auth.uid()));

CREATE POLICY "Users can create threads in accessible apps"
  ON public.threads FOR INSERT
  TO authenticated
  WITH CHECK (has_app_access(app_id, auth.uid()));

CREATE POLICY "Users can update threads in accessible apps"
  ON public.threads FOR UPDATE
  TO authenticated
  USING (has_app_access(app_id, auth.uid()));

-- COMMENTS: Accessible if user has app access via thread
CREATE POLICY "Users can view comments in accessible apps"
  ON public.comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.threads t
      WHERE t.id = thread_id AND has_app_access(t.app_id, auth.uid())
    )
  );

CREATE POLICY "Users can create comments in accessible apps"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.threads t
      WHERE t.id = thread_id AND has_app_access(t.app_id, auth.uid())
    )
  );

CREATE POLICY "Authors can update own comments"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "Authors can delete own comments"
  ON public.comments FOR DELETE
  TO authenticated
  USING (author_id = auth.uid());

-- APP_ACCESS_TOKENS: App owners can manage
CREATE POLICY "App owners can manage access tokens"
  ON public.app_access_tokens FOR ALL
  TO authenticated
  USING (
    app_id IN (SELECT id FROM public.apps WHERE owner_id = auth.uid())
  );

-- APP_COLLABORATORS: App owners can manage
CREATE POLICY "App owners can manage collaborators"
  ON public.app_collaborators FOR ALL
  TO authenticated
  USING (
    app_id IN (SELECT id FROM public.apps WHERE owner_id = auth.uid())
  );

CREATE POLICY "Users can view their own collaborator access"
  ON public.app_collaborators FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
