CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS wa_data_tables (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (name ~ '^[a-z][a-z0-9_]{1,40}$'),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  row_count INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS wa_data_rows (
  id BIGSERIAL PRIMARY KEY,
  table_id INT NOT NULL REFERENCES wa_data_tables(id) ON DELETE CASCADE,
  tenant_id INT NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  search_text TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS wa_data_rows_table_idx ON wa_data_rows (table_id);
CREATE INDEX IF NOT EXISTS wa_data_rows_search_trgm ON wa_data_rows USING gin (search_text gin_trgm_ops);

CREATE TABLE IF NOT EXISTS wa_csv_uploads (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('customers', 'catalog', 'knowledge')),
  filename TEXT,
  total_rows INT NOT NULL DEFAULT 0,
  imported_rows INT NOT NULL DEFAULT 0,
  rejected_rows INT NOT NULL DEFAULT 0,
  column_map JSONB NOT NULL DEFAULT '{}'::jsonb,
  target_table_id INT REFERENCES wa_data_tables(id) ON DELETE SET NULL,
  uploaded_by INT REFERENCES wa_tenant_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wa_csv_uploads_tenant_idx ON wa_csv_uploads (tenant_id, created_at DESC);

ALTER TABLE wa_broadcast_recipients ADD COLUMN IF NOT EXISTS rendered_text TEXT;
