# CommentSync

Universal Contextual Feedback Platform for Web Applications

## Overview

CommentSync is a collaborative feedback platform that enables teams to annotate, discuss, and track feedback on any web application in real-time—similar to Figma's commenting system but for any website.

## Features Built

### Core Dashboard Application
- **Authentication System**: Email/password authentication with Supabase
- **Workspace Management**: Multi-tenant workspace system with role-based access control
- **App Registration**: Register web applications to collect feedback on
- **Dashboard Views**: Overview of apps, comments, and activity

### Commenting System
- **Spatial Comments**: Pin comments to specific locations on any webpage
- **Injectable SDK**: Lightweight JavaScript SDK that overlays on any web application
- **Comment Mode**: Press 'C' key or use the toolbar to enter commenting mode
- **Real-time Updates**: Comments sync in real-time across users
- **Thread Management**: Organize comments into threads with resolution tracking

### User Roles
- **Admin**: Full workspace control, manage members and settings
- **Moderator**: Can resolve comments and manage apps
- **Commenter**: Can create and reply to comments
- **Viewer**: Read-only access to comments

### Current Implementation Status

✅ **Completed**
- Supabase database schema with all core tables
- Row Level Security policies for multi-tenant isolation
- Authentication flow (signup, login, session management)
- Workspace creation and management
- App registration and management
- Dashboard with stats and activity feed
- Comment SDK with spatial commenting
- Comment threads and replies
- Real-time comment syncing
- Auto-loading websites from app base_url (with auto-https://)
- Collapsible comments sidebar in app details
- CSP error handling with helpful user guidance
- Share URL and Invite functionality (no manual URL input)
- Thread resolution toggle (mark as resolved/reopen)
- Thread deletion with confirmation modal
- Redesigned widget header:
  - All controls consolidated in header (status, delete, close)
  - URL displayed on separate line with smart truncation
  - Comment dropdown menu with bounds checking
  - Spatial positioning of widgets near comment pins
- App card dropdown menu with actions:
  - Activate/Deactivate apps
  - Quick access to app settings
  - Delete app with cascade delete of all data
- Jira integration with bi-directional sync:
  - Configure Jira connection in Settings > Integrations tab
  - Sync comment threads to Jira issues
  - Automatic or manual sync modes
  - Thread status syncs with Jira issue status
- Full-screen app details view:
  - Maximized preview area for better viewing experience
  - Thinner, compact header
  - Expandable/collapsible comments sidebar
  - Comments panel floats over preview
  - Real-time comment updates in sidebar and overlay
  - Automatically refreshes when new threads or comments are added
- File attachments for comments:
  - Upload multiple files per comment (images, PDFs, documents, videos)
  - 10MB file size limit per file
  - Secure Supabase Storage integration
  - Image preview in comments
  - File download with icons for different file types
  - Support for: images (JPEG, PNG, GIF, WebP), PDFs, Word docs, Excel sheets, text files, videos (MP4, MOV)
- Screenshot capture:
  - Automatic page screenshot when testers create comments
  - Screenshots stored in comment metadata
  - Full page context preserved for each feedback item
  - Visual replay of exact page state when feedback was given
- Page navigation in App Details:
  - Click page URL pills to view different pages
  - Automatically switches to corresponding screenshot
  - Comment pins update based on selected page
  - Easy navigation between multiple pages with feedback

🚧 **Planned** (Not Yet Implemented)
- Additional integrations (Notion, GitHub)
- Chrome extension
- Advanced analytics and reporting
- Comment mentions and reactions
- Video recordings
- Audit logs UI
- Webhook API
- Email notifications

## Getting Started

### Prerequisites
- Node.js 18+ installed
- Supabase account (already configured)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Environment variables are already configured in `.env`:
```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

3. Run development server:
```bash
npm run dev
```

4. Build for production:
```bash
npm run build
```

### Usage

#### 1. Create an Account
- Visit `/signup` to create a new account
- Create your first workspace during onboarding

#### 2. Register an App
- Navigate to Apps section
- Click "New App"
- Enter app name and base URL (e.g., https://shop.example.com)
- Get a shareable review URL

#### 3. Share with Testers
- Click "Share URL" button in app details
- Share the URL (format: `/review/{app-id}`) with your testers
- Testers can access without login
- Example: `/review/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb`

#### 4. Testers Add Comments
- Testers open the review URL
- Click "Add Comment" button
- Click anywhere on the page to place a comment pin
- Enter name, email, and comment text
- Comments appear as numbered pins on the page

#### 5. Review Feedback (Admin)
- Navigate to App Details in dashboard
- See iframe with all comment pins overlaid
- Click any pin to view full conversation thread
- Widget opens spatially near the pin location
- Right sidebar shows latest comments for quick filtering
- Reply to comments and manage threads:
  - Click the status badge (○ Open / ✓ Resolved) in header to toggle
  - Click trash icon (🗑️) in header to delete entire thread
  - All controls (status, delete, close) are in the widget header
  - URL shown below header with smart truncation
  - Resolved threads show with green status badges
  - Open threads show with amber status badges

#### 6. Configure Jira Integration (Optional)
- Navigate to Settings > Integrations tab
- Enter your Jira credentials:
  - Jira domain (e.g., yourcompany.atlassian.net)
  - Email address
  - API token (generate from Atlassian account settings)
  - Default project key (e.g., PROJ)
- Click "Test Connection" to verify
- Save configuration
- Enable auto-sync if desired

#### 7. Sync Comments to Jira
- Open any comment thread in App Details
- Click "Sync to Jira" button in the thread overlay
- A new Jira issue is created with:
  - Thread context and location
  - All comments from the thread
  - Proper issue type mapping (Bug, Task, etc.)
- New comments automatically sync to Jira
- Thread status changes reflect in Jira

## Architecture

### Database Schema
- **profiles**: User profiles linked to auth.users
- **workspaces**: Organization/team workspaces
- **workspace_members**: Junction table for membership with roles
- **apps**: Registered applications
- **threads**: Comment threads with spatial data
- **comments**: Individual comments within threads
- **mentions**: User mentions in comments
- **reactions**: Emoji reactions to comments
- **integration_configs**: Integration settings per workspace
- **integration_syncs**: Track sync operations with external tools
- **audit_logs**: Complete audit trail for compliance

### Security
- Row Level Security (RLS) enabled on all tables
- Workspace-based isolation policies
- Role-based access control (RBAC)
- Secure session management with Supabase Auth

### Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Routing**: React Router v7
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Real-time**: Supabase Realtime
- **Icons**: Lucide React

## Project Structure

```
src/
├── components/
│   └── DashboardLayout.tsx    # Main dashboard layout with navigation
├── contexts/
│   ├── AuthContext.tsx        # Authentication context and hooks
│   └── WorkspaceContext.tsx   # Workspace management context
├── lib/
│   ├── supabase.ts           # Supabase client setup
│   ├── database.types.ts     # TypeScript types for database
│   ├── jira.ts               # Jira API client and authentication
│   └── jiraSyncEngine.ts     # Bi-directional sync logic
├── pages/
│   ├── Login.tsx             # Login page
│   ├── Signup.tsx            # Signup page
│   ├── Onboarding.tsx        # Workspace creation
│   ├── Dashboard.tsx         # Main dashboard
│   ├── Apps.tsx              # Apps list view
│   ├── NewApp.tsx            # Create new app
│   ├── AppDetails.tsx        # App details with comments
│   └── Settings.tsx          # User, workspace, and integrations settings
└── App.tsx                    # Root component with routing

public/
└── comment-sdk.js             # Commenting overlay SDK
```

## Key Features Detail

### Figma-Style Review Interface
The review interface provides a Figma-like commenting experience:
- **Comment Pins**: Visual markers showing where feedback was given
- **Click-to-Comment**: Testers click anywhere to add contextual feedback
- **Overlay Modal**: Full conversation threads appear in a beautiful overlay
- **Real-time Sync**: Comments update automatically across all viewers
- **No Login Required**: Testers just need the review URL
- **Collapsible Sidebar**: Toggle comments sidebar for more viewing space
- **Auto-Load Websites**: Apps automatically load from their base URL
- **CSP Protection**: Graceful handling of websites with Content Security Policies
- **Quick Actions**: External link, invite users, and share URL directly from header

### Workspace Isolation
All data is isolated by workspace:
- Users can belong to multiple workspaces
- Each workspace has its own apps and comments
- RLS policies enforce strict data separation
- Role-based permissions control access levels

### Real-time Collaboration
Comments update in real-time:
- New comments appear immediately for all users
- Thread status changes sync across sessions
- Activity feed updates automatically

### Jira Integration
Seamless bi-directional sync with Jira:
- **Authentication**: Secure API token-based authentication
- **Issue Creation**: Automatically create Jira issues from comment threads
- **Bi-directional Sync**: Comments sync both ways between CommentSync and Jira
- **Status Mapping**: Thread status (Open/Resolved) maps to Jira issue status
- **Comment Type Mapping**: Bug comments become Bug issues, others become Tasks
- **Auto-sync Option**: Optionally enable automatic sync for new threads
- **Context Preservation**: Issues include page URL, position, and full thread context
- **Real-time Updates**: New comments in threads automatically post to Jira

## Development

### Run Tests
```bash
npm run test
```

### Type Check
```bash
npm run typecheck
```

### Lint
```bash
npm run lint
```

### Build
```bash
npm run build
```

## Deployment

The application can be deployed to any static hosting platform:

1. Build the project:
```bash
npm run build
```

2. Deploy the `dist` folder to your hosting provider

3. Ensure the comment SDK is accessible at `/comment-sdk.js`

## Future Enhancements

### Phase 1 (Completed)
- ✅ Core commenting system
- ✅ Workspace management
- ✅ App registration
- ✅ Basic dashboard
- ✅ Jira bi-directional sync

### Phase 2 (Next)
- Notion integration
- GitHub issue creation
- Chrome extension
- User mentions and notifications
- Comment reactions

### Phase 3 (Later)
- Advanced analytics
- File attachments and screenshots
- Video recordings
- Custom webhooks
- Email notifications
- Mobile app

## License

Private - All Rights Reserved

## Support

For issues or questions, please contact your development team.
