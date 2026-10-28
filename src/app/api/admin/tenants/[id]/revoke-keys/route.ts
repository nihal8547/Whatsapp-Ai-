import { requireSuperAdmin, errorResponse } from "@/lib/auth";
import { q } from "@/lib/db";

export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();
    const { id } = await ctx.params;
    const tenantIdNum = Number(id);

    const revoked = await q(
      `UPDATE wa_tenant_api_keys
          SET active = false
        WHERE tenant_id = $1::int AND active = true
        RETURNING id`,
      [tenantIdNum]
    );

    return Response.json({ ok: true, revoked_count: revoked.length });
  } catch (e) {
    return errorResponse(e);
  }
}
