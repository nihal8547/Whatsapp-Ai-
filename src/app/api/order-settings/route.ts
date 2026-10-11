import { requireTenant, requireOwner, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

const DEFAULT_ORDER_SETTINGS = {
  accepting_orders: true,
  closed_message: "We are currently not accepting new orders at this time. Please check back later!",
  accept_mode: "manual", // 'manual' | 'auto'
  pickup: true,
  delivery: true,
  payment_methods: ["cod"], // 'cod', 'bank_transfer', 'pay_at_pickup'
  min_order: 0,
  prep_minutes: 30,
  status_messages: {
    accepted: "Your order #{order_no} has been accepted! Total: {total}. Estimated preparation time is {minutes} minutes.",
    preparing: "Your order #{order_no} is now being prepared in our kitchen/store.",
    ready: "Good news {name}! Your order #{order_no} is ready.",
    out_for_delivery: "Your order #{order_no} is on the way! Our driver will reach you shortly.",
    completed: "Thank you {name}! Your order #{order_no} is completed. Enjoy!",
    cancelled: "Your order #{order_no} has been cancelled. If you have questions, please let us know.",
    rejected: "Sorry {name}, we are unable to accept order #{order_no} at this moment.",
  },
};

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);

    const row = await one<{ order_settings: any }>(
      `SELECT order_settings FROM wa_bot_settings WHERE tenant_id = $1`,
      [tenantId]
    );

    const current = row?.order_settings || {};
    const merged = {
      ...DEFAULT_ORDER_SETTINGS,
      ...current,
      status_messages: {
        ...DEFAULT_ORDER_SETTINGS.status_messages,
        ...(current.status_messages || {}),
      },
    };

    return Response.json({ ok: true, settings: merged });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);
    const body = await req.json();

    const patchData: any = {};
    if (body.accepting_orders !== undefined) patchData.accepting_orders = Boolean(body.accepting_orders);
    if (body.closed_message !== undefined) patchData.closed_message = String(body.closed_message);
    if (body.accept_mode !== undefined) patchData.accept_mode = body.accept_mode === "auto" ? "auto" : "manual";
    if (body.pickup !== undefined) patchData.pickup = Boolean(body.pickup);
    if (body.delivery !== undefined) patchData.delivery = Boolean(body.delivery);
    if (Array.isArray(body.payment_methods)) patchData.payment_methods = body.payment_methods;
    if (body.min_order !== undefined) patchData.min_order = Number(body.min_order);
    if (body.prep_minutes !== undefined) patchData.prep_minutes = Number(body.prep_minutes);
    if (body.status_messages && typeof body.status_messages === "object") {
      patchData.status_messages = body.status_messages;
    }

    const updated = await one<{ order_settings: any }>(
      `UPDATE wa_bot_settings
          SET order_settings = COALESCE(order_settings, '{}'::jsonb) || $1::jsonb
        WHERE tenant_id = $2
        RETURNING order_settings`,
      [JSON.stringify(patchData), tenantId]
    );

    const merged = {
      ...DEFAULT_ORDER_SETTINGS,
      ...(updated?.order_settings || {}),
      status_messages: {
        ...DEFAULT_ORDER_SETTINGS.status_messages,
        ...(updated?.order_settings?.status_messages || {}),
      },
    };

    return Response.json({ ok: true, settings: merged });
  } catch (e) {
    return errorResponse(e);
  }
}
