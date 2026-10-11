import { requireTenant, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireTenant(req);
    const { id } = await ctx.params;
    const leadId = Number(id);

    // Verify lead belongs to tenant
    const lead = await one(
      `SELECT id FROM wa_leads WHERE id = $1 AND tenant_id = $2`,
      [leadId, tenantId]
    );
    if (!lead) {
      return Response.json({ ok: false, error: "lead_not_found" }, { status: 404 });
    }

    const events = await q(
      `SELECT e.id, e.lead_id, e.tenant_id, e.kind, e.body, e.data, e.created_by, e.created_at,
              u.full_name AS created_by_name, u.email AS created_by_email
         FROM wa_lead_events e
         LEFT JOIN wa_tenant_users u ON u.tenant_id = e.tenant_id AND u.id = e.created_by
        WHERE e.lead_id = $1 AND e.tenant_id = $2
        ORDER BY e.created_at DESC, e.id DESC`,
      [leadId, tenantId]
    );

    return Response.json({ ok: true, events });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, session } = await requireTenant(req);
    const { id } = await ctx.params;
    const leadId = Number(id);
    const body = await req.json();

    // Verify lead belongs to tenant
    const lead = await one(
      `SELECT id FROM wa_leads WHERE id = $1 AND tenant_id = $2`,
      [leadId, tenantId]
    );
    if (!lead) {
      return Response.json({ ok: false, error: "lead_not_found" }, { status: 404 });
    }

    const kind = body.kind && ["note", "stage", "quote", "followup", "message", "assign"].includes(body.kind)
      ? body.kind
      : "note";
    const noteBody = String(body.body || body.note || "").trim();
    if (!noteBody) {
      return Response.json({ ok: false, error: "empty_body" }, { status: 400 });
    }

    const data = body.data && typeof body.data === "object" ? body.data : {};

    const event = await one(
      `INSERT INTO wa_lead_events (lead_id, tenant_id, kind, body, data, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [leadId, tenantId, kind, noteBody, JSON.stringify(data), session?.userId || null]
    );

    // Update lead updated_at timestamp
    await q(
      `UPDATE wa_leads SET updated_at = now() WHERE id = $1 AND tenant_id = $2`,
      [leadId, tenantId]
    );

    return Response.json({ ok: true, event });
  } catch (e) {
    return errorResponse(e);
  }
}
