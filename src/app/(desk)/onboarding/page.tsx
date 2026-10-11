import { requireTenant } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { getTenantConfig } from "@/lib/packs";
import OnboardingWizard from "./wizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { tenantId, session } = await requireTenant();
  const config = await getTenantConfig(tenantId);

  const tenant = await one(
    `SELECT t.id, t.name, t.business_type, t.business_metadata,
            (SELECT status FROM wa_instances i WHERE i.tenant_id = t.id) AS wa_status,
            (SELECT bot_enabled FROM wa_bot_settings b WHERE b.tenant_id = t.id) AS bot_enabled,
            (SELECT business_info FROM wa_bot_settings b WHERE b.tenant_id = t.id) AS business_info,
            (SELECT admin_phone FROM wa_bot_settings b WHERE b.tenant_id = t.id) AS admin_phone
       FROM wa_tenants t
      WHERE t.id = $1`,
    [tenantId]
  );

  const hours = await q(
    `SELECT weekday, to_char(open_time, 'HH24:MI') AS open_time,
            to_char(close_time, 'HH24:MI') AS close_time, is_closed
       FROM wa_business_hours WHERE tenant_id = $1 ORDER BY weekday`,
    [tenantId]
  );

  const services = await q(
    `SELECT id, name, COALESCE(description,'') AS description, duration_min, price, currency, active
       FROM wa_services WHERE tenant_id = $1 ORDER BY id ASC`,
    [tenantId]
  );

  const faqs = await q(
    `SELECT id, question, answer, keywords, sort_order, active
       FROM wa_faqs WHERE tenant_id = $1 ORDER BY sort_order ASC, id ASC`,
    [tenantId]
  );

  const metadata = tenant?.business_metadata || {};
  const onboarding = metadata.onboarding || { step: 1, completed: false };

  return (
    <OnboardingWizard
      tenantId={tenantId}
      isOwner={session.role === "owner" || session.superAdmin}
      initialOnboarding={onboarding}
      tenant={{
        name: tenant?.name || "",
        business_info: tenant?.business_info || "",
        admin_phone: tenant?.admin_phone || "",
        wa_status: tenant?.wa_status || "none",
        bot_enabled: tenant?.bot_enabled ?? true,
      }}
      initialHours={hours}
      initialServices={services}
      initialFaqs={faqs}
      labels={config.labels}
      pack={config.pack}
    />
  );
}
