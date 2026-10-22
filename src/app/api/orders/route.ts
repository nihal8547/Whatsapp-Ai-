import { requireTenant, errorResponse } from "@/lib/auth";
import { q } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let statusCondition = "";
    const params: any[] = [tenantId];

    if (status && status !== "all") {
      statusCondition = "AND o.status = $2";
      params.push(status);
    }

    const rows = await q(
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
        WHERE o.tenant_id = $1 ${statusCondition}
        ORDER BY o.placed_at DESC NULLS LAST, o.created_at DESC`,
      params
    );

    return Response.json({ ok: true, orders: rows });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const body = await req.json();

    const phone = String(body.phone || "").replace(/[^0-9]/g, "");
    if (!phone) {
      return Response.json({ ok: false, error: "Phone number is required" }, { status: 400 });
    }

    const customerName = (body.customer_name || "").trim();
    const fulfilment = body.fulfilment === "pickup" ? "pickup" : body.fulfilment === "dine_in" ? "dine_in" : "delivery";
    const addressText = (body.address_text || "").trim();
    const notes = (body.notes || "").trim();
    const staffNotes = (body.staff_notes || "").trim();
    const deliveryFee = Number(body.delivery_fee) || 0;
    const discount = Number(body.discount) || 0;
    const paymentMethod = body.payment_method || "cod";
    const paymentStatus = body.payment_status || "unpaid";
    const currency = body.currency || "QAR";
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (rawItems.length === 0 && !notes) {
      return Response.json({ ok: false, error: "At least one item or order notes is required" }, { status: 400 });
    }

    const items = rawItems.length > 0
      ? rawItems.map((it: any) => {
          const qty = Math.max(1, Number(it.qty) || 1);
          const unitPrice = Math.max(0, Number(it.unit_price) || 0);
          return {
            item_id: it.item_id ? Number(it.item_id) : null,
            name: (it.name || "Item").trim(),
            variant: (it.variant || "").trim(),
            qty,
            unit_price: unitPrice,
            line_total: Number((qty * unitPrice).toFixed(2)),
            notes: it.notes ? String(it.notes).trim() : null,
          };
        })
      : [
          {
            item_id: null,
            name: notes || "Order items",
            variant: "",
            qty: 1,
            unit_price: Number(body.total) || 0,
            line_total: Number(body.total) || 0,
            notes: addressText || null,
          },
        ];

    const subtotal = Number(items.reduce((sum: number, it: any) => sum + it.line_total, 0).toFixed(2));
    const total = Number(Math.max(0, subtotal + deliveryFee - discount).toFixed(2));

    const { tx } = await import("@/lib/db");
    const newOrder = await tx(async (client) => {
      // 1. Generate order_no atomically
      const counterRes = await client.query(
        `INSERT INTO wa_order_counters (tenant_id, last_no)
         VALUES ($1, 1001)
         ON CONFLICT (tenant_id) DO UPDATE
           SET last_no = wa_order_counters.last_no + 1
         RETURNING last_no`,
        [tenantId]
      );
      const orderNo = String(counterRes.rows[0].last_no);

      // 2. Ensure contact exists in wa_contacts
      await client.query(
        `INSERT INTO wa_contacts (tenant_id, phone, name)
         VALUES ($1, $2, NULLIF($3, ''))
         ON CONFLICT (tenant_id, phone) DO UPDATE
           SET name = COALESCE(NULLIF($3, ''), wa_contacts.name)`,
        [tenantId, phone, customerName]
      );

      // 3. Fetch tenant order settings for accept_mode
      const bsRow = await client.query(
        `SELECT order_settings FROM wa_bot_settings WHERE tenant_id = $1`,
        [tenantId]
      );
      const orderSettings = bsRow.rows[0]?.order_settings || {};
      const acceptMode = orderSettings.accept_mode === "auto" ? "auto" : "manual";
      const initialStatus = body.status || (acceptMode === "auto" ? "accepted" : "pending");

      // 4. Insert into wa_orders
      const orderRes = await client.query(
        `INSERT INTO wa_orders (
           tenant_id, phone, order_no, status, fulfilment,
           address_text, customer_name, subtotal, delivery_fee,
           discount, total, currency, notes, staff_notes,
           payment_method, payment_status, staff_alerted, placed_at
         )
         VALUES (
           $1, $2, $3, $4, $5,
           NULLIF($6, ''), NULLIF($7, ''), $8, $9,
           $10, $11, $12, NULLIF($13, ''), NULLIF($14, ''),
           $15, $16, true, now()
         )
         RETURNING *`,
        [
          tenantId, phone, orderNo, initialStatus, fulfilment,
          addressText, customerName, subtotal, deliveryFee,
          discount, total, currency, notes, staffNotes,
          paymentMethod, paymentStatus
        ]
      );
      const order = orderRes.rows[0];

      // 4. Insert items
      const insertedItems = [];
      for (const it of items) {
        const itemRes = await client.query(
          `INSERT INTO wa_order_items (
             order_id, tenant_id, item_id, name, variant, qty, unit_price, line_total, notes
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING *`,
          [order.id, tenantId, it.item_id, it.name, it.variant, it.qty, it.unit_price, it.line_total, it.notes]
        );
        insertedItems.push(itemRes.rows[0]);
      }

      // 5. Insert notification
      await client.query(
        `INSERT INTO wa_notifications (tenant_id, kind, title, body, ref_type, ref_id)
         VALUES (
           $1, 'new_order', '📦 New Order #' || $2,
           'Order #' || $2 || ' for ' || COALESCE(NULLIF($3, ''), $4) || ' (' || $4 || '). Total: ' || $5 || ' ' || $6,
           'order', $7
         )`,
        [tenantId, orderNo, customerName, phone, total, currency, order.id]
      );

      order.items = insertedItems;
      return order;
    });

    return Response.json({ ok: true, order: newOrder });
  } catch (e) {
    return errorResponse(e);
  }
}

