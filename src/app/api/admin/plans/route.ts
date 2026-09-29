import { requireSession, AuthError, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

export async function GET() {
  try {
    const s = await requireSession();
    if (!s.superAdmin) throw new AuthError("forbidden", 403);

    const plans = await q(
      `SELECT id, code, name, price_qar, monthly_reply_limit, active
         FROM wa_plans ORDER BY active DESC, id`
    );
    return Response.json({ ok: true, plans });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const s = await requireSession();
    if (!s.superAdmin) throw new AuthError("forbidden", 403);

    const b = await req.json();
    const code = String(b.code ?? "").trim().toLowerCase().replace(/\s+/g, "_");
    const name = String(b.name ?? "").trim();
    if (!code || !name) {
      return Response.json({ ok: false, error: "missing_fields" }, { status: 400 });
    }

    const row = await one(
      `INSERT INTO wa_plans (code, name, price_qar, monthly_reply_limit, active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, code, name, price_qar, monthly_reply_limit, active`,
      [
        code,
        name,
        Number(b.price_qar) || 0,
        b.monthly_reply_limit ? Number(b.monthly_reply_limit) : null,
      ]
    );
    return Response.json({ ok: true, plan: row }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
