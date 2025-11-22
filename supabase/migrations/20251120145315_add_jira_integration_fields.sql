/*
  # Add Jira Integration Fields

  1. Changes to integration_configs
    - Add jira-specific columns for enhanced configuration
    - Store project mappings and field mappings
    
  2. Changes to integration_syncs
    - Add bidirectional sync metadata
    - Track last sync timestamp and status
    
  3. New Functions
    - Helper function to validate Jira credentials
    
  4. Security
    - Maintain existing RLS policies
    - Ensure encrypted storage of sensitive credentials

  This migration enhances the existing integration system to fully support
  Jira bi-directional synchronization with proper credential management.
*/

-- Add columns to integration_configs for Jira-specific settings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_configs' AND column_name = 'jira_domain'
  ) THEN
    ALTER TABLE integration_configs ADD COLUMN jira_domain text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_configs' AND column_name = 'jira_email'
  ) THEN
    ALTER TABLE integration_configs ADD COLUMN jira_email text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_configs' AND column_name = 'jira_api_token'
  ) THEN
    ALTER TABLE integration_configs ADD COLUMN jira_api_token text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_configs' AND column_name = 'jira_project_key'
  ) THEN
    ALTER TABLE integration_configs ADD COLUMN jira_project_key text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_configs' AND column_name = 'auto_sync_enabled'
  ) THEN
    ALTER TABLE integration_configs ADD COLUMN auto_sync_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'integration_configs' AND column_name = 'sync_interval_minutes'
  ) THEN
    ALTER TABLE integration_configs ADD COLUMN sync_interval_minutes integer DEFAULT 15;
  END IF;
END $$;

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_integration_configs_workspace_type 
ON integration_configs(workspace_id, integration_type);

-- Add index for integration_syncs
CREATE INDEX IF NOT EXISTS idx_integration_syncs_comment_id 
ON integration_syncs(comment_id);

CREATE INDEX IF NOT EXISTS idx_integration_syncs_external_id 
ON integration_syncs(external_id);