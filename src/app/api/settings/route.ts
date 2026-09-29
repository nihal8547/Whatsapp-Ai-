import { requireTenant, requireOwner, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const s = await one(
      `SELECT business_name, bot_name, persona_prompt, business_info, timezone,
              slot_interval_min, admin_phone, bot_enabled,
              reminder_24h_template, reminder_1h_template,
              followup_enabled, followup_after_hours, followup_template,
              review_enabled, review_delay_hours, review_link, review_template
         FROM wa_bot_settings WHERE tenant_id = $1`,
      [tenantId]
    );
    return Response.json({ ok: true, settings: s });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PUT(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);
    const b = await req.json();
    const row = await one(
      `UPDATE wa_bot_settings SET
         business_name = COALESCE(NULLIF($2,''), business_name),
         bot_name = COALESCE(NULLIF($3,''), bot_name),
         persona_prompt = COALESCE(NULLIF($4,''), persona_prompt),
         business_info = COALESCE(NULLIF($5,''), business_info),
         timezone = COALESCE(NULLIF($6,''), timezone),
         slot_interval_min = COALESCE($7, slot_interval_min),
         admin_phone = COALESCE(NULLIF($8,''), admin_phone),
         bot_enabled = COALESCE($9, bot_enabled),
         reminder_24h_template = COALESCE(NULLIF($10,''), reminder_24h_template),
         reminder_1h_template = COALESCE(NULLIF($11,''), reminder_1h_template),
         followup_enabled = COALESCE($12, followup_enabled),
         followup_after_hours = COALESCE($13, followup_after_hours),
         followup_template = COALESCE(NULLIF($14,''), followup_template),
         review_enabled = COALESCE($15, review_enabled),
         review_delay_hours = COALESCE($16, review_delay_hours),
         review_link = COALESCE(NULLIF($17,''), review_link),
         review_template = COALESCE(NULLIF($18,''), review_template),
         updated_at = now()
       WHERE tenant_id = $1 RETURNING tenant_id`,
      [
        tenantId,
        String(b.business_name ?? ""),
        String(b.bot_name ?? ""),
        String(b.persona_prompt ?? ""),
        String(b.business_info ?? ""),
        String(b.timezone ?? ""),
        b.slot_interval_min ? Number(b.slot_interval_min) : null,
        String(b.admin_phone ?? "").replace(/[^0-9]/g, ""),
        typeof b.bot_enabled === "boolean" ? b.bot_enabled : null,
        String(b.reminder_24h_template ?? ""),
        String(b.reminder_1h_template ?? ""),
        typeof b.followup_enabled === "boolean" ? b.followup_enabled : null,
        b.followup_after_hours ? Number(b.followup_after_hours) : null,
        String(b.followup_template ?? ""),
        typeof b.review_enabled === "boolean" ? b.review_enabled : null,
        b.review_delay_hours ? Number(b.review_delay_hours) : null,
        String(b.review_link ?? ""),
        String(b.review_template ?? ""),
      ]
    );
    if (!row) return Response.json({ ok: false, error: "not_found" }, { status: 404 });

    if (b.business_name) {
      await one(`UPDATE wa_tenants SET name = $2 WHERE id = $1 RETURNING id`, [
        tenantId,
        String(b.business_name),
      ]);
    }
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
