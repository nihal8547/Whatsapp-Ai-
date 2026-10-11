import { requireTenant, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireTenant(req);
    const { id } = await ctx.params;
    const quoteId = Number(id);

    const quote = await one(
      `SELECT q.*, l.name AS lead_name, l.phone AS lead_phone
         FROM wa_quotes q
         JOIN wa_leads l ON l.id = q.lead_id AND l.tenant_id = q.tenant_id
        WHERE q.id = $1 AND q.tenant_id = $2`,
      [quoteId, tenantId]
    );

    if (!quote) {
      return Response.json({ ok: false, error: "quote_not_found" }, { status: 404 });
    }

    return Response.json({ ok: true, quote });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, session } = await requireTenant(req);
    const { id } = await ctx.params;
    const quoteId = Number(id);
    const body = await req.json();

    const current = await one(
      `SELECT q.*, l.currency AS lead_currency
         FROM wa_quotes q
         JOIN wa_leads l ON l.id = q.lead_id AND l.tenant_id = q.tenant_id
        WHERE q.id = $1 AND q.tenant_id = $2`,
      [quoteId, tenantId]
    );

    if (!current) {
      return Response.json({ ok: false, error: "quote_not_found" }, { status: 404 });
    }

    const updates: string[] = [];
    const params: any[] = [quoteId, tenantId];
    let idx = 3;

    if (body.status && ["draft", "sent", "accepted", "declined"].includes(body.status)) {
      updates.push(`status = $${idx}`);
      params.push(body.status);
      idx++;

      const eventBody =
        body.status === "accepted"
          ? `Quote #${quoteId} accepted by customer (${current.currency} ${current.total})`
          : body.status === "declined"
          ? `Quote #${quoteId} declined`
          : `Quote #${quoteId} status changed to ${body.status}`;

      await q(
        `INSERT INTO wa_lead_events (lead_id, tenant_id, kind, body, data, created_by)
         VALUES ($1, $2, 'quote', $3, $4, $5)`,
        [
          current.lead_id,
          tenantId,
          eventBody,
          JSON.stringify({ quote_id: quoteId, status: body.status }),
          session?.userId || null,
        ]
      );
    }

    if (body.notes !== undefined) {
      updates.push(`notes = $${idx}`);
      params.push(body.notes ? String(body.notes).trim() : null);
      idx++;
    }

    if (body.valid_until !== undefined) {
      updates.push(`valid_until = $${idx}`);
      params.push(body.valid_until ? String(body.valid_until).slice(0, 10) : null);
      idx++;
    }

    if (updates.length > 0) {
      await q(
        `UPDATE wa_quotes SET ${updates.join(", ")} WHERE id = $1 AND tenant_id = $2`,
        params
      );
      await q(
        `UPDATE wa_leads SET updated_at = now() WHERE id = $1 AND tenant_id = $2`,
        [current.lead_id, tenantId]
      );
    }

    const updated = await one(
      `SELECT * FROM wa_quotes WHERE id = $1 AND tenant_id = $2`,
      [quoteId, tenantId]
    );

    return Response.json({ ok: true, quote: updated });
  } catch (e) {
    return errorResponse(e);
  }
}
