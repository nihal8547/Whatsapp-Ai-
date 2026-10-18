import { requireTenant } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { getTenantConfig } from "@/lib/packs";
import SettingsEditor from "./editor";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { tenantId, session } = await requireTenant();
  const config = await getTenantConfig(tenantId);

  const [packs, bot, platform] = await Promise.all([
    q(
      `SELECT code, name, modules, labels, persona_rules, version
         FROM wa_business_packs
        WHERE active = true
        ORDER BY name ASC`
    ),
    one<{ broadcast_settings: any }>(
      `SELECT broadcast_settings FROM wa_bot_settings WHERE tenant_id = $1`,
      [tenantId]
    ),
    one<{ broadcast_daily_max: number }>(
      `SELECT COALESCE(broadcast_daily_max, 200) AS broadcast_daily_max FROM wa_platform_settings WHERE id = 1`
    ),
  ]);

  return (
    <SettingsEditor
      tenantId={tenantId}
      isOwner={session.role === "owner" || session.superAdmin}
      currentPack={config.pack}
      activeModules={config.modules}
      labels={config.labels}
      availablePacks={packs}
      broadcastSettings={bot?.broadcast_settings ?? { enabled: true, daily_cap: 100, hourly_cap: 25, window_start: "09:00", window_end: "21:00" }}
      platformDailyMax={Number(platform?.broadcast_daily_max ?? 200)}
    />
  );
}
