-- Migration: 20260522000005_vault_helper.sql
-- Purpose: Vault helper function — ONLY allowed path to read encrypted secrets
-- Security: SECURITY DEFINER, callable by service_role ONLY (D-10, T-02-03)
-- Usage: n8n Code Node 1 calls supabase.rpc('get_secret', { secret_name: 'medstar_key_{tenant_id}' })
-- Key format (D-10): medstar_key_{tenant_id}, elevenlabs_key_{tenant_id}

-- ============================================================
-- FUNCTION: public.get_secret
-- Reads a single secret by name from vault.decrypted_secrets.
-- vault.decrypted_secrets is a Supabase Vault view that returns
-- the AES-256 decrypted value — never the raw encrypted bytes.
-- This function wraps vault access so that:
--   a) vault.decrypted_secrets itself is never directly accessible
--      to authenticated or anon roles (T-02-03 mitigation)
--   b) The caller (n8n via service_role) gets only the value they
--      requested — no ability to enumerate all secrets
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_secret(secret_name text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = vault, public
AS $$
  SELECT decrypted_secret
  FROM   vault.decrypted_secrets
  WHERE  name = secret_name
  LIMIT  1;
$$;

-- ============================================================
-- REVOKES: Deny all roles first — then grant only service_role
-- This is the critical security step. Without explicit REVOKE,
-- PUBLIC (which includes authenticated and anon) inherits EXECUTE.
-- ============================================================

REVOKE ALL ON FUNCTION public.get_secret(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_secret(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.get_secret(text) FROM anon;

-- ============================================================
-- GRANT: service_role only
-- n8n connects to Supabase Postgres with the service_role key.
-- This is the only caller that should ever read Vault secrets.
-- ============================================================

GRANT EXECUTE ON FUNCTION public.get_secret(text) TO service_role;

-- ============================================================
-- COMMENT
-- ============================================================

COMMENT ON FUNCTION public.get_secret(text) IS
  'Vault secret accessor: returns decrypted_secret from vault.decrypted_secrets by name. '
  'Callable by service_role ONLY — revoked from PUBLIC, authenticated, anon. '
  'Key naming convention (D-10): medstar_key_{tenant_id}, elevenlabs_key_{tenant_id}. '
  'Usage: n8n Node 1 calls supabase.rpc(''get_secret'', { secret_name: ''medstar_key_...'' }). '
  'References: D-10, T-02-03 (01-PLAN-02.md threat model).';
