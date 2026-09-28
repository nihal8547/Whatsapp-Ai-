import { requireSession, AuthError, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const s = await requireSession();
    if (!s.superAdmin) throw new AuthError("forbidden", 403);
    const { id } = await ctx.params;
    const b = await req.json();

    const row = await one(
      `UPDATE wa_tenants SET
         status = COALESCE(NULLIF($2,''), status),
         plan_id = COALESCE($3, plan_id),
         trial_ends_at = CASE WHEN $4::text = '' THEN trial_ends_at ELSE $4::timestamptz END
       WHERE id = $1::int RETURNING id, status, plan_id`,
      [
        id,
        ["trial", "active", "suspended", "cancelled"].includes(b.status) ? b.status : "",
        b.plan_id ? Number(b.plan_id) : null,
        b.trial_ends_at ? String(b.trial_ends_at) : "",
      ]
    );
    if (!row) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    return Response.json({ ok: true, ...row });
  } catch (e) {
    return errorResponse(e);
  }
}
