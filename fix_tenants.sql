ALTER TABLE wa_tenants ADD COLUMN status TEXT DEFAULT 'active';
ALTER TABLE wa_tenants ADD COLUMN name TEXT;
ALTER TABLE wa_tenants ADD COLUMN slug TEXT;
ALTER TABLE wa_tenants ADD COLUMN trial_ends_at TIMESTAMPTZ;
ALTER TABLE wa_tenants ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
