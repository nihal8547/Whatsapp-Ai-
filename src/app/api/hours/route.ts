import { requireTenant, requireOwner, errorResponse } from "@/lib/auth";
import { q } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const hours = await q(
      `SELECT weekday, to_char(open_time,'HH24:MI') AS open_time,
              to_char(close_time,'HH24:MI') AS close_time, is_closed
         FROM wa_business_hours WHERE tenant_id = $1 ORDER BY weekday`,
      [tenantId]
    );
    return Response.json({ ok: true, hours });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);
    const { hours } = await req.json();
    if (!Array.isArray(hours)) {
      return Response.json({ ok: false, error: "bad_payload" }, { status: 400 });
    }
    for (const h of hours) {
      await q(
        `INSERT INTO wa_business_hours (tenant_id, weekday, open_time, close_time, is_closed)
         VALUES ($1, $2, $3::time, $4::time, $5)
         ON CONFLICT (tenant_id, weekday) DO UPDATE
           SET open_time = EXCLUDED.open_time, close_time = EXCLUDED.close_time,
               is_closed = EXCLUDED.is_closed`,
        [tenantId, Number(h.weekday), h.open_time || "09:00", h.close_time || "18:00", !!h.is_closed]
      );
    }
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
