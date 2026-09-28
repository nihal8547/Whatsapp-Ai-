import { requireOwner, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, session } = await requireOwner(req);
    const { id } = await ctx.params;
    if (Number(id) === session.userId) {
      return Response.json({ ok: false, error: "cannot_remove_yourself" }, { status: 400 });
    }
    const row = await one(
      `DELETE FROM wa_tenant_users
        WHERE tenant_id = $1 AND id = $2::int AND role <> 'owner' RETURNING id`,
      [tenantId, id]
    );
    if (!row) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
