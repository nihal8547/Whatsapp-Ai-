-- 023_followup_controls.sql
-- Safe to run more than once.

-- Ensure wa_contacts columns
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS intent TEXT NOT NULL DEFAULT 'unknown';
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS lead_stage TEXT NOT NULL DEFAULT 'none';
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS interest_topic TEXT;
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS quote_summary TEXT;
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS intent_updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS intent_locked BOOLEAN NOT NULL DEFAULT false;

-- Add check constraints if not present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wa_contacts_intent_check'
  ) THEN
    ALTER TABLE wa_contacts ADD CONSTRAINT wa_contacts_intent_check
      CHECK (intent IN ('unknown','enquiry','job_seeker','support','customer','other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wa_contacts_lead_stage_check'
  ) THEN
    ALTER TABLE wa_contacts ADD CONSTRAINT wa_contacts_lead_stage_check
      CHECK (lead_stage IN ('none','enquiry','quoted','negotiating','booked','lost'));
  END IF;
END $$;

-- Ensure wa_bot_settings columns
ALTER TABLE wa_bot_settings ADD COLUMN IF NOT EXISTS followup_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE wa_bot_settings ADD COLUMN IF NOT EXISTS followup_after_hours INT NOT NULL DEFAULT 72;
ALTER TABLE wa_bot_settings ADD COLUMN IF NOT EXISTS followup_template_enquiry TEXT NOT NULL DEFAULT 'Hi {name}, just checking in regarding {topic} — let us know if you have any questions!';
ALTER TABLE wa_bot_settings ADD COLUMN IF NOT EXISTS followup_template_quoted TEXT NOT NULL DEFAULT 'Hi {name}, following up on your quote for {topic} ({quote}) — let us know if you would like to proceed!';
