import { requireTenant, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireTenant(req);
    const { id } = await ctx.params;
    const leadId = Number(id);

    const lead = await one(
      `SELECT l.*,
              c.first_ad_title, c.lead_source,
              u.full_name AS owner_name, u.email AS owner_email
         FROM wa_leads l
         LEFT JOIN wa_contacts c ON c.tenant_id = l.tenant_id AND c.phone = l.phone
         LEFT JOIN wa_tenant_users u ON u.tenant_id = l.tenant_id AND u.id = l.assigned_to
        WHERE l.id = $1 AND l.tenant_id = $2`,
      [leadId, tenantId]
    );

    if (!lead) {
      return Response.json({ ok: false, error: "lead_not_found" }, { status: 404 });
    }

    return Response.json({ ok: true, lead });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const body = await req.json();
    body.id = Number(id);

    // Forward to the PATCH handler logic in /api/leads
    const url = new URL(req.url);
    const baseUrl = `${url.origin}/api/leads`;
    return fetch(baseUrl, {
      method: "PATCH",
      headers: req.headers,
      body: JSON.stringify(body),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
