/*
  # CommentSync Core Database Schema

  ## Overview
  Creates the foundational database structure for CommentSync - a universal contextual 
  feedback platform that enables spatial commenting on any web application.

  ## New Tables
  
  ### 1. `profiles`
  Extended user profiles linked to auth.users
  - `id` (uuid, FK to auth.users)
  - `email` (text)
  - `full_name` (text)
  - `avatar_url` (text, optional)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 2. `workspaces`
  Organization/team workspaces for multi-tenant isolation
  - `id` (uuid, PK)
  - `name` (text)
  - `slug` (text, unique)
  - `owner_id` (uuid, FK to profiles)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 3. `workspace_members`
  Junction table for workspace membership with roles
  - `id` (uuid, PK)
  - `workspace_id` (uuid, FK to workspaces)
  - `user_id` (uuid, FK to profiles)
  - `role` (enum: admin, moderator, commenter, viewer)
  - `invited_by` (uuid, FK to profiles, optional)
  - `joined_at` (timestamptz)

  ### 4. `apps`
  Registered web applications/pages to collect feedback on
  - `id` (uuid, PK)
  - `workspace_id` (uuid, FK to workspaces)
  - `name` (text)
  - `base_url` (text)
  - `description` (text, optional)
  - `owner_id` (uuid, FK to profiles)
  - `is_active` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 5. `threads`
  Comment threads representing a discussion point
  - `id` (uuid, PK)
  - `app_id` (uuid, FK to apps)
  - `page_url` (text)
  - `dom_selector` (jsonb) - stores selector strategy and context
  - `position_data` (jsonb) - stores x, y coordinates and viewport info
  - `status` (enum: open, resolved, duplicate)
  - `resolved_at` (timestamptz, optional)
  - `resolved_by` (uuid, FK to profiles, optional)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 6. `comments`
  Individual comments within threads
  - `id` (uuid, PK)
  - `thread_id` (uuid, FK to threads)
  - `author_id` (uuid, FK to profiles)
  - `content` (text) - Markdown supported
  - `comment_type` (enum: bug, suggestion, question, approved, general)
  - `attachments` (jsonb) - array of attachment objects
  - `metadata` (jsonb) - browser info, console logs, etc.
  - `edited_at` (timestamptz, optional)
  - `created_at` (timestamptz)

  ### 7. `mentions`
  Track user mentions in comments
  - `id` (uuid, PK)
  - `comment_id` (uuid, FK to comments)
  - `mentioned_user_id` (uuid, FK to profiles)
  - `created_at` (timestamptz)

  ### 8. `reactions`
  Emoji reactions to comments
  - `id` (uuid, PK)
  - `comment_id` (uuid, FK to comments)
  - `user_id` (uuid, FK to profiles)
  - `emoji` (text)
  - `created_at` (timestamptz)

  ### 9. `integration_configs`
  Store integration settings per workspace
  - `id` (uuid, PK)
  - `workspace_id` (uuid, FK to workspaces)
  - `integration_type` (enum: jira, notion, github, slack, webhook)
  - `config_data` (jsonb) - encrypted tokens, mappings, etc.
  - `is_active` (boolean)
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### 10. `integration_syncs`
  Track sync operations with external tools
  - `id` (uuid, PK)
  - `comment_id` (uuid, FK to comments)
  - `integration_config_id` (uuid, FK to integration_configs)
  - `external_id` (text) - ID in external system
  - `external_url` (text, optional)
  - `sync_status` (enum: pending, synced, failed)
  - `sync_direction` (enum: outbound, inbound)
  - `error_message` (text, optional)
  - `last_synced_at` (timestamptz)
  - `created_at` (timestamptz)

  ### 11. `audit_logs`
  Complete audit trail for compliance
  - `id` (uuid, PK)
  - `workspace_id` (uuid, FK to workspaces)
  - `user_id` (uuid, FK to profiles)
  - `action` (text) - create, edit, delete, resolve, integrate, etc.
  - `resource_type` (text) - comment, thread, app, etc.
  - `resource_id` (uuid)
  - `changes` (jsonb) - JSON diff of changes
  - `ip_address` (inet, optional)
  - `user_agent` (text, optional)
  - `created_at` (timestamptz)

  ## Security
  - Row Level Security (RLS) enabled on all tables
  - Workspace-based isolation policies
  - Role-based access control for different permission levels
  - Audit logging for compliance requirements
*/

-- Create custom types
CREATE TYPE workspace_role AS ENUM ('admin', 'moderator', 'commenter', 'viewer');
CREATE TYPE thread_status AS ENUM ('open', 'resolved', 'duplicate');
CREATE TYPE comment_type AS ENUM ('bug', 'suggestion', 'question', 'approved', 'general');
CREATE TYPE integration_type AS ENUM ('jira', 'notion', 'github', 'slack', 'webhook');
CREATE TYPE sync_status AS ENUM ('pending', 'synced', 'failed');
CREATE TYPE sync_direction AS ENUM ('outbound', 'inbound');

-- Profiles table (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  owner_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Workspace members table
CREATE TABLE IF NOT EXISTS workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  role workspace_role DEFAULT 'commenter' NOT NULL,
  invited_by uuid REFERENCES profiles(id),
  joined_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(workspace_id, user_id)
);

-- Apps table
CREATE TABLE IF NOT EXISTS apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  base_url text NOT NULL,
  description text,
  owner_id uuid REFERENCES profiles(id) NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Threads table
CREATE TABLE IF NOT EXISTS threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid REFERENCES apps(id) ON DELETE CASCADE NOT NULL,
  page_url text NOT NULL,
  dom_selector jsonb NOT NULL,
  position_data jsonb NOT NULL,
  status thread_status DEFAULT 'open' NOT NULL,
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES threads(id) ON DELETE CASCADE NOT NULL,
  author_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  comment_type comment_type DEFAULT 'general' NOT NULL,
  attachments jsonb DEFAULT '[]'::jsonb NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
  edited_at timestamptz,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Mentions table
CREATE TABLE IF NOT EXISTS mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE NOT NULL,
  mentioned_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(comment_id, mentioned_user_id)
);

-- Reactions table
CREATE TABLE IF NOT EXISTS reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(comment_id, user_id, emoji)
);

-- Integration configs table
CREATE TABLE IF NOT EXISTS integration_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  integration_type integration_type NOT NULL,
  config_data jsonb DEFAULT '{}'::jsonb NOT NULL,
  is_active boolean DEFAULT true NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(workspace_id, integration_type)
);

-- Integration syncs table
CREATE TABLE IF NOT EXISTS integration_syncs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE NOT NULL,
  integration_config_id uuid REFERENCES integration_configs(id) ON DELETE CASCADE NOT NULL,
  external_id text NOT NULL,
  external_url text,
  sync_status sync_status DEFAULT 'pending' NOT NULL,
  sync_direction sync_direction DEFAULT 'outbound' NOT NULL,
  error_message text,
  last_synced_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id),
  action text NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  changes jsonb DEFAULT '{}'::jsonb NOT NULL,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_apps_workspace ON apps(workspace_id);
CREATE INDEX IF NOT EXISTS idx_threads_app ON threads(app_id);
CREATE INDEX IF NOT EXISTS idx_threads_status ON threads(status);
CREATE INDEX IF NOT EXISTS idx_comments_thread ON comments(thread_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_mentions_user ON mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_comment ON reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_integration_syncs_comment ON integration_syncs(comment_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace ON audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- Enable Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_syncs ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- RLS Policies for workspaces
CREATE POLICY "Users can view workspaces they are members of"
  ON workspaces FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create workspaces"
  ON workspaces FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Workspace owners can update their workspaces"
  ON workspaces FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Workspace owners can delete their workspaces"
  ON workspaces FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- RLS Policies for workspace_members
CREATE POLICY "Users can view members of their workspaces"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace admins can manage members"
  ON workspace_members FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = workspace_members.workspace_id
      AND wm.user_id = auth.uid()
      AND wm.role = 'admin'
    )
  );

-- RLS Policies for apps
CREATE POLICY "Workspace members can view apps"
  ON apps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = apps.workspace_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace admins and moderators can create apps"
  ON apps FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = apps.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "App owners and workspace admins can update apps"
  ON apps FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = owner_id OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = apps.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role = 'admin'
    )
  );

CREATE POLICY "App owners and workspace admins can delete apps"
  ON apps FOR DELETE
  TO authenticated
  USING (
    auth.uid() = owner_id OR
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = apps.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role = 'admin'
    )
  );

-- RLS Policies for threads
CREATE POLICY "Workspace members can view threads"
  ON threads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM apps
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE apps.id = threads.app_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can create threads"
  ON threads FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM apps
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE apps.id = threads.app_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('admin', 'moderator', 'commenter')
    )
  );

CREATE POLICY "Thread resolvers can update threads"
  ON threads FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM apps
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE apps.id = threads.app_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('admin', 'moderator')
    )
  );

-- RLS Policies for comments
CREATE POLICY "Workspace members can view comments"
  ON comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM threads
      JOIN apps ON apps.id = threads.app_id
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE threads.id = comments.thread_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can create comments"
  ON comments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM threads
      JOIN apps ON apps.id = threads.app_id
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE threads.id = comments.thread_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('admin', 'moderator', 'commenter')
    )
  );

CREATE POLICY "Comment authors can update own comments"
  ON comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Comment authors and moderators can delete comments"
  ON comments FOR DELETE
  TO authenticated
  USING (
    auth.uid() = author_id OR
    EXISTS (
      SELECT 1 FROM threads
      JOIN apps ON apps.id = threads.app_id
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE threads.id = comments.thread_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role IN ('admin', 'moderator')
    )
  );

-- RLS Policies for mentions
CREATE POLICY "Workspace members can view mentions"
  ON mentions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = mentioned_user_id OR
    EXISTS (
      SELECT 1 FROM comments
      JOIN threads ON threads.id = comments.thread_id
      JOIN apps ON apps.id = threads.app_id
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE comments.id = mentions.comment_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can create mentions"
  ON mentions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM comments
      JOIN threads ON threads.id = comments.thread_id
      JOIN apps ON apps.id = threads.app_id
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE comments.id = mentions.comment_id
      AND workspace_members.user_id = auth.uid()
    )
  );

-- RLS Policies for reactions
CREATE POLICY "Workspace members can view reactions"
  ON reactions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM comments
      JOIN threads ON threads.id = comments.thread_id
      JOIN apps ON apps.id = threads.app_id
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE comments.id = reactions.comment_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can create reactions"
  ON reactions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM comments
      JOIN threads ON threads.id = comments.thread_id
      JOIN apps ON apps.id = threads.app_id
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE comments.id = reactions.comment_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own reactions"
  ON reactions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for integration_configs
CREATE POLICY "Workspace admins can manage integration configs"
  ON integration_configs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = integration_configs.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role = 'admin'
    )
  );

-- RLS Policies for integration_syncs
CREATE POLICY "Workspace members can view integration syncs"
  ON integration_syncs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM comments
      JOIN threads ON threads.id = comments.thread_id
      JOIN apps ON apps.id = threads.app_id
      JOIN workspace_members ON workspace_members.workspace_id = apps.workspace_id
      WHERE comments.id = integration_syncs.comment_id
      AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage integration syncs"
  ON integration_syncs FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- RLS Policies for audit_logs
CREATE POLICY "Workspace admins can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = audit_logs.workspace_id
      AND workspace_members.user_id = auth.uid()
      AND workspace_members.role = 'admin'
    )
  );

CREATE POLICY "System can create audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on user signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_workspaces_updated_at BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_apps_updated_at BEFORE UPDATE ON apps
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_threads_updated_at BEFORE UPDATE ON threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_integration_configs_updated_at BEFORE UPDATE ON integration_configs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
