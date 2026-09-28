import { requireTenant } from "@/lib/auth";
import { one } from "@/lib/db";
import Inbox from "./inbox";

export const dynamic = "force-dynamic";

export default async function ChatsPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>;
}) {
  const { tenantId } = await requireTenant();
  const sp = await searchParams;
  const settings = await one(`SELECT timezone FROM wa_bot_settings WHERE tenant_id = $1`, [tenantId]);
  return <Inbox initialPhone={sp.phone ?? null} tz={settings?.timezone || "Asia/Qatar"} />;
}
