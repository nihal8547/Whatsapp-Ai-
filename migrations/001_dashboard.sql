-- Tables the dashboard needs on top of the n8n SaaS schema.
-- Safe to run more than once.

CREATE TABLE IF NOT EXISTS wa_tenant_users (
  id SERIAL PRIMARY KEY,
  tenant_id INT REFERENCES wa_tenants(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','admin','staff')),
  is_super_admin BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wa_tenant_users_tenant_idx ON wa_tenant_users (tenant_id);

-- Faster inbox ordering
CREATE INDEX IF NOT EXISTS wa_contacts_tenant_last_msg_idx
  ON wa_contacts (tenant_id, last_message_at DESC NULLS LAST);
