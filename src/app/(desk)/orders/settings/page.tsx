import { redirect } from "next/navigation";
import { requireTenant } from "@/lib/auth";
import { q, one } from "@/lib/db";
import OrderSettingsClient from "./order-settings-client";

export const dynamic = "force-dynamic";

export default async function OrderSettingsPage() {
  const { tenantId, session } = await requireTenant();
  const isOwner = session.role === "owner" || session.superAdmin;
  if (!isOwner) {
    redirect("/orders");
  }

  const row = await one<{ order_settings: any }>(
    `SELECT order_settings FROM wa_bot_settings WHERE tenant_id = $1`,
    [tenantId]
  );

  const zones = await q(
    `SELECT id, name, fee, min_order, active
       FROM wa_delivery_zones
      WHERE tenant_id = $1
      ORDER BY name ASC`,
    [tenantId]
  );

  return (
    <OrderSettingsClient
      tenantId={tenantId}
      initialSettings={row?.order_settings || {}}
      initialZones={zones}
    />
  );
}
