import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { one } from "@/lib/db";
import SettingsManager from "@/app/admin/settings/settings-client";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.superAdmin) redirect("/desk");

  const platformSettings = await one(
    `SELECT dashboard_url, COALESCE(alert_phone,'') AS alert_phone,
            COALESCE(alert_instance,'') AS alert_instance,
            COALESCE(webhook_secret_enforced, false) AS webhook_secret_enforced,
            COALESCE(evolution_url,'') AS evolution_url,
            COALESCE(webhook_url,'') AS webhook_url,
            COALESCE(broadcast_daily_max, 200) AS broadcast_daily_max,
            COALESCE(proactive_enabled, true) AS proactive_enabled
       FROM wa_platform_settings WHERE id = 1`
  );

  return (
    <SettingsManager
      initialSettings={platformSettings ?? {
        dashboard_url: "", alert_phone: "", alert_instance: "",
        webhook_secret_enforced: false, evolution_url: "", webhook_url: "",
        broadcast_daily_max: 200, proactive_enabled: true,
      }}
    />
  );
}
