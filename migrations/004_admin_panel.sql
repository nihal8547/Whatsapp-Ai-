-- 004_admin_panel.sql
-- Safe to run more than once.
ALTER TABLE wa_tenants ADD COLUMN IF NOT EXISTS admin_notes TEXT NOT NULL DEFAULT '';
