-- ============================================================
-- Microsoft 365 OAuth Token Storage
-- Enables per-organization OAuth flow (Authorization Code + PKCE)
-- instead of requiring manual Tenant ID configuration.
-- ============================================================

ALTER TABLE organizations
  ADD COLUMN ms365_access_token    TEXT,
  ADD COLUMN ms365_refresh_token   TEXT,
  ADD COLUMN ms365_token_expiry    TIMESTAMPTZ,
  ADD COLUMN ms365_connected_email TEXT,
  ADD COLUMN ms365_connected       BOOLEAN DEFAULT FALSE NOT NULL;
