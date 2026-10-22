-- Migration 021: Ad clicks, playbooks, and performance view
-- Safe to run repeatedly (all IF NOT EXISTS / CREATE OR REPLACE)

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
  match_type  TEXT         NOT NULL CHECK (match_type IN ('source_id', 'title_contains', 'any')),
  match_value TEXT,                            -- NULL only when match_type = 'any'
  instructions TEXT        NOT NULL,
  media_id    INT          REFERENCES wa_media(id) ON DELETE SET NULL,
  active      BOOLEAN      NOT NULL DEFAULT true,
  sort_order  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wa_ad_playbooks_tenant_idx ON wa_ad_playbooks (tenant_id, sort_order ASC);

-- ── Performance view ──────────────────────────────────────────────────────────
-- Aggregates booking outcomes per ad (by COALESCE(source_id, ad_title)).
-- If wa_appointments or wa_leads tables exist, they can be joined here.
-- This is a stub that must be extended with real booking/completion join logic.

CREATE OR REPLACE VIEW wa_v_ad_performance AS
  SELECT
    c.tenant_id,
    COALESCE(c.source_id, c.ad_title)    AS group_key,
    MAX(c.source_id)                      AS source_id,
    MAX(c.ad_title)                       AS ad_title,
    COUNT(*)::int                         AS total_clicks,
    COUNT(DISTINCT c.phone)::int          AS distinct_people,
    0::int                                AS bookings_created,
    0::int                                AS bookings_completed
  FROM wa_ad_clicks c
  GROUP BY c.tenant_id, COALESCE(c.source_id, c.ad_title);

-- ── Enable 'ads' module for all existing tenants that have a modules array set ──
-- (tenants where modules IS NULL inherit from their pack; add 'ads' to overrides)
-- To enable for a specific tenant:
--   UPDATE wa_tenants SET modules = modules || '["ads"]'::jsonb WHERE id = <id>;
-- To add to all packs so every new tenant gets it automatically, run:
UPDATE wa_business_packs
   SET modules = CASE
                   WHEN modules @> '["ads"]'::jsonb THEN modules
                   ELSE modules || '["ads"]'::jsonb
                 END
 WHERE active = true;
