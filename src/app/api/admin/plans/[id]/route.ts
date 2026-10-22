import { requireSuperAdmin, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const s = await requireSuperAdmin();
    const { id } = await ctx.params;
    const b = await req.json();

    const row = await one(
      `UPDATE wa_plans SET
         code                = COALESCE(NULLIF($2,''), code),
         name                = COALESCE(NULLIF($3,''), name),
         price_qar           = COALESCE($4, price_qar),
         monthly_reply_limit = CASE WHEN $5::text = 'keep' THEN monthly_reply_limit
                                    WHEN $5::text = 'null' THEN NULL
                                    ELSE $5::int END,
         active              = COALESCE($6, active),
         broadcast_limit     = COALESCE($7, broadcast_limit),
         is_popular          = COALESCE($8, is_popular),
         features            = COALESCE($9::jsonb, features)
       WHERE id = $1::int
       RETURNING id, code, name, price_qar, monthly_reply_limit, broadcast_limit, is_popular, features, active`,
      [
        id,
        String(b.code ?? ""),
        String(b.name ?? ""),
        b.price_qar !== undefined ? Number(b.price_qar) : null,
        b.monthly_reply_limit === undefined
          ? "keep"
          : b.monthly_reply_limit === null
          ? "null"
          : String(Number(b.monthly_reply_limit)),
        b.active !== undefined ? Boolean(b.active) : null,
        b.broadcast_limit !== undefined ? Number(b.broadcast_limit) : null,
        b.is_popular !== undefined ? Boolean(b.is_popular) : null,
        Array.isArray(b.features) ? JSON.stringify(b.features) : null,
      ]
    );
    if (!row) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    return Response.json({ ok: true, plan: row });
  } catch (e) {
    return errorResponse(e);
  }
}
