import { requireTenant, requireOwner, errorResponse } from "@/lib/auth";
import { one, q } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const insight = await one(
      `SELECT data, generated_at FROM wa_insights WHERE tenant_id = $1 AND kind = 'top_questions'`,
      [tenantId]
    );

    let rawList: any[] = [];
    if (insight?.data) {
      if (Array.isArray(insight.data)) {
        rawList = insight.data;
      } else if (Array.isArray(insight.data.questions)) {
        rawList = insight.data.questions;
      } else if (Array.isArray(insight.data.items)) {
        rawList = insight.data.items;
      } else if (Array.isArray(insight.data.topics)) {
        rawList = insight.data.topics;
      }
    }

    const suggestions = rawList.map((item, idx) => {
      if (typeof item === "string") {
        return {
          id: `sug-${idx}`,
          question: item,
          answer: "[ADD DETAILS]",
          count: null,
        };
      }
      return {
        id: `sug-${idx}`,
        question: String(item.question || item.topic || item.title || "Unspecified question").trim(),
        answer: String(item.sample_answer || item.answer || "[ADD DETAILS]").trim(),
        count: item.count || item.frequency || null,
      };
    }).filter((s) => s.question.length > 0);

    return Response.json({
      ok: true,
      suggestions,
      generated_at: insight?.generated_at ?? null,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);
    const body = await req.json();
    const question = String(body.question || "").trim();
    const answer = String(body.answer || "[ADD DETAILS]").trim();

    if (!question) {
      return Response.json({ ok: false, error: "missing_question" }, { status: 400 });
    }

    const nextOrderRow = await one(
      `SELECT COALESCE(MAX(sort_order), 0) + 10 AS next_order FROM wa_faqs WHERE tenant_id = $1`,
      [tenantId]
    );
    const sortOrder = nextOrderRow?.next_order ?? 10;

    const row = await one(
      `INSERT INTO wa_faqs (tenant_id, question, answer, keywords, sort_order, active)
       VALUES ($1, $2, $3, '{}', $4, false)
       ON CONFLICT (tenant_id, question) DO UPDATE
         SET answer = EXCLUDED.answer
       RETURNING id, question, answer, keywords, sort_order, active, created_at`,
      [tenantId, question, answer, sortOrder]
    );

    return Response.json({ ok: true, faq: row });
  } catch (e) {
    return errorResponse(e);
  }
}
