import { requireTenant, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const url = new URL(req.url);
    const scope = url.searchParams.get("scope") || "upcoming";

    const rows = await q(
      `SELECT a.id, a.phone, COALESCE(NULLIF(a.customer_name,''), c.name, '') AS customer_name,
              a.service_id, sv.name AS service, a.start_time, a.end_time, a.status,
              COALESCE(a.notes,'') AS notes, a.source
         FROM wa_appointments a
         JOIN wa_services sv ON sv.id = a.service_id
         LEFT JOIN wa_contacts c ON c.tenant_id = a.tenant_id AND c.phone = a.phone
        WHERE a.tenant_id = $1
          AND ($2 = 'all'
               OR ($2 = 'upcoming' AND a.start_time >= now() - interval '2 hours')
               OR ($2 = 'past' AND a.start_time < now()))
        ORDER BY a.start_time ` + (scope === "past" ? "DESC" : "ASC") + ` LIMIT 200`,
      [tenantId, scope]
    );
    return Response.json({ ok: true, appointments: rows });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const b = await req.json();
    const phone = String(b.phone || "").replace(/[^0-9]/g, "");
    const serviceId = Number(b.service_id);
    const startLocal = String(b.start_time || ""); // "YYYY-MM-DDTHH:mm" in the tenant's zone

    if (!phone || !serviceId || !startLocal) {
      return Response.json({ ok: false, error: "missing_fields" }, { status: 400 });
    }

    const row = await one(
      `WITH cfg AS (SELECT timezone FROM wa_bot_settings WHERE tenant_id = $1),
       c AS (
         INSERT INTO wa_contacts (tenant_id, phone, name)
         VALUES ($1, $2, NULLIF($5,''))
         ON CONFLICT (tenant_id, phone) DO UPDATE SET name = COALESCE(wa_contacts.name, EXCLUDED.name)
         RETURNING phone
       ), svc AS (
         SELECT id, duration_min FROM wa_services WHERE tenant_id = $1 AND id = $3
       ), t AS (
         SELECT (replace($4,'T',' ')::timestamp AT TIME ZONE cfg.timezone) AS st FROM cfg
       )
       INSERT INTO wa_appointments (tenant_id, phone, customer_name, service_id, start_time, end_time, notes, source)
       SELECT $1, c.phone, NULLIF($5,''), svc.id, t.st,
              t.st + make_interval(mins => svc.duration_min), NULLIF($6,''), 'dashboard'
         FROM c, svc, t
       RETURNING id, start_time`,
      [tenantId, phone, serviceId, startLocal, String(b.customer_name || ""), String(b.notes || "")]
    );
    return Response.json({ ok: true, appointment: row });
  } catch (e: any) {
    if (String(e?.code) === "23P01") {
      return Response.json({ ok: false, error: "slot_taken" }, { status: 409 });
    }
    return errorResponse(e);
  }
}
