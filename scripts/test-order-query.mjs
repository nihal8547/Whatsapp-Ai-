import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const tenantId = 59;
    const phone = "97430954643";
    const customerName = "";
    const fulfilment = "delivery";
    const address = "Doha";
    const totalAmount = 938; // 469 x 2
    const itemsSummary = "Winter Drift Bike (Blue) x 1, Winter Drift Bike (Yellow) x 1";

    console.log("Testing create_order SQL logic...");

    const res = await client.query(`
      WITH tenant_info AS (
        SELECT t.id,
          COALESCE(NULLIF(t.modules, '[]'::jsonb), bp.modules, '[]'::jsonb) AS mods
        FROM wa_tenants t
        LEFT JOIN wa_business_packs bp ON bp.code = COALESCE(t.pack_code, t.business_type)
        WHERE t.id = $1::int
      ),
      mod_check AS (
        SELECT (mods ? 'orders') AS enabled FROM tenant_info
      ),
      gen_no AS (
        INSERT INTO wa_order_counters (tenant_id, last_no)
        VALUES ($1::int, 1001)
        ON CONFLICT (tenant_id) DO UPDATE
          SET last_no = wa_order_counters.last_no + 1
        RETURNING last_no
      ),
      ins_contact AS (
        INSERT INTO wa_contacts (tenant_id, phone, name)
        VALUES ($1::int, $2, NULLIF(trim($3), ''))
        ON CONFLICT (tenant_id, phone) DO UPDATE
          SET name = COALESCE(NULLIF(trim($3), ''), wa_contacts.name)
        RETURNING phone
      ),
      ins_order AS (
        INSERT INTO wa_orders (
          tenant_id, phone, order_no, status, fulfilment,
          address_text, customer_name, subtotal, total,
          currency, notes, staff_alerted, placed_at
        )
        SELECT
          $1::int,
          $2,
          (SELECT last_no::text FROM gen_no),
          'pending',
          COALESCE(NULLIF(lower(trim($4)), ''), 'delivery'),
          NULLIF(trim($5), ''),
          NULLIF(trim($3), ''),
          COALESCE($6::numeric, 0),
          COALESCE($6::numeric, 0),
          'QAR',
          NULLIF(trim($7), ''),
          false,
          now()
        WHERE (SELECT enabled FROM mod_check)
        RETURNING id, order_no, total, currency, status
      ),
      ins_item AS (
        INSERT INTO wa_order_items (order_id, tenant_id, name, qty, unit_price, line_total, notes)
        SELECT
          o.id,
          $1::int,
          COALESCE(NULLIF(trim($7), ''), 'Order items'),
          1,
          COALESCE($6::numeric, 0),
          COALESCE($6::numeric, 0),
          NULLIF(trim($5), '')
        FROM ins_order o
        RETURNING id
      ),
      ins_notif AS (
        INSERT INTO wa_notifications (tenant_id, kind, title, body, ref_type, ref_id)
        SELECT
          $1::int,
          'new_order',
          '📦 New Order #' || o.order_no,
          'Customer: ' || COALESCE(NULLIF(trim($3), ''), $2) || ' (' || $2 || ') placed an order. Total: ' || o.total || ' ' || o.currency || '. Items: ' || COALESCE(NULLIF(trim($7), ''), 'N/A') || '. Location: ' || COALESCE(NULLIF(trim($5), ''), 'N/A'),
          'order',
          o.id
        FROM ins_order o
        RETURNING id
      )
      SELECT
        CASE
          WHEN NOT (SELECT enabled FROM mod_check) THEN 'orders_not_enabled'
          WHEN EXISTS (SELECT 1 FROM ins_order) THEN 'ORDER_CREATED'
          ELSE 'FAILED'
        END AS status,
        (SELECT id FROM ins_order) AS order_id,
        (SELECT order_no FROM ins_order) AS order_no,
        (SELECT total FROM ins_order) AS total,
        (SELECT currency FROM ins_order) AS currency,
        CASE
          WHEN NOT (SELECT enabled FROM mod_check) THEN 'Orders module is not enabled for this business.'
          WHEN EXISTS (SELECT 1 FROM ins_order) THEN 'Order has been successfully created and saved in the system with status pending. Team has been notified.'
          ELSE 'Could not create order.'
        END AS reason;
    `, [tenantId, phone, customerName, fulfilment, address, totalAmount, itemsSummary]);

    console.log("Result:", res.rows);

    const checkOrder = await client.query(`SELECT * FROM wa_orders WHERE tenant_id = $1;`, [tenantId]);
    console.log("Saved order row in wa_orders:", checkOrder.rows);

    const checkItems = await client.query(`SELECT * FROM wa_order_items WHERE tenant_id = $1;`, [tenantId]);
    console.log("Saved order items:", checkItems.rows);

    const checkNotif = await client.query(`SELECT * FROM wa_notifications WHERE tenant_id = $1;`, [tenantId]);
    console.log("Saved notification:", checkNotif.rows);

  } catch (err) {
    console.error("Test failed:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
