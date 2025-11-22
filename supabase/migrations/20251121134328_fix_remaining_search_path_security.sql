/*
  # Fix Remaining Function Search Path Security Issues

  ## Security Improvements
  Fixes the remaining SECURITY DEFINER functions that have mutable search_path
  by setting an empty search_path and fully qualifying all table references.

  ## Changes
  - Fix `get_user_workspaces` function
  - Fix `is_workspace_member` function  
  - Fix `is_workspace_admin` function

  ## Note
  All table references are now fully qualified with `public.` schema prefix.
  Core logic remains unchanged - only security hardening is applied.
*/

-- Fix get_user_workspaces function
CREATE OR REPLACE FUNCTION public.get_user_workspaces(user_uuid uuid)
RETURNS TABLE(workspace_id uuid, role public.workspace_role) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RETURN QUERY
  SELECT wm.workspace_id, wm.role
  FROM public.workspace_members wm
  WHERE wm.user_id = user_uuid;
END;
$$;

-- Fix is_workspace_member function
CREATE OR REPLACE FUNCTION public.is_workspace_member(workspace_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = workspace_uuid
    AND user_id = user_uuid
  );
$$;

-- Fix is_workspace_admin function
CREATE OR REPLACE FUNCTION public.is_workspace_admin(workspace_uuid uuid, user_uuid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = workspace_uuid
    AND user_id = user_uuid
    AND role = 'admin'
  );
$$;
