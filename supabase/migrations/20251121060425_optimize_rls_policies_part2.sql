/*
  # Optimize RLS Policies - Part 2: Comments, Mentions, Reactions

  ## Changes
  Optimizes RLS policies by wrapping auth.uid() calls with SELECT to prevent
  re-evaluation for each row, significantly improving query performance at scale.

  ## Tables Updated
  - comments
  - mentions
  - reactions
*/

-- Comments table policies
DROP POLICY IF EXISTS "Workspace members can view comments" ON public.comments;
CREATE POLICY "Workspace members can view comments"
  ON public.comments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM threads
      JOIN apps ON apps.id = threads.app_id
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE threads.id = comments.thread_id
      AND workspace_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Workspace members can create comments" ON public.comments;
CREATE POLICY "Workspace members can create comments"
  ON public.comments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM threads
      JOIN apps ON apps.id = threads.app_id
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE threads.id = comments.thread_id
      AND workspace_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Comment authors can update own comments" ON public.comments;
CREATE POLICY "Comment authors can update own comments"
  ON public.comments
  FOR UPDATE
  TO authenticated
  USING (author_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Comment authors and moderators can delete comments" ON public.comments;
CREATE POLICY "Comment authors and moderators can delete comments"
  ON public.comments
  FOR DELETE
  TO authenticated
  USING (
    author_id = (SELECT auth.uid())
    OR EXISTS (
      SELECT 1 FROM threads
      JOIN apps ON apps.id = threads.app_id
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE threads.id = comments.thread_id
      AND workspace_members.user_id = (SELECT auth.uid())
      AND workspace_members.role IN ('admin', 'moderator')
    )
  );

-- Mentions table policies
DROP POLICY IF EXISTS "Workspace members can view mentions" ON public.mentions;
CREATE POLICY "Workspace members can view mentions"
  ON public.mentions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM comments
      JOIN threads ON threads.id = comments.thread_id
      JOIN apps ON apps.id = threads.app_id
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE comments.id = mentions.comment_id
      AND workspace_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Workspace members can create mentions" ON public.mentions;
CREATE POLICY "Workspace members can create mentions"
  ON public.mentions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM comments
      JOIN threads ON threads.id = comments.thread_id
      JOIN apps ON apps.id = threads.app_id
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE comments.id = mentions.comment_id
      AND workspace_members.user_id = (SELECT auth.uid())
    )
  );

-- Reactions table policies
DROP POLICY IF EXISTS "Workspace members can view reactions" ON public.reactions;
CREATE POLICY "Workspace members can view reactions"
  ON public.reactions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM comments
      JOIN threads ON threads.id = comments.thread_id
      JOIN apps ON apps.id = threads.app_id
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE comments.id = reactions.comment_id
      AND workspace_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Workspace members can create reactions" ON public.reactions;
CREATE POLICY "Workspace members can create reactions"
  ON public.reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM comments
      JOIN threads ON threads.id = comments.thread_id
      JOIN apps ON apps.id = threads.app_id
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE comments.id = reactions.comment_id
      AND workspace_members.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own reactions" ON public.reactions;
CREATE POLICY "Users can delete own reactions"
  ON public.reactions
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));
