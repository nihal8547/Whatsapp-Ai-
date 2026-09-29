-- 003_media_library.sql
-- Adds the wa_media table and the dashboard_url column on wa_platform_settings.
-- Safe to run more than once.

-- wa_platform_settings may or may not exist yet; create it if absent.
CREATE TABLE IF NOT EXISTS wa_platform_settings (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),  -- singleton row
  dashboard_url TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Ensure the singleton row exists.
INSERT INTO wa_platform_settings (id, dashboard_url) VALUES (1, '')
  ON CONFLICT DO NOTHING;

-- If the table already existed without dashboard_url, add it.
ALTER TABLE wa_platform_settings ADD COLUMN IF NOT EXISTS dashboard_url TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS wa_media (
  id           SERIAL PRIMARY KEY,
  tenant_id    INT NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'general'
               CHECK (category IN ('offer','package','service','general')),
  keywords     TEXT[] NOT NULL DEFAULT '{}',
  caption      TEXT,
  service_id   INT REFERENCES wa_services(id) ON DELETE SET NULL,
  mime_type    TEXT NOT NULL DEFAULT 'image/jpeg',
  file_data    BYTEA NOT NULL,
  public_token TEXT NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  active       BOOLEAN NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wa_media_tenant_idx ON wa_media (tenant_id, active);
