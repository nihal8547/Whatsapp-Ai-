CREATE TABLE IF NOT EXISTS wa_resources (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'staff' CHECK (kind IN ('staff', 'doctor', 'table', 'room', 'chair', 'generic')),
  capacity INT NOT NULL DEFAULT 1 CHECK (capacity > 0),
  bio TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS wa_resource_hours (
  resource_id INT NOT NULL REFERENCES wa_resources(id) ON DELETE CASCADE,
  weekday INT NOT NULL CHECK (weekday BETWEEN 0 AND 6),
  open_time TIME NOT NULL DEFAULT '09:00',
  close_time TIME NOT NULL DEFAULT '18:00',
  is_off BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (resource_id, weekday)
);

CREATE TABLE IF NOT EXISTS wa_resource_services (
  resource_id INT NOT NULL REFERENCES wa_resources(id) ON DELETE CASCADE,
  service_id INT NOT NULL REFERENCES wa_services(id) ON DELETE CASCADE,
  PRIMARY KEY (resource_id, service_id)
);

CREATE TABLE IF NOT EXISTS wa_time_off (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  resource_id INT REFERENCES wa_resources(id) ON DELETE CASCADE,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  reason TEXT,
  CHECK (end_at > start_at)
);

ALTER TABLE wa_appointments ADD COLUMN IF NOT EXISTS resource_id INT REFERENCES wa_resources(id) ON DELETE SET NULL;
ALTER TABLE wa_appointments ADD COLUMN IF NOT EXISTS party_size INT NOT NULL DEFAULT 1;
ALTER TABLE wa_appointments ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'appointment';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wa_appointments_kind_chk') THEN
    ALTER TABLE wa_appointments ADD CONSTRAINT wa_appointments_kind_chk CHECK (kind IN ('appointment', 'table', 'visit', 'demo', 'consultation'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS wa_stays (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL,
  phone TEXT NOT NULL,
  guest_name TEXT,
  room_type_id INT REFERENCES wa_catalog_items(id) ON DELETE SET NULL,
  rooms INT NOT NULL DEFAULT 1 CHECK (rooms > 0),
  guests INT NOT NULL DEFAULT 1 CHECK (guests > 0),
  check_in DATE NOT NULL,
  check_out DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'rejected')),
  total NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'QAR',
  notes TEXT,
  staff_alerted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (check_out > check_in),
  CONSTRAINT wa_stays_contact_fk FOREIGN KEY (tenant_id, phone) REFERENCES wa_contacts (tenant_id, phone) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS wa_stays_tenant_idx ON wa_stays (tenant_id, check_in);
