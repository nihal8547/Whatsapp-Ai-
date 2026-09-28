import { requireTenant, errorResponse } from "@/lib/auth";
import { q } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const search = (new URL(req.url).searchParams.get("search") || "").trim();
    const contacts = await q(
      `SELECT c.phone, COALESCE(NULLIF(c.name,''),'') AS name, c.bot_enabled, c.needs_human,
              c.created_at, c.last_message_at,
              COALESCE(um.summary,'') AS summary,
              (SELECT count(*) FROM wa_appointments a
                WHERE a.tenant_id = c.tenant_id AND a.phone = c.phone AND a.status = 'confirmed') AS bookings
         FROM wa_contacts c
         LEFT JOIN wa_user_memory um ON um.tenant_id = c.tenant_id AND um.phone = c.phone
        WHERE c.tenant_id = $1
          AND ($2 = '' OR c.phone ILIKE '%' || $2 || '%' OR COALESCE(c.name,'') ILIKE '%' || $2 || '%')
        ORDER BY c.last_message_at DESC NULLS LAST LIMIT 200`,
      [tenantId, search]
    );
    return Response.json({ ok: true, contacts });
  } catch (e) {
    return errorResponse(e);
  }
}
