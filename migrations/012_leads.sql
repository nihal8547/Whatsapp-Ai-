CREATE TABLE IF NOT EXISTS wa_leads (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL,
  phone TEXT NOT NULL,
  name TEXT,
  kind TEXT NOT NULL DEFAULT 'general',
  stage TEXT NOT NULL DEFAULT 'new' CHECK (stage IN ('new', 'qualified', 'quoted', 'negotiating', 'won', 'lost')),
  summary TEXT NOT NULL DEFAULT '',
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  budget_min NUMERIC(12,2),
  budget_max NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'QAR',
  value NUMERIC(12,2),
  assigned_to INT REFERENCES wa_tenant_users(id) ON DELETE SET NULL,
  next_followup_at TIMESTAMPTZ,
  followups_sent INT NOT NULL DEFAULT 0,
  lost_reason TEXT,
  source TEXT NOT NULL DEFAULT 'whatsapp',
  staff_alerted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wa_leads_contact_fk FOREIGN KEY (tenant_id, phone) REFERENCES wa_contacts (tenant_id, phone) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS wa_leads_one_open_idx ON wa_leads (tenant_id, phone, kind) WHERE stage NOT IN ('won', 'lost');
CREATE INDEX IF NOT EXISTS wa_leads_board_idx ON wa_leads (tenant_id, stage, updated_at DESC);

CREATE TABLE IF NOT EXISTS wa_lead_events (
  id BIGSERIAL PRIMARY KEY,
  lead_id INT NOT NULL REFERENCES wa_leads(id) ON DELETE CASCADE,
  tenant_id INT NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('note', 'stage', 'quote', 'followup', 'message', 'assign')),
  body TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by INT REFERENCES wa_tenant_users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wa_lead_events_lead_idx ON wa_lead_events (lead_id, created_at DESC);

CREATE TABLE IF NOT EXISTS wa_quotes (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  lead_id INT NOT NULL REFERENCES wa_leads(id) ON DELETE CASCADE,
  lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'QAR',
  valid_until DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'declined')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
