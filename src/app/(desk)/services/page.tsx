import { requireTenant } from "@/lib/auth";
import { q } from "@/lib/db";
import ServicesEditor from "./editor";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const { tenantId, session } = await requireTenant();
  const services = await q(
    `SELECT id, name, COALESCE(description,'') AS description, duration_min, price, currency, active
       FROM wa_services WHERE tenant_id = $1 ORDER BY active DESC, id`,
    [tenantId]
  );
  const hours = await q(
    `SELECT weekday, to_char(open_time,'HH24:MI') AS open_time,
            to_char(close_time,'HH24:MI') AS close_time, is_closed
       FROM wa_business_hours WHERE tenant_id = $1 ORDER BY weekday`,
    [tenantId]
  );
  return (
    <ServicesEditor
      initialServices={services}
      initialHours={hours}
      readOnly={session.role === "staff" && !session.superAdmin}
    />
  );
}
