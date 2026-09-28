ALTER TABLE wa_tenants ADD COLUMN IF NOT EXISTS plan_id INT;
ALTER TABLE wa_usage_daily RENAME COLUMN date TO day;
