-- Migration: 20260522000004_access_token_hook.sql
-- Purpose: Custom Access Token Hook — injects tenant_id and ara_role into JWT app_metadata
-- Trigger: Runs at EVERY token issuance (login, refresh, MFA challenge completion)
-- Security: SECURITY DEFINER, granted to supabase_auth_admin only (D-01, D-02)
-- Note: After applying this migration, register the hook in the Supabase Dashboard:
--       Authentication > Hooks > Custom Access Token Hook
--       Point it to: public.custom_access_token_hook

-- ============================================================
-- FUNCTION: public.custom_access_token_hook
-- Reads user_tenant_roles to inject tenant_id + ara_role into
-- the JWT claims' app_metadata block.
-- app_metadata is server-writable only — users cannot modify it
-- (unlike user_metadata), making it safe for authorization (D-01).
-- ============================================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_id uuid;
  v_role      text;
  claims      jsonb;
BEGIN
  -- D-02: Read tenant_id and role for this user.
  -- Filter: active = true ensures revoked users get no claims.
  -- LIMIT 1: MVP assumes one active tenant per user.
  SELECT tenant_id, role
  INTO   v_tenant_id, v_role
  FROM   public.user_tenant_roles
  WHERE  user_id = (event->>'user_id')::uuid
    AND  active  = true
  LIMIT  1;

  -- Extract existing claims from the event
  claims := event->'claims';

  -- Inject claims only when a tenant assignment exists.
  -- If no row found (v_tenant_id IS NULL), the JWT is issued
  -- without tenant context — the proxy.ts will redirect to /auth/login.
  IF v_tenant_id IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata,tenant_id}', to_jsonb(v_tenant_id::text));
    claims := jsonb_set(claims, '{app_metadata,ara_role}',  to_jsonb(v_role));
  END IF;

  -- Return the modified event with updated claims
  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- ============================================================
-- GRANTS: supabase_auth_admin must be able to invoke the hook
-- ============================================================

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;

-- ============================================================
-- REVOKES: Deny all other roles — least-privilege principle
-- PUBLIC includes authenticated and anon implicitly, but we
-- revoke explicitly for clarity and future-proofing.
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM anon;

-- ============================================================
-- COMMENT
-- ============================================================

COMMENT ON FUNCTION public.custom_access_token_hook(jsonb) IS
  'Custom Access Token Hook: injects app_metadata.tenant_id and app_metadata.ara_role '
  'into every JWT at issuance. Reads public.user_tenant_roles WHERE active = true. '
  'Must be registered in Supabase Dashboard: Authentication > Hooks > Custom Access Token Hook. '
  'Security: SECURITY DEFINER, callable by supabase_auth_admin only. '
  'References: D-01, D-02 (01-CONTEXT.md).';
