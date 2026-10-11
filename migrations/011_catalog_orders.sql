CREATE TABLE IF NOT EXISTS wa_catalog_categories (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS wa_catalog_items (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  category_id INT REFERENCES wa_catalog_categories(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'product' CHECK (kind IN ('product', 'dish', 'room_type', 'package', 'listing', 'course', 'add_on')),
  name TEXT NOT NULL,
  aliases TEXT[] NOT NULL DEFAULT '{}',
  description TEXT,
  price NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'QAR',
  unit TEXT NOT NULL DEFAULT 'each',
  track_stock BOOLEAN NOT NULL DEFAULT false,
  stock_qty NUMERIC(12,2),
  available BOOLEAN NOT NULL DEFAULT true,
  variants JSONB NOT NULL DEFAULT '[]'::jsonb,
  attributes JSONB NOT NULL DEFAULT '{}'::jsonb,
  media_id INT REFERENCES wa_media(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, name)
);
CREATE INDEX IF NOT EXISTS wa_catalog_items_tenant_idx ON wa_catalog_items (tenant_id, active, kind);
CREATE INDEX IF NOT EXISTS wa_catalog_items_name_trgm ON wa_catalog_items USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS wa_customer_addresses (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL,
  phone TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT 'Home',
  address_text TEXT NOT NULL,
  lat NUMERIC(9,6),
  lng NUMERIC(9,6),
  notes TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT wa_customer_addresses_contact_fk FOREIGN KEY (tenant_id, phone) REFERENCES wa_contacts (tenant_id, phone) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS wa_delivery_zones (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  min_order NUMERIC(12,2) NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (tenant_id, name)
);

CREATE TABLE IF NOT EXISTS wa_order_counters (
  tenant_id INT PRIMARY KEY REFERENCES wa_tenants(id) ON DELETE CASCADE,
  last_no INT NOT NULL DEFAULT 1000
);

CREATE TABLE IF NOT EXISTS wa_orders (
  id SERIAL PRIMARY KEY,
  tenant_id INT NOT NULL,
  phone TEXT NOT NULL,
  order_no TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled', 'rejected')),
  fulfilment TEXT CHECK (fulfilment IN ('pickup', 'delivery', 'dine_in')),
  address_text TEXT,
  zone_id INT REFERENCES wa_delivery_zones(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ,
  payment_method TEXT NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod', 'bank_transfer', 'online', 'pay_at_pickup')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'QAR',
  customer_name TEXT,
  notes TEXT,
  staff_notes TEXT,
  cancel_reason TEXT,
  tracking_ref TEXT,
  staff_alerted BOOLEAN NOT NULL DEFAULT false,
  nudged_at TIMESTAMPTZ,
  placed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, order_no),
  CONSTRAINT wa_orders_contact_fk FOREIGN KEY (tenant_id, phone) REFERENCES wa_contacts (tenant_id, phone) ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS wa_orders_one_draft_idx ON wa_orders (tenant_id, phone) WHERE status = 'draft';
CREATE INDEX IF NOT EXISTS wa_orders_board_idx ON wa_orders (tenant_id, status, placed_at DESC);

CREATE TABLE IF NOT EXISTS wa_order_items (
  id SERIAL PRIMARY KEY,
  order_id INT NOT NULL REFERENCES wa_orders(id) ON DELETE CASCADE,
  tenant_id INT NOT NULL REFERENCES wa_tenants(id) ON DELETE CASCADE,
  item_id INT REFERENCES wa_catalog_items(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  variant TEXT NOT NULL DEFAULT '',
  qty NUMERIC(12,2) NOT NULL CHECK (qty > 0 AND qty <= 999),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  UNIQUE (order_id, item_id, variant)
);

ALTER TABLE wa_bot_settings ADD COLUMN IF NOT EXISTS order_settings JSONB NOT NULL DEFAULT '{"accepting_orders": true, "accept_mode": "manual", "pickup": true, "delivery": true, "payment_methods": ["cod"], "min_order": 0, "prep_minutes": 30, "status_messages": {}}'::jsonb;
