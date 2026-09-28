CREATE TABLE IF NOT EXISTS wa_plans (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE,
  name TEXT,
  price_qar NUMERIC,
  monthly_reply_limit INT,
  active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS wa_usage_daily (
  tenant_id INT,
  date DATE,
  ai_replies INT DEFAULT 0,
  msg_sent INT DEFAULT 0,
  msg_received INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS wa_appointments (
  id SERIAL PRIMARY KEY,
  tenant_id INT,
  phone TEXT,
  customer_name TEXT,
  start_time TIMESTAMPTZ,
  status TEXT
);

CREATE TABLE IF NOT EXISTS wa_bot_settings (
  tenant_id INT PRIMARY KEY,
  business_name TEXT,
  bot_name TEXT,
  persona_prompt TEXT,
  business_info TEXT,
  timezone TEXT DEFAULT 'UTC'
);

CREATE TABLE IF NOT EXISTS wa_instances (
  tenant_id INT PRIMARY KEY,
  instance_name TEXT,
  status TEXT
);

CREATE TABLE IF NOT EXISTS wa_services (
  id SERIAL PRIMARY KEY,
  tenant_id INT,
  name TEXT,
  description TEXT,
  duration_min INT,
  price NUMERIC,
  currency TEXT,
  active BOOLEAN DEFAULT true
);

CREATE TABLE IF NOT EXISTS wa_business_hours (
  tenant_id INT,
  weekday INT,
  open_time TIME,
  close_time TIME,
  is_closed BOOLEAN DEFAULT false
);

CREATE TABLE IF NOT EXISTS wa_messages (
  id SERIAL PRIMARY KEY,
  tenant_id INT,
  phone TEXT,
  direction TEXT,
  sender TEXT,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Mock columns on wa_contacts if needed
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS bot_enabled BOOLEAN DEFAULT true;
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS needs_human BOOLEAN DEFAULT false;
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS summary TEXT;
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS facts JSONB;
