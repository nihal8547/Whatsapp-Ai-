import { requireTenant, requireOwner, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const zones = await q(
      `SELECT id, tenant_id, name, fee, min_order, active
         FROM wa_delivery_zones
        WHERE tenant_id = $1
        ORDER BY name ASC`,
      [tenantId]
    );

    return Response.json({ ok: true, zones });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);
    const body = await req.json();

    const name = String(body.name || "").trim();
    if (!name) {
      return Response.json({ ok: false, error: "missing_name" }, { status: 400 });
    }

    const fee = body.fee !== undefined ? Number(body.fee) : 0;
    const minOrder = body.min_order !== undefined ? Number(body.min_order) : 0;
    const active = body.active !== undefined ? Boolean(body.active) : true;

    const zone = await one(
      `INSERT INTO wa_delivery_zones (tenant_id, name, fee, min_order, active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (tenant_id, name) DO UPDATE SET
         fee = EXCLUDED.fee,
         min_order = EXCLUDED.min_order,
         active = EXCLUDED.active
       RETURNING *`,
      [tenantId, name, fee, minOrder, active]
    );

    return Response.json({ ok: true, zone });
  } catch (e) {
    return errorResponse(e);
  }
}
