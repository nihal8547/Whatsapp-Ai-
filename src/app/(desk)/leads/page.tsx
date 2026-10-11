import { requireTenant } from "@/lib/auth";
import { q } from "@/lib/db";
import { getTenantConfig, tLabel } from "@/lib/packs";
import LeadsClient from "./leads-client";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const { tenantId, session } = await requireTenant();
  const config = await getTenantConfig(tenantId);
  const { labels } = config;

  const leadLabel = tLabel(labels, "lead", "Lead");
  const leadsLabel = tLabel(labels, "leads", "Leads");
  const isOwner = session.role === "owner" || session.superAdmin;

  // Fetch team members for lead assignment
  const teamMembers = await q(
    `SELECT id, email, full_name, role FROM wa_tenant_users WHERE tenant_id = $1 ORDER BY full_name ASC, email ASC`,
    [tenantId]
  );

  // Fetch active services for appointment creation
  const services = await q(
    `SELECT id, name, duration_min, price, currency FROM wa_services WHERE tenant_id = $1 AND active = true ORDER BY name ASC`,
    [tenantId]
  );

  // Fetch active catalog items for quote lines
  const catalogItems = await q(
    `SELECT id, name, price, currency, unit, kind FROM wa_catalog_items WHERE tenant_id = $1 AND active = true AND available = true ORDER BY name ASC`,
    [tenantId]
  );

  return (
    <LeadsClient
      tenantId={tenantId}
      isOwner={isOwner}
      sessionUser={{ id: session.userId, name: session.name, role: session.role }}
      leadLabel={leadLabel}
      leadsLabel={leadsLabel}
      teamMembers={teamMembers}
      services={services}
      catalogItems={catalogItems}
    />
  );
}
