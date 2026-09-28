-- Base schema that the dashboard expects from the n8n WhatsApp SaaS setup

CREATE TABLE IF NOT EXISTS wa_plans (
  id SERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  price_qar NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  monthly_reply_limit INT NOT NULL DEFAULT 1000,
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS wa_tenants (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'trial')),
  trial_ends_at TIMESTAMPTZ,
  plan_id INT REFERENCES wa_plans(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wa_instances (
  tenant_id INT PRIMARY KEY REFERENCES wa_tenants(id) ON DELETE CASCADE,
  instance_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'none'
);

CREATE TABLE IF NOT EXISTS wa_bot_settings (
  tenant_id INT PRIMARY KEY REFERENCES wa_tenants(id) ON DELETE CASCADE,
  business_name TEXT,
  bot_name TEXT,
  persona_prompt TEXT,
  business_info TEXT,
  timezone TEXT NOT NULL DEFAULT 'UTC'
);

CREATE TABLE IF NOT EXISTS wa_contacts (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  bot_enabled BOOLEAN NOT NULL DEFAULT true,
  needs_human BOOLEAN NOT NULL DEFAULT false,
  last_message_at TIMESTAMPTZ,
  summary TEXT,
  facts JSONB DEFAULT '[]'::jsonb,
  UNIQUE(tenant_id, phone)
);

CREATE TABLE IF NOT EXISTS wa_messages (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  sender TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wa_usage_daily (
  tenant_id INT NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  day DATE NOT NULL DEFAULT CURRENT_DATE,
  ai_replies INT NOT NULL DEFAULT 0,
  msg_sent INT NOT NULL DEFAULT 0,
  msg_received INT NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, day)
);

CREATE TABLE IF NOT EXISTS wa_services (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_min INT NOT NULL DEFAULT 30,
  price NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  currency TEXT NOT NULL DEFAULT 'USD',
  active BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS wa_business_hours (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  open_time TIME NOT NULL DEFAULT '09:00',
  close_time TIME NOT NULL DEFAULT '17:00',
  is_closed BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(tenant_id, weekday)
);

CREATE TABLE IF NOT EXISTS wa_appointments (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  customer_name TEXT,
  service_id INT REFERENCES wa_services(id) ON DELETE SET NULL,
  start_time TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed'))
);

-- Note: wa_tenant_users is created in 001_dashboard.sql
