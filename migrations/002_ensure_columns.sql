-- 002_ensure_columns.sql
-- Safe to run against any copy of the database — every line is a no-op if already correct.

-- wa_bot_settings: bot_enabled is queried by the dashboard but absent from the base schema.
ALTER TABLE wa_bot_settings ADD COLUMN IF NOT EXISTS bot_enabled BOOLEAN NOT NULL DEFAULT true;

-- wa_tenants: business classification columns (also in update_schema.sql — idempotent).
ALTER TABLE wa_tenants ADD COLUMN IF NOT EXISTS business_type VARCHAR(50) DEFAULT 'other';
ALTER TABLE wa_tenants ADD COLUMN IF NOT EXISTS business_metadata JSONB DEFAULT '{}'::jsonb;

-- wa_usage_daily: the n8n workflow uses column name "day"; base schema may have shipped it
-- as "date" in some deployments. Rename only if "date" exists AND "day" does not.
DO $$
BEGIN
  IF EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_name = 'wa_usage_daily' AND column_name = 'date'
  ) AND NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_name = 'wa_usage_daily' AND column_name = 'day'
  ) THEN
    ALTER TABLE wa_usage_daily RENAME COLUMN date TO day;
  END IF;
END $$;
