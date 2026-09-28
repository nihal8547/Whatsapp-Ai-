import { requireOwner, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireOwner(req);
    const { id } = await ctx.params;
    const b = await req.json();
    const row = await one(
      `UPDATE wa_services SET
         name = COALESCE(NULLIF($3,''), name),
         description = COALESCE($4, description),
         duration_min = COALESCE($5, duration_min),
         price = CASE WHEN $6::text = 'keep' THEN price ELSE NULLIF($6,'')::numeric END,
         active = COALESCE($7, active)
       WHERE tenant_id = $1 AND id = $2::int RETURNING id`,
      [
        tenantId,
        id,
        String(b.name ?? ""),
        b.description ?? null,
        b.duration_min ?? null,
        b.price === undefined ? "keep" : b.price === null ? "" : String(b.price),
        b.active ?? null,
      ]
    );
    if (!row) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    return Response.json({ ok: true, ...row });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireOwner(req);
    const { id } = await ctx.params;
    // Keep the row so past appointments still resolve; just retire it.
    const row = await one(
      `UPDATE wa_services SET active = false WHERE tenant_id = $1 AND id = $2::int RETURNING id`,
      [tenantId, id]
    );
    if (!row) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
