CREATE TABLE IF NOT EXISTS wa_user_memory (
  tenant_id INT REFERENCES wa_tenants(id) ON DELETE CASCADE,
  phone TEXT,
  summary TEXT,
  facts JSONB DEFAULT '[]'::jsonb,
  PRIMARY KEY (tenant_id, phone)
);

ALTER TABLE wa_appointments ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;
ALTER TABLE wa_appointments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE wa_appointments ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE wa_appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE wa_bot_settings ADD COLUMN IF NOT EXISTS slot_interval_min INT DEFAULT 30;
ALTER TABLE wa_bot_settings ADD COLUMN IF NOT EXISTS admin_phone TEXT;
ALTER TABLE wa_bot_settings ADD COLUMN IF NOT EXISTS reminder_24h_template TEXT;
ALTER TABLE wa_bot_settings ADD COLUMN IF NOT EXISTS reminder_1h_template TEXT;
ALTER TABLE wa_bot_settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE wa_services ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS handoff_reason TEXT;

ALTER TABLE wa_tenants ADD COLUMN IF NOT EXISTS business_type VARCHAR(50) DEFAULT 'other';
ALTER TABLE wa_tenants ADD COLUMN IF NOT EXISTS business_metadata JSONB DEFAULT '{}'::jsonb;
