import { requireTenant, requireOwner, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";
import { DEFAULT_SAFETY_SETTINGS, validateSafetySettingsInput } from "@/lib/safety";

export async function GET(req: Request) {
  try {
    const { tenantId, session } = await requireTenant(req);

    // 1. Fetch instance details, bot settings (with timezone & safety_settings), and platform settings
    const [instance, bot, platform] = await Promise.all([
      one<{
        status: string | null;
        disconnected_since: string | null;
        reconnected_at: string | null;
        proactive_paused_until: string | null;
        pause_reason: string | null;
      }>(
        `SELECT status,
                to_char(disconnected_since, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS disconnected_since,
                to_char(reconnected_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS reconnected_at,
                to_char(proactive_paused_until, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS proactive_paused_until,
                pause_reason
           FROM wa_instances
          WHERE tenant_id = $1`,
        [tenantId]
      ),
      one<{
        safety_settings: any;
        timezone: string | null;
      }>(
        `SELECT safety_settings, COALESCE(timezone, 'Asia/Qatar') AS timezone
           FROM wa_bot_settings
          WHERE tenant_id = $1`,
        [tenantId]
      ),
      one<{ proactive_enabled: boolean }>(
        `SELECT COALESCE(proactive_enabled, true) AS proactive_enabled
           FROM wa_platform_settings
          WHERE id = 1`
      ),
    ]);

    const tz = bot?.timezone || "Asia/Qatar";

    // 2. Count today's and this hour's automatic messages (direction = 'out' AND sender = 'system') in tenant timezone
    const counts = await one<{
      count_today: number;
      count_hour: number;
    }>(
      `SELECT
         COUNT(*) FILTER (
           WHERE (created_at AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date
         )::int AS count_today,
         COUNT(*) FILTER (
           WHERE date_trunc('hour', created_at AT TIME ZONE $2) = date_trunc('hour', now() AT TIME ZONE $2)
         )::int AS count_hour
       FROM wa_messages
      WHERE tenant_id = $1
        AND direction = 'out'
        AND sender = 'system'`,
      [tenantId, tz]
    );

    const settings = {
      ...DEFAULT_SAFETY_SETTINGS,
      ...(bot?.safety_settings ?? {}),
    };

    const isOwner = session.role === "owner" || session.superAdmin;

    return Response.json({
      ok: true,
      instance: {
        status: instance?.status ?? "pending",
        disconnected_since: instance?.disconnected_since ?? null,
        reconnected_at: instance?.reconnected_at ?? null,
        proactive_paused_until: instance?.proactive_paused_until ?? null,
        pause_reason: instance?.pause_reason ?? null,
      },
      settings,
      counts: {
        today: Number(counts?.count_today ?? 0),
        hour: Number(counts?.count_hour ?? 0),
      },
      timezone: tz,
      platformProactiveEnabled: Boolean(platform?.proactive_enabled ?? true),
      isOwner,
      role: session.role,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request) {
  try {
    const { tenantId, session } = await requireOwner(req);

    // Only owner (or super admin) is permitted to modify safety settings. Staff and admin are rejected.
    if (!session.superAdmin && session.role !== "owner") {
      return Response.json(
        {
          ok: false,
          error: "forbidden",
          message: "Only workspace owners can modify safety settings.",
        },
        { status: 403 }
      );
    }

    const body = await req.json();
    const validation = validateSafetySettingsInput(body);
    if (!validation.ok) {
      return Response.json(
        { ok: false, error: validation.error, message: validation.message },
        { status: 400 }
      );
    }

    // Fetch existing safety_settings to merge and avoid dropping unknown keys
    const current = await one<{ safety_settings: any }>(
      `SELECT safety_settings FROM wa_bot_settings WHERE tenant_id = $1`,
      [tenantId]
    );

    const mergedSettings = {
      ...DEFAULT_SAFETY_SETTINGS,
      ...(current?.safety_settings ?? {}),
      ...validation.settings,
    };

    await one(
      `INSERT INTO wa_bot_settings (tenant_id, safety_settings, updated_at)
       VALUES ($1, $2::jsonb, now())
       ON CONFLICT (tenant_id) DO UPDATE SET
         safety_settings = $2::jsonb,
         updated_at = now()
       RETURNING tenant_id`,
      [tenantId, JSON.stringify(mergedSettings)]
    );

    return Response.json({
      ok: true,
      settings: mergedSettings,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
