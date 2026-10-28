import { requireTenant, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";
import {
  renderFollowupMessage,
  calculateScheduledFollowup,
} from "@/lib/followups";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);

    // Fetch tenant bot settings for followups
    const settings = await one<{
      followup_enabled: boolean;
      followup_after_hours: number;
      followup_template_enquiry: string;
      followup_template_quoted: string;
    }>(
      `SELECT followup_enabled,
              COALESCE(followup_after_hours, 72) AS followup_after_hours,
              COALESCE(followup_template_enquiry, 'Hi {name}, just checking in regarding {topic} — let us know if you have any questions!') AS followup_template_enquiry,
              COALESCE(followup_template_quoted, 'Hi {name}, following up on your quote for {topic} ({quote}) — let us know if you would like to proceed!') AS followup_template_quoted
         FROM wa_bot_settings
        WHERE tenant_id = $1`,
      [tenantId]
    );

    const afterHours = settings?.followup_after_hours ?? 72;
    const enquiryTpl =
      settings?.followup_template_enquiry ??
      "Hi {name}, just checking in regarding {topic} — let us know if you have any questions!";
    const quotedTpl =
      settings?.followup_template_quoted ??
      "Hi {name}, following up on your quote for {topic} ({quote}) — let us know if you would like to proceed!";

    // Query contacts matching the rules:
    // 1. intent = 'enquiry'
    // 2. lead_stage IN ('enquiry', 'quoted', 'negotiating')
    // 3. topic present (interest_topic IS NOT NULL AND trim != '')
    // 4. last message within 14 days
    // 5. not opted out (consent_status != 'opted_out')
    // 6. no future booking (no appointment in future that is not cancelled)
    const contacts = await q(
      `SELECT c.phone,
              COALESCE(NULLIF(c.name,''),'') AS name,
              c.intent,
              c.lead_stage,
              c.interest_topic,
              c.quote_summary,
              c.last_message_at,
              c.intent_locked,
              c.consent_status,
              c.consent_source
         FROM wa_contacts c
        WHERE c.tenant_id = $1
          AND c.intent = 'enquiry'
          AND c.lead_stage IN ('enquiry', 'quoted', 'negotiating')
          AND c.interest_topic IS NOT NULL AND trim(c.interest_topic) != ''
          AND c.last_message_at >= now() - interval '14 days'
          AND (c.consent_status IS NULL OR c.consent_status != 'opted_out')
          AND NOT EXISTS (
            SELECT 1 FROM wa_appointments a
             WHERE a.tenant_id = c.tenant_id
               AND a.phone = c.phone
               AND a.start_time > now()
               AND a.status != 'cancelled'
          )
        ORDER BY c.last_message_at ASC`,
      [tenantId]
    );

    // Calculate message that would be sent and when for each contact
    const followups = contacts.map((c: any) => {
      const templateToUse =
        c.lead_stage === "quoted" ? quotedTpl : enquiryTpl;

      const message = renderFollowupMessage(templateToUse, {
        name: c.name,
        topic: c.interest_topic,
        quote: c.quote_summary,
      });

      const { scheduledDate, isOverdue, windowNote } = calculateScheduledFollowup(
        c.last_message_at,
        afterHours
      );

      return {
        phone: c.phone,
        name: c.name,
        intent: c.intent,
        lead_stage: c.lead_stage,
        interest_topic: c.interest_topic,
        quote_summary: c.quote_summary,
        last_message_at: c.last_message_at,
        intent_locked: c.intent_locked,
        template_type: c.lead_stage === "quoted" ? "quote" : "enquiry",
        message_to_send: message,
        scheduled_at: scheduledDate.toISOString(),
        is_due: isOverdue,
        delivery_window: "09:00 - 21:00",
        window_note: windowNote,
      };
    });

    return Response.json({
      ok: true,
      enabled: settings?.followup_enabled ?? true,
      after_hours: afterHours,
      total: followups.length,
      followups,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const body = await req.json();
    const phone = String(body.phone || "").replace(/[^0-9]/g, "");

    if (!phone) {
      return Response.json({ ok: false, error: "phone_required" }, { status: 400 });
    }

    // Skip this person: sets intent 'other' with intent_locked = true
    const updated = await one(
      `UPDATE wa_contacts
          SET intent = 'other',
              intent_locked = true,
              intent_updated_at = now()
        WHERE tenant_id = $1 AND phone = $2
        RETURNING phone, name, intent, intent_locked`,
      [tenantId, phone]
    );

    if (!updated) {
      return Response.json(
        { ok: false, error: "not_found", message: "Contact not found" },
        { status: 404 }
      );
    }

    return Response.json({ ok: true, contact: updated, skipped: true });
  } catch (e) {
    return errorResponse(e);
  }
}
