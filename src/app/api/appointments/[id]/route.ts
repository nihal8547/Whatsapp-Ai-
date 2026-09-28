import { requireTenant, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireTenant(req);
    const { id } = await ctx.params;
    const { status } = await req.json();
    const allowed = ["confirmed", "cancelled", "completed", "no_show"];
    if (!allowed.includes(status)) {
      return Response.json({ ok: false, error: "bad_status" }, { status: 400 });
    }
    const row = await one(
      `UPDATE wa_appointments SET status = $3, updated_at = now()
        WHERE tenant_id = $1 AND id = $2::int RETURNING id, status`,
      [tenantId, id, status]
    );
    if (!row) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    return Response.json({ ok: true, ...row });
  } catch (e) {
    return errorResponse(e);
  }
}
