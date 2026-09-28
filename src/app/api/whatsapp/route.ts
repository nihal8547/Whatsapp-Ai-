import { requireOwner, errorResponse } from "@/lib/auth";
import { n8n } from "@/lib/n8n";
import { one } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);
    try {
      const res = await n8n("whatsapp_status", { tenant_id: tenantId });
      return Response.json({ ok: true, ...res });
    } catch {
      // No instance yet, or Evolution unreachable — fall back to what we stored.
      const row = await one(
        `SELECT status, instance_name FROM wa_instances WHERE tenant_id = $1`,
        [tenantId]
      );
      return Response.json({
        ok: true,
        status: row?.status ?? "none",
        instance: row?.instance_name ?? null,
        stale: true,
      });
    }
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);
    const { action } = await req.json();
    if (action === "connect") {
      const res = await n8n("whatsapp_connect", { tenant_id: tenantId });
      return Response.json({ ok: true, ...res });
    }
    if (action === "disconnect") {
      const res = await n8n("whatsapp_disconnect", { tenant_id: tenantId });
      return Response.json({ ok: true, ...res });
    }
    return Response.json({ ok: false, error: "unknown_action" }, { status: 400 });
  } catch (e) {
    return errorResponse(e);
  }
}
