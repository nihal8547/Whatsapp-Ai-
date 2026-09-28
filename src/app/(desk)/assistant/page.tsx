import { requireTenant } from "@/lib/auth";
import { one } from "@/lib/db";
import AssistantForm from "./form";

export const dynamic = "force-dynamic";

export default async function AssistantPage() {
  const { tenantId, session } = await requireTenant();
  const s = await one(
    `SELECT business_name, bot_name, persona_prompt, business_info, timezone,
            slot_interval_min, admin_phone, bot_enabled,
            reminder_24h_template, reminder_1h_template
       FROM wa_bot_settings WHERE tenant_id = $1`,
    [tenantId]
  );
  return (
    <AssistantForm
      initial={s}
      readOnly={session.role === "staff" && !session.superAdmin}
    />
  );
}
