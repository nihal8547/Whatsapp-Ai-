import { requireTenant } from "@/lib/auth";
import { q, one } from "@/lib/db";
import Schedule from "./schedule";

export const dynamic = "force-dynamic";

export default async function AppointmentsPage() {
  const { tenantId } = await requireTenant();
  const settings = await one(`SELECT timezone FROM wa_bot_settings WHERE tenant_id = $1`, [tenantId]);
  const services = await q(
    `SELECT id, name, duration_min FROM wa_services WHERE tenant_id = $1 AND active ORDER BY id`,
    [tenantId]
  );
  return <Schedule tz={settings?.timezone || "Asia/Qatar"} services={services} />;
}
