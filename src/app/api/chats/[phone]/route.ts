import { requireTenant, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

export async function GET(req: Request, ctx: { params: Promise<{ phone: string }> }) {
  try {
    const { tenantId } = await requireTenant(req);
    const { phone } = await ctx.params;
    const digits = phone.replace(/[^0-9]/g, "");

    const contact = await one(
      `SELECT phone, COALESCE(NULLIF(name,''),'') AS name, bot_enabled, needs_human,
              COALESCE(handoff_reason,'') AS handoff_reason
         FROM wa_contacts WHERE tenant_id = $1 AND phone = $2`,
      [tenantId, digits]
    );
    if (!contact) return Response.json({ ok: false, error: "not_found" }, { status: 404 });

    const memRow = await one(
      `SELECT COALESCE(summary,'') AS summary, COALESCE(facts,'[]'::jsonb) AS facts
         FROM wa_user_memory WHERE tenant_id = $1 AND phone = $2`,
      [tenantId, digits]
    );

    const appointments = await q(
      `SELECT a.id, sv.name AS service, a.start_time, a.status
         FROM wa_appointments a JOIN wa_services sv ON sv.id = a.service_id
        WHERE a.tenant_id = $1 AND a.phone = $2
        ORDER BY a.start_time DESC LIMIT 8`,
      [tenantId, digits]
    );

    const messages = await q(
      `SELECT * FROM (
         SELECT id, direction, sender, COALESCE(content,'') AS content, created_at
           FROM wa_messages
          WHERE tenant_id = $1 AND phone = $2
          ORDER BY id DESC LIMIT 200
       ) t ORDER BY id ASC`,
      [tenantId, digits]
    );

    const facts = Array.isArray(memRow?.facts) ? memRow.facts : [];
    return Response.json({
      ok: true,
      contact,
      memory: memRow ? { summary: memRow.summary, facts } : null,
      appointments,
      messages,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
