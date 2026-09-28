import { requireTenant, requireOwner, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const services = await q(
      `SELECT id, name, COALESCE(description,'') AS description, duration_min, price, currency, active
         FROM wa_services WHERE tenant_id = $1 ORDER BY active DESC, id`,
      [tenantId]
    );
    return Response.json({ ok: true, services });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);
    const b = await req.json();
    const name = String(b.name || "").trim();
    if (!name) return Response.json({ ok: false, error: "missing_name" }, { status: 400 });

    const row = await one(
      `INSERT INTO wa_services (tenant_id, name, description, duration_min, price, currency, active)
       VALUES ($1, $2, NULLIF($3,''), $4, $5, COALESCE(NULLIF($6,''),'QAR'), true)
       ON CONFLICT (tenant_id, name) DO UPDATE
         SET description = EXCLUDED.description, duration_min = EXCLUDED.duration_min,
             price = EXCLUDED.price, currency = EXCLUDED.currency, active = true
       RETURNING id`,
      [
        tenantId,
        name,
        String(b.description || ""),
        Number(b.duration_min) || 30,
        b.price === "" || b.price === null || b.price === undefined ? null : Number(b.price),
        String(b.currency || ""),
      ]
    );
    return Response.json({ ok: true, ...row });
  } catch (e) {
    return errorResponse(e);
  }
}
