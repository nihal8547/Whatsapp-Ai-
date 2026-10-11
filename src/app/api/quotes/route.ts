import { requireTenant, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const { searchParams } = new URL(req.url);
    const leadId = searchParams.get("lead_id");

    const conditions: string[] = ["q.tenant_id = $1"];
    const params: any[] = [tenantId];
    let idx = 2;

    if (leadId) {
      conditions.push(`q.lead_id = $${idx}`);
      params.push(Number(leadId));
      idx++;
    }

    const quotes = await q(
      `SELECT q.id, q.tenant_id, q.lead_id, q.lines, q.total, q.currency,
              q.valid_until, q.status, q.notes, q.created_at,
              l.name AS lead_name, l.phone AS lead_phone
         FROM wa_quotes q
         JOIN wa_leads l ON l.id = q.lead_id AND l.tenant_id = q.tenant_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY q.created_at DESC`,
      params
    );

    return Response.json({ ok: true, quotes });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId, session } = await requireTenant(req);
    const body = await req.json();

    const leadId = Number(body.lead_id);
    if (!leadId) {
      return Response.json({ ok: false, error: "lead_id_required" }, { status: 400 });
    }

    // Verify lead belongs to tenant
    const lead = await one(
      `SELECT id, name, phone, currency FROM wa_leads WHERE id = $1 AND tenant_id = $2`,
      [leadId, tenantId]
    );
    if (!lead) {
      return Response.json({ ok: false, error: "lead_not_found" }, { status: 404 });
    }

    const rawLines = Array.isArray(body.lines) ? body.lines : [];
    if (rawLines.length === 0) {
      return Response.json({ ok: false, error: "empty_lines" }, { status: 400 });
    }

    // Sanitize lines and verify catalog items belong to this tenant
    const validatedLines: Array<{
      catalog_item_id?: number | null;
      description: string;
      qty: number;
      price: number;
      total: number;
    }> = [];

    let computedTotal = 0;

    for (const line of rawLines) {
      const description = String(line.description || "").trim();
      const qty = Math.max(1, Math.min(9999, Number(line.qty) || 1));
      let price = Math.max(0, Number(line.price) || 0);
      let catalogItemId = line.catalog_item_id ? Number(line.catalog_item_id) : null;

      if (catalogItemId) {
        const catItem = await one(
          `SELECT id, name, price FROM wa_catalog_items WHERE tenant_id = $1 AND id = $2`,
          [tenantId, catalogItemId]
        );
        if (!catItem) {
          return Response.json(
            { ok: false, error: "invalid_catalog_item", message: "Catalog item does not belong to this tenant." },
            { status: 400 }
          );
        }
        if (line.price === undefined || line.price === null) {
          price = Number(catItem.price) || 0;
        }
      }

      if (!description) {
        return Response.json({ ok: false, error: "line_description_required" }, { status: 400 });
      }

      const lineTotal = Number((qty * price).toFixed(2));
      computedTotal += lineTotal;

      validatedLines.push({
        catalog_item_id: catalogItemId,
        description,
        qty,
        price,
        total: lineTotal,
      });
    }

    computedTotal = Number(computedTotal.toFixed(2));
    const currency = body.currency ? String(body.currency).trim().toUpperCase() : (lead.currency || "QAR");
    const validUntil = body.valid_until ? String(body.valid_until).slice(0, 10) : null;
    const notes = body.notes ? String(body.notes).trim() : null;

    const quote = await one(
      `INSERT INTO wa_quotes (
         tenant_id, lead_id, lines, total, currency, valid_until, status, notes
       ) VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7)
       RETURNING *`,
      [
        tenantId,
        leadId,
        JSON.stringify(validatedLines),
        computedTotal,
        currency,
        validUntil,
        notes,
      ]
    );

    // Event on lead
    await q(
      `INSERT INTO wa_lead_events (lead_id, tenant_id, kind, body, data, created_by)
       VALUES ($1, $2, 'quote', $3, $4, $5)`,
      [
        leadId,
        tenantId,
        `Draft quote created: ${currency} ${computedTotal}`,
        JSON.stringify({ quote_id: quote.id, total: computedTotal, currency }),
        session?.userId || null,
      ]
    );

    await q(`UPDATE wa_leads SET updated_at = now() WHERE id = $1 AND tenant_id = $2`, [leadId, tenantId]);

    return Response.json({ ok: true, quote });
  } catch (e) {
    return errorResponse(e);
  }
}
