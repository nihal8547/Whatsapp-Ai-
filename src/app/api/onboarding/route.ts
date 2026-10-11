import { requireTenant, requireOwner, errorResponse } from "@/lib/auth";
import { one, q } from "@/lib/db";
import { getTenantConfig } from "@/lib/packs";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
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

    const servicesCount = await one(
      `SELECT count(*)::int AS cnt FROM wa_services WHERE tenant_id = $1 AND active = true`,
      [tenantId]
    );

    const activeFaqCount = await one(
      `SELECT count(*)::int AS cnt FROM wa_faqs WHERE tenant_id = $1 AND active = true`,
      [tenantId]
    );

    const hours = await q(
      `SELECT weekday, to_char(open_time, 'HH24:MI') AS open_time,
              to_char(close_time, 'HH24:MI') AS close_time, is_closed
         FROM wa_business_hours WHERE tenant_id = $1 ORDER BY weekday`,
      [tenantId]
    );

    const metadata = tenant?.business_metadata || {};
    const onboarding = metadata.onboarding || { step: 1, completed: false };

    const checklist = {
      whatsappConnected: tenant?.wa_status === "connected",
      hasServices: (servicesCount?.cnt ?? 0) >= 1,
      servicesCount: servicesCount?.cnt ?? 0,
      hasActiveFaqs: (activeFaqCount?.cnt ?? 0) >= 3,
      activeFaqCount: activeFaqCount?.cnt ?? 0,
      botEnabled: tenant?.bot_enabled ?? true,
    };

    return Response.json({
      ok: true,
      onboarding,
      checklist,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        business_info: tenant.business_info || "",
        admin_phone: tenant.admin_phone || "",
        wa_status: tenant.wa_status || "none",
        bot_enabled: tenant.bot_enabled ?? true,
      },
      hours,
      labels: config.labels,
      pack: config.pack,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);
    const body = await req.json();

    const currentTenant = await one(`SELECT business_metadata FROM wa_tenants WHERE id = $1`, [tenantId]);
    const metadata = currentTenant?.business_metadata || {};
    const currentOnboarding = metadata.onboarding || { step: 1, completed: false };

    const updatedOnboarding = {
      ...currentOnboarding,
      step: body.step !== undefined ? Number(body.step) : currentOnboarding.step,
      completed: body.completed !== undefined ? !!body.completed : currentOnboarding.completed,
      finished_at: body.completed ? new Date().toISOString() : currentOnboarding.finished_at,
    };

    // Update business profile if passed
    if (body.profile) {
      const p = body.profile;
      await q(
        `UPDATE wa_bot_settings
            SET business_info = COALESCE(NULLIF($2,''), business_info),
                admin_phone = COALESCE(NULLIF($3,''), admin_phone)
          WHERE tenant_id = $1`,
        [tenantId, p.business_info || "", p.admin_phone ? String(p.admin_phone).replace(/[^0-9]/g, "") : ""]
      );
    }

    // Merge onboarding into business_metadata safely
    await q(
      `UPDATE wa_tenants
          SET business_metadata = jsonb_set(
            COALESCE(business_metadata, '{}'::jsonb),
            '{onboarding}',
            $1::jsonb,
            true
          )
        WHERE id = $2`,
      [JSON.stringify(updatedOnboarding), tenantId]
    );

    return Response.json({ ok: true, onboarding: updatedOnboarding });
  } catch (e) {
    return errorResponse(e);
  }
}
