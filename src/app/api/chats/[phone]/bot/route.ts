import { requireTenant, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

export async function POST(req: Request, ctx: { params: Promise<{ phone: string }> }) {
  try {
    const { tenantId } = await requireTenant(req);
    const { phone } = await ctx.params;
    const { enabled } = await req.json();
    const on = enabled === true;

    const row = await one(
      `UPDATE wa_contacts
          SET bot_enabled = $3,
              needs_human = CASE WHEN $3 THEN false ELSE needs_human END,
              handoff_notified = CASE WHEN $3 THEN false ELSE handoff_notified END
        WHERE tenant_id = $1 AND phone = $2
        RETURNING phone, bot_enabled`,
      [tenantId, phone.replace(/[^0-9]/g, ""), on]
    );
    if (!row) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    return Response.json({ ok: true, ...row });
  } catch (e) {
    return errorResponse(e);
  }
}
