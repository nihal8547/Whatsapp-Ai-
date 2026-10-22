import { requireTenant } from "@/lib/auth";
import { one } from "@/lib/db";
import { getTenantConfig, tLabel } from "@/lib/packs";
import OrdersClient from "./orders-client";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const { tenantId, session } = await requireTenant();
  const config = await getTenantConfig(tenantId);
  const { labels } = config;

  const orderLabel = tLabel(labels, "order", "Order");
  const ordersLabel = tLabel(labels, "orders", "Orders");
  const isOwner = session.role === "owner" || session.superAdmin;

  const tenantRow = await one<{ name: string; business_name: string | null }>(
    `SELECT t.name, bs.business_name
     FROM wa_tenants t
     LEFT JOIN wa_bot_settings bs ON bs.tenant_id = t.id
     WHERE t.id = $1`,
    [tenantId]
  );
  const companyName = tenantRow?.business_name?.trim() || tenantRow?.name?.trim() || "Company";

  return (
    <OrdersClient
      tenantId={tenantId}
      isOwner={isOwner}
      orderLabel={orderLabel}
      ordersLabel={ordersLabel}
      companyName={companyName}
    />
  );
}
