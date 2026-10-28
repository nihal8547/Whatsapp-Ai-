import { requireTenant, requireOwner, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";
import {
  validateFollowupHours,
  validateFollowupTemplate,
  ENQUIRY_ALLOWED_VARS,
  QUOTED_ALLOWED_VARS,
} from "@/lib/followups";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const s = await one(
      `SELECT business_name, bot_name, persona_prompt, business_info, timezone,
              slot_interval_min, admin_phone, bot_enabled,
              reminder_24h_template, reminder_1h_template,
              followup_enabled, followup_after_hours, followup_template,
              followup_template_enquiry, followup_template_quoted,
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

    // Strict validation for follow-up hours (24 to 168)
    if (b.followup_after_hours !== undefined && b.followup_after_hours !== null && b.followup_after_hours !== "") {
      const vh = validateFollowupHours(b.followup_after_hours);
      if (!vh.ok) {
        return Response.json({ ok: false, error: "invalid_followup_hours", message: vh.error }, { status: 400 });
      }
    }

    // Strict validation for enquiry follow-up template (max 300 chars, only {name} and {topic})
    if (b.followup_template_enquiry !== undefined) {
      const vt = validateFollowupTemplate(
        String(b.followup_template_enquiry ?? ""),
        ENQUIRY_ALLOWED_VARS,
        "Enquiry follow-up template"
      );
      if (!vt.ok) {
        return Response.json({ ok: false, error: "invalid_template_variable", message: vt.error }, { status: 400 });
      }
    }

    // Strict validation for quote follow-up template (max 300 chars, only {name}, {topic}, {quote})
    if (b.followup_template_quoted !== undefined) {
      const vt = validateFollowupTemplate(
        String(b.followup_template_quoted ?? ""),
        QUOTED_ALLOWED_VARS,
        "Quote follow-up template"
      );
      if (!vt.ok) {
        return Response.json({ ok: false, error: "invalid_template_variable", message: vt.error }, { status: 400 });
      }
    }

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
         followup_template_enquiry = COALESCE(NULLIF($15,''), followup_template_enquiry),
         followup_template_quoted = COALESCE(NULLIF($16,''), followup_template_quoted),
         review_enabled = COALESCE($17, review_enabled),
         review_delay_hours = COALESCE($18, review_delay_hours),
         review_link = COALESCE(NULLIF($19,''), review_link),
         review_template = COALESCE(NULLIF($20,''), review_template),
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
        b.followup_template_enquiry !== undefined ? String(b.followup_template_enquiry) : null,
        b.followup_template_quoted !== undefined ? String(b.followup_template_quoted) : null,
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

