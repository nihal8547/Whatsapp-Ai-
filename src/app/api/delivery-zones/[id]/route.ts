import { requireOwner, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireOwner(req);
    const { id } = await ctx.params;
    const zoneId = Number(id);
    if (!zoneId) return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });

    const body = await req.json();
    const existing = await one(
      `SELECT * FROM wa_delivery_zones WHERE id = $1 AND tenant_id = $2`,
      [zoneId, tenantId]
    );
    if (!existing) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const name = body.name !== undefined ? String(body.name).trim() : existing.name;
    if (!name) {
      return Response.json({ ok: false, error: "name_cannot_be_empty" }, { status: 400 });
    }
    const fee = body.fee !== undefined ? Number(body.fee) : existing.fee;
    const minOrder = body.min_order !== undefined ? Number(body.min_order) : existing.min_order;
    const active = body.active !== undefined ? Boolean(body.active) : existing.active;

    const updated = await one(
      `UPDATE wa_delivery_zones
          SET name = $1, fee = $2, min_order = $3, active = $4
        WHERE id = $5 AND tenant_id = $6
        RETURNING *`,
      [name, fee, minOrder, active, zoneId, tenantId]
    );

    return Response.json({ ok: true, zone: updated });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireOwner(req);
    const { id } = await ctx.params;
    const zoneId = Number(id);

    const deleted = await one(
      `DELETE FROM wa_delivery_zones WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [zoneId, tenantId]
    );

    if (!deleted) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
