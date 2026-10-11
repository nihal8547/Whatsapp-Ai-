import { requireTenant, requireOwner, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const faqs = await q(
      `SELECT id, question, answer, keywords, sort_order, active, created_at
         FROM wa_faqs
        WHERE tenant_id = $1
        ORDER BY sort_order ASC, id ASC`,
      [tenantId]
    );

    return Response.json({ ok: true, faqs });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);
    const body = await req.json();

    const question = String(body.question || "").trim();
    const answer = String(body.answer || "").trim();
    const keywords = Array.isArray(body.keywords)
      ? body.keywords.map((k: any) => String(k).trim()).filter(Boolean)
      : [];
    const active = typeof body.active === "boolean" ? body.active : false;
    const sortOrder = Number(body.sort_order ?? 0) || 0;

    if (!question || !answer) {
      return Response.json({ ok: false, error: "question_and_answer_required" }, { status: 400 });
    }

    const row = await one(
      `INSERT INTO wa_faqs (tenant_id, question, answer, keywords, sort_order, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, question) DO UPDATE
         SET answer = EXCLUDED.answer,
             keywords = EXCLUDED.keywords,
             sort_order = EXCLUDED.sort_order,
             active = EXCLUDED.active
       RETURNING id, question, answer, keywords, sort_order, active, created_at`,
      [tenantId, question, answer, keywords, sortOrder, active]
    );

    return Response.json({ ok: true, faq: row });
  } catch (e) {
    return errorResponse(e);
  }
}
