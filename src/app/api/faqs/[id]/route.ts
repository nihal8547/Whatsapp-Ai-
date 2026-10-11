import { requireTenant, requireOwner, errorResponse } from "@/lib/auth";
import { one, q } from "@/lib/db";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await requireOwner(req);
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!id) return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });

    const body = await req.json();

    const current = await one(
      `SELECT id, question, answer, keywords, sort_order, active
         FROM wa_faqs WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );

    if (!current) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const question = body.question !== undefined ? String(body.question).trim() : current.question;
    const answer = body.answer !== undefined ? String(body.answer).trim() : current.answer;
    const keywords = body.keywords !== undefined
      ? (Array.isArray(body.keywords) ? body.keywords.map((k: any) => String(k).trim()).filter(Boolean) : [])
      : current.keywords;
    const active = typeof body.active === "boolean" ? body.active : current.active;
    const sortOrder = body.sort_order !== undefined ? Number(body.sort_order) : current.sort_order;

    const updated = await one(
      `UPDATE wa_faqs
          SET question = $1,
              answer = $2,
              keywords = $3,
              sort_order = $4,
              active = $5
        WHERE id = $6 AND tenant_id = $7
        RETURNING id, question, answer, keywords, sort_order, active, created_at`,
      [question, answer, keywords, sortOrder, active, id, tenantId]
    );

    return Response.json({ ok: true, faq: updated });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await requireOwner(req);
    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!id) return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });

    await q(`DELETE FROM wa_faqs WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
