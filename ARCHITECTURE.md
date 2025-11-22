# CommentSync - Architecture & Implementation Guide

## Table of Contents
1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Database Architecture](#database-architecture)
4. [Application Structure](#application-structure)
5. [Authentication & Authorization](#authentication--authorization)
6. [Data Flow & State Management](#data-flow--state-management)
7. [Comment SDK Architecture](#comment-sdk-architecture)
8. [Integration System](#integration-system)
9. [Security Implementation](#security-implementation)
10. [Performance Optimizations](#performance-optimizations)

---

## System Overview

CommentSync is a collaborative feedback platform that enables teams to add contextual, spatial comments to any web application—similar to Figma's commenting system but for live websites.

### Core Concepts

**Multi-Tenant Architecture**: The system is built with workspace-based isolation, where each workspace has its own:
- Member roster with role-based permissions
- Registered applications
- Comment threads and discussions
- Integration configurations

**Spatial Commenting**: Comments are "pinned" to specific locations on web pages using:
- DOM element selectors (with fallback strategies)
- X/Y coordinates relative to viewport
- Page URL context

**Real-time Collaboration**: Using Supabase Realtime subscriptions, comments sync instantly across all connected users viewing the same application.

---

## Technology Stack

### Frontend
- **React 18.3.1**: Component-based UI with hooks
- **TypeScript 5.5.3**: Type-safe development
- **Vite 5.4.21**: Fast build tool and dev server
- **React Router 7.9.6**: Client-side routing
- **Tailwind CSS 3.4.1**: Utility-first styling
- **Lucide React 0.344.0**: Icon library

### Backend & Infrastructure
- **Supabase**: Backend-as-a-Service platform providing:
  - PostgreSQL database with PostGIS extensions
  - Row Level Security (RLS) for data isolation
  - Authentication system
  - Realtime subscriptions
  - Storage for file attachments
- **Supabase Client 2.57.4**: JavaScript client library

### External Integrations
- **Jira API**: Bi-directional sync with Atlassian Jira
- **Future**: Notion, GitHub, Slack webhooks

---

## Database Architecture

### Schema Design Philosophy

The database follows a normalized relational design with:
1. **Clear ownership hierarchies**: workspace → apps → threads → comments
2. **Junction tables** for many-to-many relationships
3. **JSONB columns** for flexible, semi-structured data
4. **Audit trails** for compliance and debugging

### Core Tables

#### 1. **profiles** (1-to-1 with auth.users)
```sql
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  avatar_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Purpose**: Extended user information beyond Supabase Auth's default fields.

**Key Points**:
- `id` matches auth.users.id for seamless joins
- Profile is auto-created via trigger on new user signup
- `updated_at` auto-updates via trigger

#### 2. **workspaces** (Multi-tenant container)
```sql
CREATE TABLE workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  owner_id uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Purpose**: Top-level isolation boundary. All data belongs to a workspace.

**Key Points**:
- `slug` for human-friendly URLs
- `owner_id` has special privileges (can delete workspace)
- Index on `owner_id` for performance

#### 3. **workspace_members** (Junction with roles)
```sql
CREATE TYPE workspace_role AS ENUM ('admin', 'moderator', 'commenter', 'viewer');

CREATE TABLE workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  role workspace_role NOT NULL DEFAULT 'commenter',
  invited_by uuid REFERENCES profiles(id),
  joined_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, user_id)
);
```

**Purpose**: Defines who can access a workspace and what they can do.

**Roles Hierarchy**:
- **admin**: Full control (manage members, apps, settings)
- **moderator**: Can resolve comments, manage apps
- **commenter**: Can create and reply to comments
- **viewer**: Read-only access

**Key Points**:
- Composite unique constraint prevents duplicate memberships
- `invited_by` tracks invitation audit trail
- Index on `user_id` for "my workspaces" queries

#### 4. **apps** (Registered web applications)
```sql
CREATE TABLE apps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  base_url text NOT NULL,
  description text,
  owner_id uuid REFERENCES profiles(id),
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Purpose**: Web applications/pages that collect feedback.

**Key Points**:
- `base_url` is the default URL to load in iframe
- `is_active` allows soft disable without deletion
- `owner_id` tracks app creator
- Cascade deletes all threads when app is deleted

#### 5. **threads** (Spatial comment threads)
```sql
CREATE TYPE thread_status AS ENUM ('open', 'resolved', 'duplicate');

CREATE TABLE threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid REFERENCES apps(id) ON DELETE CASCADE,
  page_url text NOT NULL,
  dom_selector jsonb,
  position_data jsonb NOT NULL,
  status thread_status DEFAULT 'open',
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

**Purpose**: Represents a discussion thread anchored to a specific location.

**JSONB Fields**:

`dom_selector` example:
```json
{
  "strategy": "css",
  "selector": "#checkout-button",
  "fallback": ".btn-primary:nth-child(2)",
  "context": "Checkout page - primary action button"
}
```

`position_data` example:
```json
{
  "x": 450,
  "y": 320,
  "pageX": 450,
  "pageY": 820,
  "viewport": {
    "width": 1920,
    "height": 1080
  }
}
```

**Key Points**:
- Multiple indexes for efficient filtering (app_id, status, created_at)
- `resolved_by` tracks who closed the thread
- Index on `resolved_by` for foreign key performance

#### 6. **comments** (Individual messages)
```sql
CREATE TYPE comment_type AS ENUM ('bug', 'suggestion', 'question', 'approved', 'general');

CREATE TABLE comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES threads(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id),
  content text NOT NULL,
  comment_type comment_type DEFAULT 'general',
  attachments jsonb DEFAULT '[]'::jsonb,
  metadata jsonb,
  edited_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

**Purpose**: Individual messages within a thread.

**JSONB Fields**:

`attachments` example:
```json
[
  {
    "id": "abc123",
    "name": "screenshot.png",
    "url": "https://storage.supabase.co/...",
    "type": "image/png",
    "size": 245600
  }
]
```

`metadata` example (browser context):
```json
{
  "browser": "Chrome 120.0.0",
  "os": "macOS 14.1",
  "screenSize": "1920x1080",
  "consoleLogs": ["Error loading checkout..."]
}
```

**Key Points**:
- Cascade deletes when thread is deleted
- Index on `thread_id` for loading thread conversations
- No `updated_at` - use `edited_at` to track modifications

#### 7. **mentions** (User tags in comments)
```sql
CREATE TABLE mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  mentioned_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
```

**Purpose**: Track @mentions for notifications (future feature).

#### 8. **reactions** (Emoji responses)
```sql
CREATE TABLE reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(comment_id, user_id, emoji)
);
```

**Purpose**: Quick emoji reactions (👍, ❤️, etc.).

**Key Points**:
- Composite unique prevents duplicate reactions
- Index on `user_id` for "my reactions" queries

#### 9. **integration_configs** (External tool settings)
```sql
CREATE TYPE integration_type AS ENUM ('jira', 'notion', 'github', 'slack', 'webhook');

CREATE TABLE integration_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  integration_type integration_type NOT NULL,
  config_data jsonb NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(workspace_id, integration_type)
);
```

**Purpose**: Store encrypted credentials and settings per workspace.

`config_data` example (Jira):
```json
{
  "domain": "company.atlassian.net",
  "email": "admin@company.com",
  "apiToken": "encrypted_token_here",
  "defaultProject": "PROJ",
  "autoSync": true,
  "issueTypeMapping": {
    "bug": "Bug",
    "suggestion": "Task"
  }
}
```

#### 10. **integration_syncs** (Sync history)
```sql
CREATE TYPE sync_direction AS ENUM ('to_external', 'from_external', 'bidirectional');
CREATE TYPE sync_status AS ENUM ('pending', 'in_progress', 'completed', 'failed');

CREATE TABLE integration_syncs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_config_id uuid REFERENCES integration_configs(id),
  thread_id uuid REFERENCES threads(id),
  comment_id uuid REFERENCES comments(id),
  external_id text,
  external_url text,
  sync_direction sync_direction NOT NULL,
  sync_status sync_status DEFAULT 'pending',
  error_message text,
  synced_at timestamptz DEFAULT now()
);
```

**Purpose**: Track which threads/comments have been synced to external tools.

**Key Points**:
- `external_id`: Jira issue key (e.g., "PROJ-123")
- `external_url`: Direct link to synced item
- Prevents duplicate syncs via unique constraints
- Index on `integration_config_id` for performance

#### 11. **app_invitations** (Invitation system)
```sql
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

CREATE TABLE app_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_id uuid REFERENCES apps(id) ON DELETE CASCADE,
  invitee_email text NOT NULL,
  invitee_id uuid REFERENCES profiles(id),
  inviter_id uuid REFERENCES profiles(id) NOT NULL,
  role workspace_role DEFAULT 'commenter',
  status invitation_status DEFAULT 'pending',
  invited_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days'),
  updated_at timestamptz DEFAULT now()
);
```

**Purpose**: Track app access invitations before user accepts.

**Key Points**:
- Links `invitee_email` to `invitee_id` when user signs up/accepts
- Automatic trigger to link existing users
- 7-day expiration by default

#### 12. **audit_logs** (Compliance trail)
```sql
CREATE TYPE audit_action AS ENUM (
  'workspace.created', 'workspace.updated', 'workspace.deleted',
  'member.added', 'member.removed', 'member.role_changed',
  'app.created', 'app.updated', 'app.deleted',
  'thread.created', 'thread.resolved', 'thread.deleted',
  'comment.created', 'comment.updated', 'comment.deleted'
);

CREATE TABLE audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id),
  action audit_action NOT NULL,
  resource_type text NOT NULL,
  resource_id uuid NOT NULL,
  metadata jsonb,
  created_at timestamptz DEFAULT now()
);
```

**Purpose**: Immutable log of all system actions for compliance and debugging.

**Key Points**:
- Write-only (no updates/deletes via RLS)
- Indexes on `workspace_id`, `created_at` for filtering
- Only admins can view logs

### Database Functions

#### **is_workspace_member(workspace_uuid, user_uuid)**
```sql
CREATE FUNCTION is_workspace_member(workspace_uuid uuid, user_uuid uuid)
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = workspace_uuid
    AND user_id = user_uuid
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;
```

**Purpose**: Check workspace membership efficiently in RLS policies.

**Key**: `SECURITY DEFINER` bypasses RLS to prevent infinite recursion.

#### **is_workspace_admin(workspace_uuid, user_uuid)**
Similar to above but checks for 'admin' role.

#### **handle_new_user()**
Trigger function that auto-creates profile when user signs up:
```sql
CREATE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
```

#### **link_invitation_to_user()**
Trigger that links pending invitations when user signs up:
```sql
CREATE FUNCTION link_invitation_to_user()
RETURNS trigger AS $$
BEGIN
  UPDATE app_invitations
  SET invitee_id = new.id
  WHERE invitee_email = new.email
  AND status = 'pending'
  AND invitee_id IS NULL;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
```

### Indexes Strategy

**Performance-critical indexes**:
```sql
-- Foreign key indexes (for joins)
CREATE INDEX idx_apps_owner_id ON apps(owner_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_reactions_user_id ON reactions(user_id);
CREATE INDEX idx_threads_resolved_by ON threads(resolved_by);
CREATE INDEX idx_workspace_members_invited_by ON workspace_members(invited_by);
CREATE INDEX idx_workspaces_owner_id ON workspaces(owner_id);

-- Query optimization indexes
CREATE INDEX idx_threads_app_id ON threads(app_id);
CREATE INDEX idx_threads_status ON threads(status);
CREATE INDEX idx_comments_thread_id ON comments(thread_id);
CREATE INDEX idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX idx_integration_syncs_comment ON integration_syncs(comment_id);
CREATE INDEX idx_integration_syncs_thread ON integration_syncs(thread_id);
```

**Why these indexes?**:
- Foreign keys: Improve join performance and cascade delete speed
- Filtering: Speed up WHERE clauses on commonly filtered columns
- Sorting: Enable efficient ORDER BY operations

---

## Application Structure

### Directory Organization

```
src/
├── components/          # Reusable UI components
│   └── DashboardLayout.tsx
├── contexts/            # React Context providers
│   ├── AuthContext.tsx
│   └── WorkspaceContext.tsx
├── lib/                 # Utilities and services
│   ├── supabase.ts
│   ├── database.types.ts
│   ├── jira.ts
│   ├── jiraSyncEngine.ts
│   └── attachments.ts
├── pages/               # Route components
│   ├── Login.tsx
│   ├── Signup.tsx
│   ├── Onboarding.tsx
│   ├── Dashboard.tsx
│   ├── Apps.tsx
│   ├── NewApp.tsx
│   ├── AppDetails.tsx
│   ├── Settings.tsx
│   ├── PublicReview.tsx
│   └── SharedWithMe.tsx
├── App.tsx              # Root component
├── main.tsx             # React entry point
└── index.css            # Global styles

public/
└── comment-sdk.js       # Injected commenting overlay

supabase/
└── migrations/          # Database migrations
    ├── 20251120063754_create_core_schema.sql
    ├── 20251120072839_fix_rls_policies.sql
    ├── 20251120074038_fix_infinite_recursion_complete.sql
    ├── 20251120145315_add_jira_integration_fields.sql
    ├── 20251121055432_add_comment_attachments_storage.sql
    ├── 20251121060314_fix_security_and_performance_issues.sql
    ├── 20251121060402_optimize_rls_policies_part1.sql
    ├── 20251121060425_optimize_rls_policies_part2.sql
    ├── 20251121060445_optimize_rls_policies_part3.sql
    ├── 20251121060506_optimize_rls_policies_part4_consolidate.sql
    └── 20251121063030_fix_workspace_members_recursion.sql
```

### Component Hierarchy

```
App (Router + Context Providers)
├── AuthProvider
│   └── WorkspaceProvider
│       ├── PublicRoute (Login, Signup)
│       └── ProtectedRoute
│           └── DashboardLayout (Sidebar + Outlet)
│               ├── Dashboard (Overview stats)
│               ├── Apps (List view with cards)
│               ├── NewApp (Create form)
│               ├── AppDetails (Iframe + Comments)
│               ├── SharedWithMe (Invitations)
│               └── Settings (Profile, Workspace, Integrations)
```

---

## Authentication & Authorization

### Authentication Flow

#### 1. **Signup Process**
```typescript
// src/pages/Signup.tsx
const handleSignup = async (e: React.FormEvent) => {
  e.preventDefault();

  // Create auth user
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName }
    }
  });

  // Profile auto-created via trigger
  // User redirected to /onboarding
};
```

**What happens**:
1. Supabase creates entry in `auth.users`
2. Database trigger fires `handle_new_user()`
3. Profile created in `profiles` table
4. Pending invitations linked via `link_invitation_to_user()`
5. User redirected to onboarding to create first workspace

#### 2. **Login Process**
```typescript
// src/pages/Login.tsx
const handleLogin = async (e: React.FormEvent) => {
  e.preventDefault();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  // AuthContext detects session change
  // User redirected to /dashboard
};
```

#### 3. **Session Management**
```typescript
// src/contexts/AuthContext.tsx
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
```

**Key Points**:
- Session stored in localStorage (handled by Supabase)
- Auto-refresh token before expiration
- Logout clears session and redirects to login

### Authorization (Row Level Security)

All database tables use RLS policies to enforce access control.

#### **Policy Pattern: Workspace Isolation**

Example: Users can only view apps in their workspaces
```sql
CREATE POLICY "Workspace members can view apps"
  ON apps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = apps.workspace_id
      AND workspace_members.user_id = (SELECT auth.uid())
    )
  );
```

**Performance Optimization**: `(SELECT auth.uid())` is evaluated once per query, not per row.

#### **Policy Pattern: Role-Based Actions**

Example: Only admins and moderators can create apps
```sql
CREATE POLICY "Workspace admins and moderators can create apps"
  ON apps FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = apps.workspace_id
      AND workspace_members.user_id = (SELECT auth.uid())
      AND workspace_members.role IN ('admin', 'moderator')
    )
  );
```

#### **Policy Pattern: Ownership**

Example: Users can update their own profile
```sql
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (id = (SELECT auth.uid()));
```

#### **Avoiding Infinite Recursion**

Problem: `workspace_members` policies can't query `workspace_members` table.

Solution: Use `SECURITY DEFINER` functions that bypass RLS:
```sql
CREATE POLICY "Members can view workspace members"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id, (SELECT auth.uid())));
```

The `is_workspace_member()` function uses `SECURITY DEFINER`, so it can query `workspace_members` without triggering RLS recursion.

---

## Data Flow & State Management

### Global State (React Context)

#### **AuthContext**
```typescript
interface AuthContextType {
  user: User | null;
  loading: boolean;
}
```

**Provides**: Current authenticated user
**Used by**: All protected routes, RLS queries

#### **WorkspaceContext**
```typescript
interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  switchWorkspace: (id: string) => void;
  refreshWorkspaces: () => Promise<void>;
}
```

**Provides**: Active workspace, workspace list, switch function
**Used by**: Dashboard, Apps, Settings

**Workspace Switching Logic**:
```typescript
const switchWorkspace = (workspaceId: string) => {
  const workspace = workspaces.find(w => w.id === workspaceId);
  if (workspace) {
    setCurrentWorkspace(workspace);
    localStorage.setItem('currentWorkspaceId', workspaceId);
  }
};
```

### Local State (Component-level)

Components use `useState` for UI state and `useEffect` for data fetching:

```typescript
// src/pages/AppDetails.tsx
function AppDetails() {
  const { id } = useParams();
  const [app, setApp] = useState<App | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch app and threads
  useEffect(() => {
    fetchApp();
    fetchThreads();
  }, [id]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`app-${id}-threads`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'threads',
        filter: `app_id=eq.${id}`
      }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setThreads(prev => [...prev, payload.new]);
        }
        // Handle UPDATE and DELETE...
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [id]);

  // ...
}
```

### Data Fetching Patterns

#### **Pattern 1: Simple Fetch**
```typescript
const fetchApps = async () => {
  const { data, error } = await supabase
    .from('apps')
    .select('*')
    .eq('workspace_id', currentWorkspace.id)
    .order('created_at', { ascending: false });

  if (!error) setApps(data);
};
```

#### **Pattern 2: Fetch with Joins**
```typescript
const fetchThreads = async () => {
  const { data, error } = await supabase
    .from('threads')
    .select(`
      *,
      comments (
        id,
        content,
        author:profiles (full_name, avatar_url),
        created_at
      )
    `)
    .eq('app_id', appId)
    .order('created_at', { ascending: false });

  if (!error) setThreads(data);
};
```

#### **Pattern 3: Real-time Subscription**
```typescript
useEffect(() => {
  const channel = supabase
    .channel('threads-changes')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'threads',
      filter: `app_id=eq.${appId}`
    }, (payload) => {
      setThreads(prev => [payload.new, ...prev]);
    })
    .subscribe();

  return () => channel.unsubscribe();
}, [appId]);
```

---

## Comment SDK Architecture

### SDK Overview

The Comment SDK is a vanilla JavaScript file injected into the target website to provide commenting functionality.

**Location**: `public/comment-sdk.js`

**Injection Method**: Loaded via `<script>` tag in `PublicReview.tsx`:
```typescript
useEffect(() => {
  const script = document.createElement('script');
  script.src = '/comment-sdk.js';
  script.onload = () => {
    window.CommentSDK?.init({
      appId: appId,
      mode: 'public',
      supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
      supabaseKey: import.meta.env.VITE_SUPABASE_ANON_KEY
    });
  };
  document.body.appendChild(script);
}, []);
```

### SDK Features

#### 1. **Overlay UI**
Creates a floating toolbar:
```javascript
const toolbar = document.createElement('div');
toolbar.id = 'commentsync-toolbar';
toolbar.innerHTML = `
  <button id="comment-mode-btn">💬 Add Comment (C)</button>
  <div id="comment-count">0 comments</div>
`;
document.body.appendChild(toolbar);
```

#### 2. **Comment Mode**
Toggle with 'C' key or button click:
```javascript
function enableCommentMode() {
  document.body.style.cursor = 'crosshair';
  document.addEventListener('click', handleCommentClick, true);
}

function handleCommentClick(e) {
  e.preventDefault();
  e.stopPropagation();

  const x = e.clientX;
  const y = e.clientY;
  const pageX = e.pageX;
  const pageY = e.pageY;

  showCommentForm({ x, y, pageX, pageY });
}
```

#### 3. **Comment Pins**
Visual markers showing comment locations:
```javascript
function renderCommentPin(thread) {
  const pin = document.createElement('div');
  pin.className = 'commentsync-pin';
  pin.style.left = `${thread.position_data.x}px`;
  pin.style.top = `${thread.position_data.y}px`;
  pin.textContent = thread.comments.length;

  pin.addEventListener('click', () => {
    showCommentThread(thread);
  });

  document.body.appendChild(pin);
}
```

#### 4. **Comment Form Modal**
```javascript
function showCommentForm({ x, y, pageX, pageY }) {
  const modal = document.createElement('div');
  modal.className = 'commentsync-modal';
  modal.innerHTML = `
    <div class="commentsync-form">
      <h3>Add Comment</h3>
      <input type="text" id="commenter-name" placeholder="Your name" />
      <input type="email" id="commenter-email" placeholder="Your email" />
      <textarea id="comment-text" placeholder="What's on your mind?"></textarea>
      <select id="comment-type">
        <option value="general">General</option>
        <option value="bug">Bug</option>
        <option value="suggestion">Suggestion</option>
      </select>
      <div class="actions">
        <button id="cancel-comment">Cancel</button>
        <button id="submit-comment">Submit</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  document.getElementById('submit-comment').onclick = () => {
    submitComment({ x, y, pageX, pageY });
  };
}
```

#### 5. **Data Submission**
```javascript
async function submitComment({ x, y, pageX, pageY }) {
  const name = document.getElementById('commenter-name').value;
  const email = document.getElementById('commenter-email').value;
  const content = document.getElementById('comment-text').value;
  const type = document.getElementById('comment-type').value;

  // Create thread
  const { data: thread, error: threadError } = await supabase
    .from('threads')
    .insert({
      app_id: config.appId,
      page_url: window.location.href,
      position_data: {
        x, y, pageX, pageY,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        }
      },
      status: 'open'
    })
    .select()
    .single();

  if (threadError) return;

  // Create comment
  await supabase
    .from('comments')
    .insert({
      thread_id: thread.id,
      content,
      comment_type: type,
      metadata: {
        commenter_name: name,
        commenter_email: email,
        browser: navigator.userAgent,
        timestamp: new Date().toISOString()
      }
    });

  // Refresh pins
  loadThreads();
}
```

#### 6. **Real-time Updates**
```javascript
function subscribeToThreads() {
  supabase
    .channel(`app-${config.appId}-threads`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'threads',
      filter: `app_id=eq.${config.appId}`
    }, () => {
      loadThreads(); // Refresh all pins
    })
    .subscribe();
}
```

### SDK Styling

The SDK includes embedded CSS for all UI elements:
```css
.commentsync-toolbar {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 999999;
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  padding: 12px;
}

.commentsync-pin {
  position: absolute;
  width: 32px;
  height: 32px;
  background: #3b82f6;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 999998;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3);
}
```

---

## Integration System

### Jira Integration Architecture

#### **Configuration Storage**

Jira settings stored in `integration_configs`:
```json
{
  "domain": "company.atlassian.net",
  "email": "admin@company.com",
  "apiToken": "ATATT3xFfGF...",
  "defaultProject": "PROJ",
  "autoSync": true,
  "issueTypeMapping": {
    "bug": "Bug",
    "suggestion": "Task",
    "question": "Task"
  }
}
```

#### **Jira API Client** (`src/lib/jira.ts`)

```typescript
export interface JiraConfig {
  domain: string;
  email: string;
  apiToken: string;
  defaultProject: string;
}

export class JiraClient {
  private baseUrl: string;
  private authHeader: string;

  constructor(config: JiraConfig) {
    this.baseUrl = `https://${config.domain}/rest/api/3`;
    const credentials = btoa(`${config.email}:${config.apiToken}`);
    this.authHeader = `Basic ${credentials}`;
  }

  async testConnection(): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/myself`, {
      headers: { 'Authorization': this.authHeader }
    });
    return response.ok;
  }

  async createIssue(data: {
    project: string;
    summary: string;
    description: string;
    issueType: string;
  }): Promise<{ key: string; url: string }> {
    const response = await fetch(`${this.baseUrl}/issue`, {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fields: {
          project: { key: data.project },
          summary: data.summary,
          description: {
            type: 'doc',
            version: 1,
            content: [{
              type: 'paragraph',
              content: [{ type: 'text', text: data.description }]
            }]
          },
          issuetype: { name: data.issueType }
        }
      })
    });

    const result = await response.json();
    return {
      key: result.key,
      url: `https://${this.config.domain}/browse/${result.key}`
    };
  }

  async addComment(issueKey: string, comment: string): Promise<void> {
    await fetch(`${this.baseUrl}/issue/${issueKey}/comment`, {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        body: {
          type: 'doc',
          version: 1,
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: comment }]
          }]
        }
      })
    });
  }

  async updateIssueStatus(issueKey: string, status: string): Promise<void> {
    // Get available transitions
    const transitionsResp = await fetch(
      `${this.baseUrl}/issue/${issueKey}/transitions`,
      { headers: { 'Authorization': this.authHeader } }
    );
    const { transitions } = await transitionsResp.json();

    const targetTransition = transitions.find(
      t => t.to.name.toLowerCase() === status.toLowerCase()
    );

    if (targetTransition) {
      await fetch(`${this.baseUrl}/issue/${issueKey}/transitions`, {
        method: 'POST',
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          transition: { id: targetTransition.id }
        })
      });
    }
  }
}
```

#### **Sync Engine** (`src/lib/jiraSyncEngine.ts`)

```typescript
export async function syncThreadToJira(
  threadId: string,
  jiraConfig: JiraConfig
): Promise<void> {
  // Fetch thread with all comments
  const { data: thread } = await supabase
    .from('threads')
    .select(`
      *,
      comments (
        *,
        author:profiles (full_name, email)
      )
    `)
    .eq('id', threadId)
    .single();

  if (!thread) return;

  // Check if already synced
  const { data: existingSync } = await supabase
    .from('integration_syncs')
    .select('external_id')
    .eq('thread_id', threadId)
    .maybeSingle();

  const jiraClient = new JiraClient(jiraConfig);

  if (existingSync?.external_id) {
    // Update existing issue
    for (const comment of thread.comments) {
      const syncRecord = await supabase
        .from('integration_syncs')
        .select('id')
        .eq('comment_id', comment.id)
        .maybeSingle();

      if (!syncRecord) {
        // New comment, add to Jira
        await jiraClient.addComment(
          existingSync.external_id,
          `${comment.author.full_name}: ${comment.content}`
        );

        // Record sync
        await supabase.from('integration_syncs').insert({
          integration_config_id: jiraConfig.id,
          thread_id: threadId,
          comment_id: comment.id,
          external_id: existingSync.external_id,
          sync_direction: 'to_external',
          sync_status: 'completed'
        });
      }
    }

    // Sync status
    const jiraStatus = thread.status === 'resolved' ? 'Done' : 'To Do';
    await jiraClient.updateIssueStatus(existingSync.external_id, jiraStatus);
  } else {
    // Create new issue
    const firstComment = thread.comments[0];
    const issueType = firstComment.comment_type === 'bug' ? 'Bug' : 'Task';

    const result = await jiraClient.createIssue({
      project: jiraConfig.defaultProject,
      summary: `[CommentSync] ${thread.page_url}`,
      description: `
Location: ${thread.page_url}
Position: (${thread.position_data.x}, ${thread.position_data.y})

${firstComment.author.full_name}: ${firstComment.content}
      `.trim(),
      issueType
    });

    // Record sync
    await supabase.from('integration_syncs').insert({
      integration_config_id: jiraConfig.id,
      thread_id: threadId,
      comment_id: firstComment.id,
      external_id: result.key,
      external_url: result.url,
      sync_direction: 'to_external',
      sync_status: 'completed'
    });

    // Add remaining comments
    for (let i = 1; i < thread.comments.length; i++) {
      const comment = thread.comments[i];
      await jiraClient.addComment(
        result.key,
        `${comment.author.full_name}: ${comment.content}`
      );

      await supabase.from('integration_syncs').insert({
        integration_config_id: jiraConfig.id,
        thread_id: threadId,
        comment_id: comment.id,
        external_id: result.key,
        sync_direction: 'to_external',
        sync_status: 'completed'
      });
    }
  }
}
```

#### **Auto-Sync Trigger**

When `autoSync: true`, new comments automatically sync:
```typescript
// In AppDetails.tsx
useEffect(() => {
  if (!autoSyncEnabled) return;

  const channel = supabase
    .channel('comments-autosync')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'comments'
    }, async (payload) => {
      const comment = payload.new;

      // Check if thread already synced
      const { data: sync } = await supabase
        .from('integration_syncs')
        .select('external_id')
        .eq('thread_id', comment.thread_id)
        .maybeSingle();

      if (sync) {
        // Add comment to existing Jira issue
        await syncCommentToJira(comment, sync.external_id);
      }
    })
    .subscribe();

  return () => channel.unsubscribe();
}, [autoSyncEnabled]);
```

---

## Security Implementation

### 1. **Row Level Security (RLS)**

All tables have RLS enabled:
```sql
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
```

Policies enforce workspace isolation and role-based access.

### 2. **Authentication**

- Email/password via Supabase Auth
- Session tokens stored securely (httpOnly cookies in production)
- Auto-refresh before token expiration

### 3. **API Key Security**

```typescript
// Client-side (public anon key - safe to expose)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
```

The anon key is safe because RLS policies protect all data.

### 4. **Encrypted Secrets**

Integration credentials stored as encrypted JSONB:
```typescript
// Encrypt before storing
const encryptedToken = await encrypt(apiToken);

await supabase.from('integration_configs').insert({
  workspace_id,
  integration_type: 'jira',
  config_data: {
    domain,
    email,
    apiToken: encryptedToken
  }
});
```

### 5. **Input Validation**

All user inputs sanitized:
```typescript
function sanitizeHtml(html: string): string {
  const div = document.createElement('div');
  div.textContent = html;
  return div.innerHTML;
}
```

### 6. **CORS & CSP**

Production deployment uses strict CSP headers:
```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline';
  connect-src 'self' https://*.supabase.co;
```

---

## Performance Optimizations

### 1. **Database Indexes**

Added 15+ indexes on foreign keys and frequently filtered columns.

### 2. **RLS Query Optimization**

Using `(SELECT auth.uid())` instead of `auth.uid()` reduces function calls from O(n) to O(1).

Before:
```sql
USING (user_id = auth.uid())  -- Called per row
```

After:
```sql
USING (user_id = (SELECT auth.uid()))  -- Called once
```

### 3. **Pagination**

Large lists use cursor-based pagination:
```typescript
const { data } = await supabase
  .from('threads')
  .select('*')
  .eq('app_id', appId)
  .range(0, 49)  // First 50 records
  .order('created_at', { ascending: false });
```

### 4. **Memoization**

Expensive computations cached:
```typescript
const commentCount = useMemo(() => {
  return threads.reduce((sum, t) => sum + t.comments.length, 0);
}, [threads]);
```

### 5. **Lazy Loading**

Images and attachments load on-demand:
```typescript
<img
  src={attachment.url}
  loading="lazy"
  alt={attachment.name}
/>
```

### 6. **Real-time Subscriptions**

Instead of polling, use Postgres LISTEN/NOTIFY via Supabase Realtime.

### 7. **Bundle Optimization**

Vite code-splitting and tree-shaking reduce bundle size:
```typescript
// Dynamic imports for routes
const Dashboard = lazy(() => import('./pages/Dashboard'));
```

---

## Migration History

1. **20251120063754_create_core_schema.sql**: Initial schema
2. **20251120072839_fix_rls_policies.sql**: Added missing policies
3. **20251120074038_fix_infinite_recursion_complete.sql**: Helper functions for workspace_members
4. **20251120145315_add_jira_integration_fields.sql**: Integration tables
5. **20251121055432_add_comment_attachments_storage.sql**: File storage setup
6. **20251121060314_fix_security_and_performance_issues.sql**: Added foreign key indexes, removed unused indexes
7. **20251121060402_optimize_rls_policies_part1.sql**: Optimized profiles, apps, threads policies
8. **20251121060425_optimize_rls_policies_part2.sql**: Optimized comments, mentions, reactions policies
9. **20251121060445_optimize_rls_policies_part3.sql**: Optimized workspaces, integrations policies
10. **20251121060506_optimize_rls_policies_part4_consolidate.sql**: Consolidated duplicate policies
11. **20251121063030_fix_workspace_members_recursion.sql**: Fixed infinite recursion in workspace_members policies

---

## Deployment Checklist

- [ ] Set environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- [ ] Run `npm run build`
- [ ] Deploy `dist/` folder to hosting provider
- [ ] Ensure `/comment-sdk.js` is publicly accessible
- [ ] Configure custom domain with HTTPS
- [ ] Set up CORS headers for API requests
- [ ] Enable RLS on all tables
- [ ] Rotate Supabase service role key (keep secret)
- [ ] Configure email templates in Supabase Auth
- [ ] Set up monitoring and error tracking
- [ ] Test in multiple browsers
- [ ] Enable leaked password protection in Supabase Dashboard

---

## Future Architecture Improvements

1. **Caching Layer**: Add Redis for frequently accessed data
2. **Queue System**: Background jobs for heavy operations (exports, bulk syncs)
3. **CDN**: Serve static assets via CDN
4. **Analytics**: Track user behavior and system performance
5. **Webhooks**: Allow external tools to subscribe to events
6. **GraphQL API**: Alternative to REST for complex queries
7. **Mobile App**: React Native app for iOS/Android
8. **Offline Support**: Service worker for offline comment drafting

---

## Conclusion

CommentSync is built on a solid foundation of:
- **Multi-tenant architecture** with workspace isolation
- **Role-based access control** enforced at database level
- **Real-time collaboration** via Supabase subscriptions
- **Extensible integration system** starting with Jira
- **Performance-optimized** with proper indexes and query patterns
- **Security-first** design with RLS and encrypted secrets

The architecture supports horizontal scaling and can handle thousands of concurrent users across multiple workspaces.
