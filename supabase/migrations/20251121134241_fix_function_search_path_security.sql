/*
  # Fix Function Search Path Security Issues

  ## Security Improvements
  This migration fixes the "Function Search Path Mutable" security warnings by
  setting an empty search_path on all SECURITY DEFINER functions. This prevents
  potential security vulnerabilities where malicious users could exploit the
  search_path to execute unintended code.

  ## Changes
  - Add `SET search_path = ''` to `handle_new_user` function
  - Add `SET search_path = ''` to `update_updated_at_column` function
  - Add `SET search_path = ''` to `has_app_access` function

  ## Note
  Core logic remains unchanged - only security hardening is applied.
*/

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

-- Fix update_updated_at_column function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix has_app_access function
CREATE OR REPLACE FUNCTION public.has_app_access(app_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.apps WHERE id = app_id_param AND owner_id = user_id_param
    UNION
    SELECT 1 FROM public.app_collaborators 
    WHERE app_id = app_id_param AND user_id = user_id_param
    UNION
    SELECT 1 FROM public.apps a
    JOIN public.workspaces w ON a.workspace_id = w.id
    WHERE a.id = app_id_param AND w.owner_id = user_id_param
  );
$$;
