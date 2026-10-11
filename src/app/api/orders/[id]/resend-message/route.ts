import { requireTenant, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";
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

    const order = await one<any>(
      `SELECT * FROM wa_orders WHERE id = $1 AND tenant_id = $2`,
      [orderId, tenantId]
    );

    if (!order) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const botSettings = await one<{ order_settings: any }>(
      `SELECT order_settings FROM wa_bot_settings WHERE tenant_id = $1`,
      [tenantId]
    );
    const orderSettings = botSettings?.order_settings || {};
    const statusMessages = orderSettings?.status_messages || {};

    let template = statusMessages[order.status] || DEFAULT_STATUS_MESSAGES[order.status];
    if (!template) {
      return Response.json({ ok: false, error: "no_template_for_status" }, { status: 400 });
    }

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

    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
