-- Migration 021: Ad clicks, playbooks, and business packs module
-- Safe to run repeatedly (IF NOT EXISTS)
-- Notice: wa_v_ad_performance view already exists in the real database and is preserved.

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS wa_ad_clicks (
  id          BIGSERIAL    PRIMARY KEY,
  tenant_id   INT          NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  phone       TEXT         NOT NULL,
  ad_title    TEXT,
  ad_body     TEXT,
  source_url  TEXT,
  source_id   TEXT,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wa_ad_clicks_tenant_idx ON wa_ad_clicks (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS wa_ad_clicks_source_idx ON wa_ad_clicks (tenant_id, source_id);

CREATE TABLE IF NOT EXISTS wa_ad_playbooks (
  id          SERIAL       PRIMARY KEY,
  tenant_id   INT          NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  name        TEXT         NOT NULL,
  match_type  TEXT         NOT NULL DEFAULT 'source_id' CHECK (match_type IN ('source_id', 'title_contains', 'any')),
  match_value TEXT         NOT NULL DEFAULT '',
  instructions TEXT        NOT NULL DEFAULT '',
  media_id    INT          REFERENCES wa_media(id) ON DELETE SET NULL,
  active      BOOLEAN      NOT NULL DEFAULT true,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wa_ad_playbooks_tenant_idx ON wa_ad_playbooks (tenant_id, sort_order ASC);

-- ── Enable 'ads' module for all active business packs ────────────────────────
UPDATE wa_business_packs
   SET modules = CASE
                   WHEN modules @> '["ads"]'::jsonb THEN modules
                   ELSE modules || '["ads"]'::jsonb
                 END
 WHERE active = true;
