export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      workspaces: {
        Row: {
          id: string
          name: string
          slug: string
          owner_id: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          owner_id: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          owner_id?: string
          created_at?: string
          updated_at?: string
        }
      }
      workspace_members: {
        Row: {
          id: string
          workspace_id: string
          user_id: string
          role: 'admin' | 'moderator' | 'commenter' | 'viewer'
          invited_by: string | null
          joined_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id: string
          role?: 'admin' | 'moderator' | 'commenter' | 'viewer'
          invited_by?: string | null
          joined_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string
          role?: 'admin' | 'moderator' | 'commenter' | 'viewer'
          invited_by?: string | null
          joined_at?: string
        }
      }
      apps: {
        Row: {
          id: string
          workspace_id: string
          name: string
          base_url: string
          description: string | null
          owner_id: string
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          base_url: string
          description?: string | null
          owner_id: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          base_url?: string
          description?: string | null
          owner_id?: string
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      threads: {
        Row: {
          id: string
          app_id: string
          page_url: string
          dom_selector: Json
          position_data: Json
          status: 'open' | 'resolved' | 'duplicate'
          resolved_at: string | null
          resolved_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          app_id: string
          page_url: string
          dom_selector?: Json
          position_data?: Json
          status?: 'open' | 'resolved' | 'duplicate'
          resolved_at?: string | null
          resolved_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          app_id?: string
          page_url?: string
          dom_selector?: Json
          position_data?: Json
          status?: 'open' | 'resolved' | 'duplicate'
          resolved_at?: string | null
          resolved_by?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      comments: {
        Row: {
          id: string
          thread_id: string
          author_id: string
          content: string
          comment_type: 'bug' | 'suggestion' | 'question' | 'approved' | 'general'
          attachments: Json
          metadata: Json
          edited_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          thread_id: string
          author_id: string
          content: string
          comment_type?: 'bug' | 'suggestion' | 'question' | 'approved' | 'general'
          attachments?: Json
          metadata?: Json
          edited_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          thread_id?: string
          author_id?: string
          content?: string
          comment_type?: 'bug' | 'suggestion' | 'question' | 'approved' | 'general'
          attachments?: Json
          metadata?: Json
          edited_at?: string | null
          created_at?: string
        }
      }
      mentions: {
        Row: {
          id: string
          comment_id: string
          mentioned_user_id: string
          created_at: string
        }
        Insert: {
          id?: string
          comment_id: string
          mentioned_user_id: string
          created_at?: string
        }
        Update: {
          id?: string
          comment_id?: string
          mentioned_user_id?: string
          created_at?: string
        }
      }
      reactions: {
        Row: {
          id: string
          comment_id: string
          user_id: string
          emoji: string
          created_at: string
        }
        Insert: {
          id?: string
          comment_id: string
          user_id: string
          emoji: string
          created_at?: string
        }
        Update: {
          id?: string
          comment_id?: string
          user_id?: string
          emoji?: string
          created_at?: string
        }
      }
      integration_configs: {
        Row: {
          id: string
          workspace_id: string
          integration_type: 'jira' | 'notion' | 'github' | 'slack' | 'webhook'
          config_data: Json
          is_active: boolean
          jira_domain: string | null
          jira_email: string | null
          jira_api_token: string | null
          jira_project_key: string | null
          auto_sync_enabled: boolean | null
          sync_interval_minutes: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          integration_type: 'jira' | 'notion' | 'github' | 'slack' | 'webhook'
          config_data?: Json
          is_active?: boolean
          jira_domain?: string | null
          jira_email?: string | null
          jira_api_token?: string | null
          jira_project_key?: string | null
          auto_sync_enabled?: boolean | null
          sync_interval_minutes?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          integration_type?: 'jira' | 'notion' | 'github' | 'slack' | 'webhook'
          config_data?: Json
          is_active?: boolean
          jira_domain?: string | null
          jira_email?: string | null
          jira_api_token?: string | null
          jira_project_key?: string | null
          auto_sync_enabled?: boolean | null
          sync_interval_minutes?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      integration_syncs: {
        Row: {
          id: string
          comment_id: string
          integration_config_id: string
          external_id: string
          external_url: string | null
          sync_status: 'pending' | 'synced' | 'failed'
          sync_direction: 'outbound' | 'inbound'
          error_message: string | null
          last_synced_at: string
          created_at: string
        }
        Insert: {
          id?: string
          comment_id: string
          integration_config_id: string
          external_id: string
          external_url?: string | null
          sync_status?: 'pending' | 'synced' | 'failed'
          sync_direction?: 'outbound' | 'inbound'
          error_message?: string | null
          last_synced_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          comment_id?: string
          integration_config_id?: string
          external_id?: string
          external_url?: string | null
          sync_status?: 'pending' | 'synced' | 'failed'
          sync_direction?: 'outbound' | 'inbound'
          error_message?: string | null
          last_synced_at?: string
          created_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          workspace_id: string
          user_id: string | null
          action: string
          resource_type: string
          resource_id: string
          changes: Json
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          user_id?: string | null
          action: string
          resource_type: string
          resource_id: string
          changes?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          user_id?: string | null
          action?: string
          resource_type?: string
          resource_id?: string
          changes?: Json
          ip_address?: string | null
          user_agent?: string | null
          created_at?: string
        }
      }
      app_invitations: {
        Row: {
          id: string
          app_id: string
          inviter_id: string
          invitee_email: string
          invitee_id: string | null
          status: string
          invited_at: string | null
          accepted_at: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          app_id: string
          inviter_id: string
          invitee_email: string
          invitee_id?: string | null
          status?: string
          invited_at?: string | null
          accepted_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          app_id?: string
          inviter_id?: string
          invitee_email?: string
          invitee_id?: string | null
          status?: string
          invited_at?: string | null
          accepted_at?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
    }
  }
}
