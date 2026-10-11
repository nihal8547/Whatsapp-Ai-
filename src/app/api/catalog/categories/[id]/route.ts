import { requireOwner, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireOwner(req);
    const { id } = await ctx.params;
    const catId = Number(id);
    if (!catId) return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });

    const body = await req.json();
    const existing = await one(
      `SELECT * FROM wa_catalog_categories WHERE id = $1 AND tenant_id = $2`,
      [catId, tenantId]
    );
    if (!existing) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const name = body.name !== undefined ? String(body.name).trim() : existing.name;
    if (!name) {
      return Response.json({ ok: false, error: "name_cannot_be_empty" }, { status: 400 });
    }
    const sortOrder = body.sort_order !== undefined ? Number(body.sort_order) : existing.sort_order;
    const active = body.active !== undefined ? Boolean(body.active) : existing.active;

    const updated = await one(
      `UPDATE wa_catalog_categories
          SET name = $1, sort_order = $2, active = $3
        WHERE id = $4 AND tenant_id = $5
        RETURNING *`,
      [name, sortOrder, active, catId, tenantId]
    );

    return Response.json({ ok: true, category: updated });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireOwner(req);
    const { id } = await ctx.params;
    const catId = Number(id);

    const deleted = await one(
      `DELETE FROM wa_catalog_categories WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [catId, tenantId]
    );

    if (!deleted) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
