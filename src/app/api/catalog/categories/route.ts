import { requireTenant, requireOwner, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const categories = await q(
      `SELECT c.id, c.tenant_id, c.name, c.sort_order, c.active,
              (SELECT count(*)::int FROM wa_catalog_items i WHERE i.category_id = c.id AND i.tenant_id = c.tenant_id) AS item_count
         FROM wa_catalog_categories c
        WHERE c.tenant_id = $1
        ORDER BY c.sort_order ASC, c.name ASC`,
      [tenantId]
    );

    return Response.json({ ok: true, categories });
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

    const sortOrder = body.sort_order ? Number(body.sort_order) : 0;
    const active = body.active !== undefined ? Boolean(body.active) : true;

    const category = await one(
      `INSERT INTO wa_catalog_categories (tenant_id, name, sort_order, active)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, name) DO UPDATE SET
         sort_order = EXCLUDED.sort_order,
         active = EXCLUDED.active
       RETURNING *`,
      [tenantId, name, sortOrder, active]
    );

    return Response.json({ ok: true, category });
  } catch (e) {
    return errorResponse(e);
  }
}
