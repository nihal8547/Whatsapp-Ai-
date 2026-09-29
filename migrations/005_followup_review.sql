-- 005_followup_review.sql
-- Safe to run more than once.

ALTER TABLE wa_contacts ADD COLUMN IF NOT EXISTS last_followup_sent_at TIMESTAMPTZ;

ALTER TABLE wa_bot_settings ADD COLUMN IF NOT EXISTS followup_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE wa_bot_settings ADD COLUMN IF NOT EXISTS followup_after_hours INT NOT NULL DEFAULT 72;
ALTER TABLE wa_bot_settings ADD COLUMN IF NOT EXISTS followup_template TEXT NOT NULL DEFAULT 'Hi {name} 👋 just checking in — still interested? happy to answer any questions.';

ALTER TABLE wa_appointments ADD COLUMN IF NOT EXISTS review_requested BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE wa_bot_settings ADD COLUMN IF NOT EXISTS review_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE wa_bot_settings ADD COLUMN IF NOT EXISTS review_delay_hours INT NOT NULL DEFAULT 2;
ALTER TABLE wa_bot_settings ADD COLUMN IF NOT EXISTS review_link TEXT NOT NULL DEFAULT '';
ALTER TABLE wa_bot_settings ADD COLUMN IF NOT EXISTS review_template TEXT NOT NULL DEFAULT 'Hi {name}, hope the {service} went well! Would you mind leaving us a quick review? {link}';
