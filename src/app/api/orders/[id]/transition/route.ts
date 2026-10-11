import { requireTenant, errorResponse } from "@/lib/auth";
import { one, q, tx } from "@/lib/db";
import { n8n } from "@/lib/n8n";

const DEFAULT_STATUS_MESSAGES: Record<string, string> = {
  accepted: "Your order #{order_no} has been accepted! Total: {total}. Estimated preparation time is {minutes} minutes.",
  preparing: "Your order #{order_no} is now being prepared in our kitchen/store.",
  ready: "Good news {name}! Your order #{order_no} is ready.",
  out_for_delivery: "Your order #{order_no} is on the way! Our driver will reach you shortly.",
  completed: "Thank you {name}! Your order #{order_no} is completed. Enjoy!",
  cancelled: "Your order #{order_no} has been cancelled. If you have questions, please let us know.",
  rejected: "Sorry {name}, we are unable to accept order #{order_no} at this moment.",
};

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, session } = await requireTenant(req);
    const { id } = await ctx.params;
    const orderId = Number(id);
    if (!orderId) return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });

    const body = await req.json();
    const nextStatus = String(body.status || "").trim().toLowerCase();
    const reason = String(body.reason || "").trim();

    // Fetch existing order
    const order = await one<any>(
      `SELECT * FROM wa_orders WHERE id = $1 AND tenant_id = $2`,
      [orderId, tenantId]
    );

    if (!order) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const currentStatus = order.status;
    const fulfilment = order.fulfilment || "delivery";

    // Validate transitions according to rules
    let valid = false;
    if (currentStatus === "pending") {
      valid = nextStatus === "accepted" || nextStatus === "rejected" || nextStatus === "cancelled";
    } else if (currentStatus === "accepted") {
      valid = nextStatus === "preparing" || nextStatus === "cancelled";
    } else if (currentStatus === "preparing") {
      valid = nextStatus === "ready" || nextStatus === "cancelled";
    } else if (currentStatus === "ready") {
      if (fulfilment === "pickup" || fulfilment === "dine_in") {
        valid = nextStatus === "completed" || nextStatus === "cancelled";
      } else {
        valid = nextStatus === "out_for_delivery" || nextStatus === "cancelled";
      }
    } else if (currentStatus === "out_for_delivery") {
      valid = nextStatus === "completed" || nextStatus === "cancelled";
    }

    if (!valid) {
      return Response.json(
        {
          ok: false,
          error: "invalid_transition",
          message: `Cannot transition order #${order.order_no} (${fulfilment}) from '${currentStatus}' to '${nextStatus}'.`,
        },
        { status: 409 }
      );
    }

    if (nextStatus === "rejected" && !reason) {
      return Response.json(
        { ok: false, error: "reason_required", message: "A reason is required to reject an order." },
        { status: 400 }
      );
    }

    // Execute status transition and stock update inside transaction
    const updatedOrder = await tx(async (client) => {
      // 1. Update order status
      let cancelReason = order.cancel_reason;
      if (nextStatus === "rejected" || nextStatus === "cancelled") {
        cancelReason = reason || cancelReason;
      }

      const res = await client.query(
        `UPDATE wa_orders
            SET status = $1,
                cancel_reason = $2,
                updated_at = now()
          WHERE id = $3 AND tenant_id = $4
          RETURNING *`,
        [nextStatus, cancelReason, orderId, tenantId]
      );
      const updated = res.rows[0];

      // 2. Stock tracking logic
      // When moving to 'accepted', decrement stock_qty for items with track_stock = true
      if (nextStatus === "accepted" && currentStatus === "pending") {
        const itemsRes = await client.query(
          `SELECT oi.item_id, oi.qty, ci.name, ci.stock_qty, ci.track_stock
             FROM wa_order_items oi
             JOIN wa_catalog_items ci ON ci.id = oi.item_id AND ci.tenant_id = oi.tenant_id
            WHERE oi.order_id = $1 AND oi.tenant_id = $2 AND ci.track_stock = true`,
          [orderId, tenantId]
        );

        for (const it of itemsRes.rows) {
          await client.query(
            `UPDATE wa_catalog_items
                SET stock_qty = GREATEST(0, stock_qty - $1),
                    updated_at = now()
              WHERE id = $2 AND tenant_id = $3`,
            [Number(it.qty), it.item_id, tenantId]
          );
        }
      }

      // If cancelling or rejecting from 'accepted' or later, restore stock
      if (
        (nextStatus === "cancelled" || nextStatus === "rejected") &&
        ["accepted", "preparing", "ready", "out_for_delivery"].includes(currentStatus)
      ) {
        const itemsRes = await client.query(
          `SELECT oi.item_id, oi.qty
             FROM wa_order_items oi
             JOIN wa_catalog_items ci ON ci.id = oi.item_id AND ci.tenant_id = oi.tenant_id
            WHERE oi.order_id = $1 AND oi.tenant_id = $2 AND ci.track_stock = true`,
          [orderId, tenantId]
        );

        for (const it of itemsRes.rows) {
          await client.query(
            `UPDATE wa_catalog_items
                SET stock_qty = stock_qty + $1,
                    updated_at = now()
              WHERE id = $2 AND tenant_id = $3`,
            [Number(it.qty), it.item_id, tenantId]
          );
        }
      }

      return updated;
    });

    // 3. Dispatch WhatsApp notification to customer via n8n
    let messageSent = false;
    let messageError: string | null = null;

    try {
      const botSettings = await one<{ order_settings: any }>(
        `SELECT order_settings FROM wa_bot_settings WHERE tenant_id = $1`,
        [tenantId]
      );
      const orderSettings = botSettings?.order_settings || {};
      const statusMessages = orderSettings?.status_messages || {};

      let template = statusMessages[nextStatus] || DEFAULT_STATUS_MESSAGES[nextStatus];
      if (template) {
        const msgText = template
          .replace(/{name}/g, order.customer_name || "there")
          .replace(/{order_no}/g, order.order_no)
          .replace(/{total}/g, `${order.currency} ${Number(order.total).toFixed(2)}`)
          .replace(/{minutes}/g, String(orderSettings.prep_minutes || 30));

        await n8n("send_message", {
          tenant_id: tenantId,
          phone: String(order.phone).replace(/[^0-9]/g, ""),
          text: msgText,
          staff_name: session.name,
          add_to_memory: true,
        });
        messageSent = true;
      }
    } catch (err: any) {
      messageSent = false;
      messageError = err?.message || String(err);
    }

    return Response.json({
      ok: true,
      order: updatedOrder,
      messageSent,
      messageError,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
