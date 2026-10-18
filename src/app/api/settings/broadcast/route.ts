import { requireTenant, requireOwner, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";
import { DEFAULT_BROADCAST_SETTINGS } from "@/lib/broadcasts";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);

    const [bot, platform] = await Promise.all([
      one<{ broadcast_settings: any }>(
        `SELECT broadcast_settings FROM wa_bot_settings WHERE tenant_id = $1`,
        [tenantId]
      ),
      one<{ broadcast_daily_max: number }>(
        `SELECT COALESCE(broadcast_daily_max, 200) AS broadcast_daily_max FROM wa_platform_settings WHERE id = 1`
      ),
    ]);

    const settings = {
      ...DEFAULT_BROADCAST_SETTINGS,
      ...(bot?.broadcast_settings ?? {}),
    };

    return Response.json({
      ok: true,
      settings,
      platformDailyMax: Number(platform?.broadcast_daily_max ?? 200),
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);
    const body = await req.json();

    // 1. Get platform max
    const platform = await one<{ broadcast_daily_max: number }>(
      `SELECT COALESCE(broadcast_daily_max, 200) AS broadcast_daily_max FROM wa_platform_settings WHERE id = 1`
    );
    const platformMax = Number(platform?.broadcast_daily_max ?? 200);

    const enabled = Boolean(body.enabled);
    let dailyCap = Math.max(1, Number(body.daily_cap || 100));
    if (dailyCap > platformMax) {
      return Response.json(
        {
          ok: false,
          error: "daily_cap_exceeds_platform_max",
          message: `Daily cap cannot exceed platform limit of ${platformMax} messages/day.`,
        },
        { status: 400 }
      );
    }

    let hourlyCap = Math.max(1, Number(body.hourly_cap || 25));
    if (hourlyCap > 40) {
      return Response.json(
        {
          ok: false,
          error: "hourly_cap_exceeds_max",
          message: "Hourly cap cannot exceed 40 messages/hour.",
        },
        { status: 400 }
      );
    }

    const windowStart = String(body.window_start || "09:00").trim();
    const windowEnd = String(body.window_end || "21:00").trim();

    const newSettings = {
      enabled,
      daily_cap: dailyCap,
      hourly_cap: hourlyCap,
      window_start: windowStart,
      window_end: windowEnd,
    };

    await one(
      `UPDATE wa_bot_settings
          SET broadcast_settings = $2,
              updated_at = now()
        WHERE tenant_id = $1
        RETURNING tenant_id`,
      [tenantId, JSON.stringify(newSettings)]
    );

    return Response.json({ ok: true, settings: newSettings });
  } catch (e) {
    return errorResponse(e);
  }
}
