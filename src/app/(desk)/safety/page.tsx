import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { DEFAULT_SAFETY_SETTINGS } from "@/lib/safety";
import SafetyClient from "./safety-client";

export const dynamic = "force-dynamic";

export default async function SafetyPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.tenantId && session.superAdmin) redirect("/admin");
  if (!session.tenantId) redirect("/login");

  const tenantId = session.tenantId;

  const [instance, bot, platform, safetyEvents] = await Promise.all([
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
    q<{
      id: number;
      kind: string;
      detail: string;
      created_at: string;
    }>(
      `SELECT id, kind, detail,
              to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
         FROM wa_safety_events
        WHERE tenant_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT 50`,
      [tenantId]
    ),
  ]);

  const tz = bot?.timezone || "Asia/Qatar";

  // System outbound messages counts for today and this hour
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

  const initialSettings = {
    ...DEFAULT_SAFETY_SETTINGS,
    ...(bot?.safety_settings ?? {}),
  };

  const isOwner = session.role === "owner" || session.superAdmin;

  return (
    <SafetyClient
      initialInstance={{
        status: instance?.status ?? "pending",
        disconnected_since: instance?.disconnected_since ?? null,
        reconnected_at: instance?.reconnected_at ?? null,
        proactive_paused_until: instance?.proactive_paused_until ?? null,
        pause_reason: instance?.pause_reason ?? null,
      }}
      initialSettings={initialSettings}
      initialEvents={safetyEvents ?? []}
      counts={{
        today: Number(counts?.count_today ?? 0),
        hour: Number(counts?.count_hour ?? 0),
      }}
      timezone={tz}
      platformProactiveEnabled={Boolean(platform?.proactive_enabled ?? true)}
      isOwner={isOwner}
      role={session.role}
    />
  );
}
