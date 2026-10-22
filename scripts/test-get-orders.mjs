import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  const client = await pool.connect();
  try {
    const tenantId = 59;
    const rows = await client.query(
      `SELECT o.id, o.tenant_id, o.phone, o.order_no, o.status, o.fulfilment,
              o.address_text, o.zone_id, o.scheduled_for, o.payment_method,
              o.payment_status, o.subtotal, o.delivery_fee, o.discount, o.total,
              o.currency, o.customer_name, o.notes, o.staff_notes, o.cancel_reason,
              o.tracking_ref, o.staff_alerted, o.placed_at, o.created_at, o.updated_at,
              z.name AS zone_name,
              c.name AS contact_name,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'id', oi.id,
                  'item_id', oi.item_id,
                  'name', oi.name,
                  'variant', oi.variant,
                  'qty', oi.qty,
                  'unit_price', oi.unit_price,
                  'line_total', oi.line_total,
                  'notes', oi.notes
                ) ORDER BY oi.id)
                FROM wa_order_items oi
                WHERE oi.order_id = o.id AND oi.tenant_id = o.tenant_id
              ), '[]'::jsonb) AS items
         FROM wa_orders o
         LEFT JOIN wa_delivery_zones z ON z.id = o.zone_id AND z.tenant_id = o.tenant_id
         LEFT JOIN wa_contacts c ON c.tenant_id = o.tenant_id AND c.phone = o.phone
        WHERE o.tenant_id = $1
        ORDER BY o.placed_at DESC NULLS LAST, o.created_at DESC`,
      [tenantId]
    );

    console.log("Orders retrieved:", JSON.stringify(rows.rows, null, 2));
  } finally {
    client.release();
    await pool.end();
  }
}
run();
