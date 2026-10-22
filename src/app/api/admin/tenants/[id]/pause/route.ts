import { requireSuperAdmin, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const s = await requireSuperAdmin();
    const { id } = await ctx.params;

    const pauseReason = "Paused by platform administrator for 24 hours";

    // 1. Update or upsert instance pause state
    const instance = await one(
      `UPDATE wa_instances
          SET proactive_paused_until = now() + INTERVAL '24 hours',
              pause_reason = $2
        WHERE tenant_id = $1::int
        RETURNING tenant_id, status,
                  to_char(proactive_paused_until, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS proactive_paused_until,
                  pause_reason`,
      [id, pauseReason]
    );

    // 2. Write safety event
    await one(
      `INSERT INTO wa_safety_events (tenant_id, kind, detail, created_at)
       VALUES ($1::int, 'paused_optouts', $2, now())
       RETURNING id`,
      [id, pauseReason]
    );

    return Response.json({
      ok: true,
      instance: instance ?? null,
      message: "Automatic messages paused for 24 hours.",
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const s = await requireSuperAdmin();
    const { id } = await ctx.params;

    const instance = await one(
      `UPDATE wa_instances
          SET proactive_paused_until = NULL,
              pause_reason = NULL
        WHERE tenant_id = $1::int
        RETURNING tenant_id, status,
                  to_char(proactive_paused_until, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS proactive_paused_until,
                  pause_reason`,
      [id]
    );

    await one(
      `INSERT INTO wa_safety_events (tenant_id, kind, detail, created_at)
       VALUES ($1::int, 'reconnected', 'Pause cleared by platform administrator', now())
       RETURNING id`,
      [id]
    );

    return Response.json({
      ok: true,
      instance: instance ?? null,
      message: "Pause cleared.",
    });
  } catch (e) {
    return errorResponse(e);
  }
}
