-- Migration 022: API keys, Webhooks, and API logs for tenant integrations
-- Safe to run repeatedly (IF NOT EXISTS)

CREATE TABLE IF NOT EXISTS wa_tenant_api_keys (
  id                  SERIAL       PRIMARY KEY,
  tenant_id           INT          NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  name                TEXT         NOT NULL DEFAULT 'Default',
  key_prefix          TEXT         NOT NULL,
  key_hash            TEXT         NOT NULL,
  scopes              TEXT[]       NOT NULL DEFAULT '{"read"}'::text[],
  rate_limit_per_min  INT          NOT NULL DEFAULT 60,
  last_used_at        TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  active              BOOLEAN      NOT NULL DEFAULT true,
  created_by          INT          REFERENCES wa_tenant_users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS wa_tenant_api_keys_tenant_idx ON wa_tenant_api_keys (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wa_tenant_api_keys_hash_idx ON wa_tenant_api_keys (key_hash) WHERE active;

CREATE TABLE IF NOT EXISTS wa_tenant_webhooks (
  id                  SERIAL       PRIMARY KEY,
  tenant_id           INT          NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  url                 TEXT         NOT NULL,
  secret              TEXT         NOT NULL DEFAULT '',
  events              TEXT[]       NOT NULL DEFAULT '{"all"}'::text[],
  active              BOOLEAN      NOT NULL DEFAULT true,
  last_triggered_at   TIMESTAMPTZ,
  fail_count          INT          NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, url)
);

CREATE INDEX IF NOT EXISTS wa_tenant_webhooks_tenant_idx ON wa_tenant_webhooks (tenant_id, created_at DESC);

CREATE TABLE IF NOT EXISTS wa_api_logs (
  id                  BIGSERIAL    PRIMARY KEY,
  tenant_id           INT          NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  key_id              INT          REFERENCES wa_tenant_api_keys(id) ON DELETE SET NULL,
  method              TEXT         NOT NULL,
  path                TEXT         NOT NULL,
  status              INT          NOT NULL,
  ip                  TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wa_api_logs_tenant_idx ON wa_api_logs (tenant_id, created_at DESC);
