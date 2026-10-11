CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS wa_business_packs (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  labels JSONB NOT NULL DEFAULT '{}'::jsonb,
  persona_rules TEXT NOT NULL DEFAULT '',
  defaults JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INT NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE wa_tenants ADD COLUMN IF NOT EXISTS pack_code TEXT REFERENCES wa_business_packs(code);
ALTER TABLE wa_tenants ADD COLUMN IF NOT EXISTS modules JSONB;
ALTER TABLE wa_tenants ADD COLUMN IF NOT EXISTS labels JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS wa_faqs (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, question)
);
CREATE INDEX IF NOT EXISTS wa_faqs_tenant_idx ON wa_faqs (tenant_id, active, sort_order);

CREATE TABLE IF NOT EXISTS wa_notifications (
  id BIGSERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  ref_type TEXT,
  ref_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS wa_notifications_tenant_idx ON wa_notifications (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wa_notifications_unread_idx ON wa_notifications (tenant_id) WHERE read_at IS NULL;
