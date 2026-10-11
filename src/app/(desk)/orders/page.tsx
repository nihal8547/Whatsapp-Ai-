import { requireTenant } from "@/lib/auth";
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

  return (
    <OrdersClient
      tenantId={tenantId}
      isOwner={isOwner}
      orderLabel={orderLabel}
      ordersLabel={ordersLabel}
    />
  );
}
