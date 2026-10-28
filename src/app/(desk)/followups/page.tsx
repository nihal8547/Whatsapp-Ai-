import { requireTenant } from "@/lib/auth";
import { q, one } from "@/lib/db";
import {
  renderFollowupMessage,
  calculateScheduledFollowup,
} from "@/lib/followups";
import FollowupsClient, { FollowupItem } from "./followups-client";

export const dynamic = "force-dynamic";

export default async function NextFollowupsPage() {
  const { tenantId } = await requireTenant();

  // Fetch tenant bot settings
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

  // Query matching contacts:
  // 1. intent = 'enquiry'
  // 2. lead_stage IN ('enquiry', 'quoted', 'negotiating')
  // 3. topic present (interest_topic IS NOT NULL AND trim != '')
  // 4. last message within 14 days
  // 5. not opted out (consent_status != 'opted_out')
  // 6. no future booking
  const contacts = await q(
    `SELECT c.phone,
            COALESCE(NULLIF(c.name,''),'') AS name,
            c.intent,
            c.lead_stage,
            c.interest_topic,
            c.quote_summary,
            c.last_message_at,
            COALESCE(c.intent_locked, false) AS intent_locked,
            c.consent_status
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

  const followups: FollowupItem[] = contacts.map((c: any) => {
    const isQuoted = c.lead_stage === "quoted";
    const tpl = isQuoted ? quotedTpl : enquiryTpl;
    const rendered = renderFollowupMessage(tpl, {
      name: c.name,
      topic: c.interest_topic,
      quote: c.quote_summary,
    });
    const timing = calculateScheduledFollowup(c.last_message_at, afterHours);

    return {
      phone: c.phone,
      name: c.name,
      intent: c.intent,
      lead_stage: c.lead_stage,
      interest_topic: c.interest_topic,
      quote_summary: c.quote_summary,
      last_message_at: c.last_message_at ? new Date(c.last_message_at).toISOString() : "",
      intent_locked: c.intent_locked,
      template_type: isQuoted ? "quote" : "enquiry",
      message_to_send: rendered,
      scheduled_at: timing.scheduledDate.toISOString(),
      is_due: timing.isOverdue,
      delivery_window: "09:00 - 21:00",
      window_note: timing.windowNote,
    };
  });

  return (
    <FollowupsClient
      initialFollowups={followups}
      enabled={settings?.followup_enabled ?? true}
      afterHours={afterHours}
    />
  );
}
