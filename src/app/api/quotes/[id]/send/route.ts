import { requireTenant, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { n8n } from "@/lib/n8n";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId, session } = await requireTenant(req);
    const { id } = await ctx.params;
    const quoteId = Number(id);

    const quote = await one(
      `SELECT q.*, l.name AS lead_name, l.phone AS lead_phone, l.stage AS lead_stage
         FROM wa_quotes q
         JOIN wa_leads l ON l.id = q.lead_id AND l.tenant_id = q.tenant_id
        WHERE q.id = $1 AND q.tenant_id = $2`,
      [quoteId, tenantId]
    );

    if (!quote) {
      return Response.json({ ok: false, error: "quote_not_found" }, { status: 404 });
    }

    const lines = Array.isArray(quote.lines) ? quote.lines : [];
    const formattedLines = lines
      .map((l: any) => `• ${l.description} × ${l.qty} — ${quote.currency} ${Number(l.total).toFixed(2)}`)
      .join("\n");

    const messageLines = [
      `📄 *Quote for ${quote.lead_name || "You"}*`,
      quote.valid_until ? `Valid until: ${new Date(quote.valid_until).toLocaleDateString()}` : null,
      "",
      formattedLines || `• Custom quote`,
      "",
      `*Total: ${quote.currency} ${Number(quote.total).toFixed(2)}*`,
      quote.notes ? `\nNote: ${quote.notes}` : null,
    ].filter((line) => line !== null);

    const messageText = messageLines.join("\n");

    // Send through n8n send_message action
    let n8nResult = null;
    let messageSent = false;
    let messageError = null;
    try {
      n8nResult = await n8n("send_message", {
        tenant_id: tenantId,
        phone: String(quote.lead_phone).replace(/[^0-9]/g, ""),
        text: messageText,
        staff_name: session?.name || "Team",
        add_to_memory: true,
      });
      messageSent = true;
    } catch (sendErr: any) {
      console.warn("n8n send_message warning:", sendErr?.message || sendErr);
      messageSent = false;
      messageError = sendErr?.message || String(sendErr);
    }

    // 1. Mark quote sent
    await q(
      `UPDATE wa_quotes SET status = 'sent' WHERE id = $1 AND tenant_id = $2`,
      [quoteId, tenantId]
    );

    // 2. Set lead stage to quoted
    const prevStage = quote.lead_stage;
    await q(
      `UPDATE wa_leads SET stage = 'quoted', updated_at = now() WHERE id = $1 AND tenant_id = $2`,
      [quote.lead_id, tenantId]
    );

    // 3. Write events
    await q(
      `INSERT INTO wa_lead_events (lead_id, tenant_id, kind, body, data, created_by)
       VALUES ($1, $2, 'quote', $3, $4, $5)`,
      [
        quote.lead_id,
        tenantId,
        `Quote #${quoteId} sent on WhatsApp: ${quote.currency} ${Number(quote.total).toFixed(2)}`,
        JSON.stringify({ quote_id: quoteId, total: quote.total, currency: quote.currency }),
        session?.userId || null,
      ]
    );

    if (prevStage !== "quoted") {
      await q(
        `INSERT INTO wa_lead_events (lead_id, tenant_id, kind, body, data, created_by)
         VALUES ($1, $2, 'stage', $3, $4, $5)`,
        [
          quote.lead_id,
          tenantId,
          `Stage changed: ${prevStage} → quoted (Quote #${quoteId} sent)`,
          JSON.stringify({ from: prevStage, to: "quoted" }),
          session?.userId || null,
        ]
      );
    }

    const updated = await one(`SELECT * FROM wa_quotes WHERE id = $1 AND tenant_id = $2`, [quoteId, tenantId]);

    return Response.json({ ok: true, quote: updated, messageSent, messageError, n8n: n8nResult });
  } catch (e) {
    return errorResponse(e);
  }
}
