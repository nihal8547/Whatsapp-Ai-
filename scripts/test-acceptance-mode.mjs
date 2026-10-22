import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const tenantId = 59;
    const phone = "97430954643";
    const customerName = "Test Auto";
    const fulfilment = "delivery";
    const address = "Al Aziziya, Doha";
    const totalAmount = 469;
    const itemsSummary = "Winter Drift Bike (Red) x 1";

    console.log("Testing Acceptance Mode aware query...");

    const res = await client.query(`
      WITH tenant_info AS (
        SELECT t.id,
          COALESCE(NULLIF(t.modules, '[]'::jsonb), bp.modules, '[]'::jsonb) AS mods,
          COALESCE(bs.order_settings, '{}'::jsonb) AS oset
        FROM wa_tenants t
        LEFT JOIN wa_business_packs bp ON bp.code = COALESCE(t.pack_code, t.business_type)
        LEFT JOIN wa_bot_settings bs ON bs.tenant_id = t.id
        WHERE t.id = $1::int
      ),
      mod_check AS (
        SELECT
          (mods ? 'orders') AS enabled,
          COALESCE((oset->>'accepting_orders')::boolean, true) AS accepting,
          COALESCE(oset->>'closed_message', 'We are currently not accepting new orders at this time. Please check back later!') AS closed_msg,
          COALESCE(oset->>'accept_mode', 'manual') AS accept_mode,
          COALESCE((oset->>'prep_minutes')::int, 30) AS prep_minutes,
          COALESCE((oset->>'pickup')::boolean, true) AS allow_pickup,
          COALESCE((oset->>'delivery')::boolean, true) AS allow_delivery,
          COALESCE((oset->>'min_order')::numeric, 0) AS min_order
        FROM tenant_info
      ),
      val_check AS (
        SELECT
          mc.*,
          CASE
            WHEN NOT mc.enabled THEN 'ORDERS_NOT_ENABLED'
            WHEN NOT mc.accepting THEN 'ORDERS_CLOSED'
            WHEN lower(trim(COALESCE($4, ''))) = 'pickup' AND NOT mc.allow_pickup THEN 'PICKUP_NOT_ALLOWED'
            WHEN lower(trim(COALESCE($4, ''))) <> 'pickup' AND NOT mc.allow_delivery THEN 'DELIVERY_NOT_ALLOWED'
            WHEN mc.min_order > 0 AND COALESCE($6::numeric, 0) < mc.min_order THEN 'BELOW_MIN_ORDER'
            ELSE 'OK'
          END AS check_result
        FROM mod_check mc
      ),
      gen_no AS (
        INSERT INTO wa_order_counters (tenant_id, last_no)
        SELECT $1::int, 1001
        FROM val_check WHERE check_result = 'OK'
        ON CONFLICT (tenant_id) DO UPDATE
          SET last_no = wa_order_counters.last_no + 1
        RETURNING last_no
      ),
      ins_contact AS (
        INSERT INTO wa_contacts (tenant_id, phone, name)
        SELECT $1::int, $2, NULLIF(trim($3), '')
        FROM val_check WHERE check_result = 'OK'
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
          CASE WHEN vc.accept_mode = 'auto' THEN 'accepted' ELSE 'pending' END,
          CASE WHEN lower(trim(COALESCE($4, ''))) = 'pickup' THEN 'pickup' ELSE 'delivery' END,
          NULLIF(trim($5), ''),
          NULLIF(trim($3), ''),
          COALESCE($6::numeric, 0),
          COALESCE($6::numeric, 0),
          COALESCE((SELECT currency FROM wa_catalog_items WHERE tenant_id = $1::int AND currency IS NOT NULL LIMIT 1), 'QAR'),
          NULLIF(trim(COALESCE($7::text, '') || CASE WHEN $8::text IS NOT NULL AND trim($8::text) <> '' THEN ' | Notes: ' || trim($8::text) ELSE '' END), ''),
          (vc.accept_mode = 'auto'),
          now()
        FROM val_check vc
        WHERE vc.check_result = 'OK'
        RETURNING id, order_no, status, total, currency
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
          '📦 New Order #' || o.order_no || CASE WHEN o.status = 'accepted' THEN ' (Auto-Accepted)' ELSE '' END,
          'Customer: ' || COALESCE(NULLIF(trim($3), ''), $2) || ' (' || $2 || ') placed an order. Total: ' || o.total || ' ' || o.currency || '. Status: ' || o.status || '. Items: ' || COALESCE(NULLIF(trim($7), ''), 'N/A') || '. Location: ' || COALESCE(NULLIF(trim($5), ''), 'N/A'),
          'order',
          o.id
        FROM ins_order o
        RETURNING id
      )
      SELECT
        CASE
          WHEN (SELECT check_result FROM val_check) <> 'OK' THEN (SELECT check_result FROM val_check)
          WHEN EXISTS (SELECT 1 FROM ins_order) THEN 'ORDER_CREATED'
          ELSE 'FAILED'
        END AS status,
        (SELECT id FROM ins_order) AS order_id,
        (SELECT order_no FROM ins_order) AS order_no,
        (SELECT status FROM ins_order) AS order_status,
        (SELECT total FROM ins_order) AS total,
        (SELECT currency FROM ins_order) AS currency,
        CASE
          WHEN (SELECT check_result FROM val_check) = 'ORDERS_NOT_ENABLED' THEN 'Orders module is not enabled for this business.'
          WHEN (SELECT check_result FROM val_check) = 'ORDERS_CLOSED' THEN (SELECT closed_msg FROM val_check)
          WHEN (SELECT check_result FROM val_check) = 'PICKUP_NOT_ALLOWED' THEN 'In-store pickup is not available. We only offer delivery.'
          WHEN (SELECT check_result FROM val_check) = 'DELIVERY_NOT_ALLOWED' THEN 'Delivery is not available. We only offer in-store pickup.'
          WHEN (SELECT check_result FROM val_check) = 'BELOW_MIN_ORDER' THEN 'Minimum order amount is ' || (SELECT min_order FROM val_check) || ' QAR.'
          WHEN (SELECT status FROM ins_order) = 'accepted' THEN 'Order #' || (SELECT order_no FROM ins_order) || ' has been automatically ACCEPTED. Estimated preparation time is ' || (SELECT prep_minutes FROM val_check) || ' minutes. Total: ' || (SELECT total FROM ins_order) || ' ' || (SELECT currency FROM ins_order) || '. Team is preparing it now.'
          WHEN EXISTS (SELECT 1 FROM ins_order) THEN 'Order #' || (SELECT order_no FROM ins_order) || ' has been received with status pending. Team will review and confirm shortly.'
          ELSE 'Could not create order in database.'
        END AS reason;
    `, [tenantId, phone, customerName, fulfilment, address, totalAmount, itemsSummary, ""]);

    console.log("Result:", res.rows);
  } finally {
    client.release();
    await pool.end();
  }
}
run();
