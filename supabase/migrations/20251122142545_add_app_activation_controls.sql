/*
  # Add App Activation Controls

  1. Changes
    - Add `active_duration_type` enum field to apps table
      - Options: 'permanent', 'temporary', 'inactive'
    - Add `active_until` timestamp field for temporary activations
    - Add `deactivated_at` timestamp field for tracking when app was deactivated
    
  2. Notes
    - 'permanent': App stays active indefinitely (default for existing apps)
    - 'temporary': App is active until `active_until` timestamp
    - 'inactive': App is manually deactivated
    - Existing apps default to 'permanent' to maintain current behavior
*/

-- Create enum type for activation duration
DO $$ BEGIN
  CREATE TYPE app_activation_type AS ENUM ('permanent', 'temporary', 'inactive');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Add activation control columns to apps table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apps' AND column_name = 'active_duration_type'
  ) THEN
    ALTER TABLE apps ADD COLUMN active_duration_type app_activation_type DEFAULT 'permanent' NOT NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apps' AND column_name = 'active_until'
  ) THEN
    ALTER TABLE apps ADD COLUMN active_until timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'apps' AND column_name = 'deactivated_at'
  ) THEN
    ALTER TABLE apps ADD COLUMN deactivated_at timestamptz;
  END IF;
END $$;

-- Create index for querying active apps by expiry time
CREATE INDEX IF NOT EXISTS idx_apps_active_until ON apps(active_until) WHERE active_until IS NOT NULL;

-- Create function to check if app is currently active
CREATE OR REPLACE FUNCTION is_app_active(app_record apps)
RETURNS boolean AS $$
BEGIN
  -- If manually deactivated
  IF app_record.active_duration_type = 'inactive' THEN
    RETURN false;
  END IF;
  
  -- If permanent activation
  IF app_record.active_duration_type = 'permanent' THEN
    RETURN app_record.is_active;
  END IF;
  
  -- If temporary activation, check expiry
  IF app_record.active_duration_type = 'temporary' THEN
    RETURN app_record.is_active AND (app_record.active_until IS NULL OR app_record.active_until > now());
  END IF;
  
  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;
