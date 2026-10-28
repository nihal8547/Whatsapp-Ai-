import { requireTenant, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";
import { isValidIntent, isValidStage } from "@/lib/followups";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ phone: string }> }
) {
  try {
    const { tenantId } = await requireTenant(req);
    const { phone } = await ctx.params;
    const digits = phone.replace(/[^0-9]/g, "");

    const contact = await one(
      `SELECT phone, COALESCE(NULLIF(name,''),'') AS name, bot_enabled, needs_human,
              consent_status, consent_source, consent_at, opted_out_at,
              lead_source, first_ad_title,
              intent, lead_stage, interest_topic, quote_summary,
              intent_updated_at, intent_locked,
              last_message_at
         FROM wa_contacts
        WHERE tenant_id = $1 AND phone = $2`,
      [tenantId, digits]
    );

    if (!contact) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    return Response.json({ ok: true, contact });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ phone: string }> }
) {
  try {
    const { tenantId, session } = await requireTenant(req);
    const { phone } = await ctx.params;
    const digits = phone.replace(/[^0-9]/g, "");

    // Find contact scoped strictly to this tenant
    const existing = await one<{
      phone: string;
      intent: string;
      lead_stage: string;
      intent_locked: boolean;
    }>(
      `SELECT phone, intent, lead_stage, intent_locked
         FROM wa_contacts
        WHERE tenant_id = $1 AND phone = $2`,
      [tenantId, digits]
    );

    if (!existing) {
      return Response.json(
        { ok: false, error: "not_found", message: "Contact not found" },
        { status: 404 }
      );
    }

    const body = await req.json();

    // If an AI classifier attempts to update, check if locked by staff
    if (body.is_ai === true) {
      if (existing.intent_locked) {
        return Response.json({
          ok: true,
          skipped: true,
          reason: "intent_locked_by_staff",
          message: "Contact intent is locked by staff; AI classifier skipped it.",
          contact: existing,
        });
      }
    }

    // Action: "Let AI decide again"
    if (body.reset_ai === true) {
      const updated = await one(
        `UPDATE wa_contacts
            SET intent = 'unknown',
                intent_locked = false,
                intent_updated_at = now()
          WHERE tenant_id = $1 AND phone = $2
          RETURNING phone, name, intent, lead_stage, interest_topic, quote_summary, intent_locked, intent_updated_at`,
        [tenantId, digits]
      );
      return Response.json({ ok: true, contact: updated, action: "reset_ai" });
    }

    // Action: "Skip this person"
    if (body.skip === true) {
      const updated = await one(
        `UPDATE wa_contacts
            SET intent = 'other',
                intent_locked = true,
                intent_updated_at = now()
          WHERE tenant_id = $1 AND phone = $2
          RETURNING phone, name, intent, lead_stage, interest_topic, quote_summary, intent_locked, intent_updated_at`,
        [tenantId, digits]
      );
      return Response.json({ ok: true, contact: updated, action: "skip" });
    }

    // Manual change of intent and/or stage by staff
    let nextIntent = existing.intent;
    let nextStage = existing.lead_stage;
    let lockIntent = existing.intent_locked;

    if (body.intent !== undefined) {
      if (!isValidIntent(body.intent)) {
        return Response.json(
          {
            ok: false,
            error: "invalid_intent",
            message: `Invalid intent '${body.intent}'. Must be one of: unknown, enquiry, job_seeker, support, customer, other.`,
          },
          { status: 400 }
        );
      }
      nextIntent = body.intent;
      // Staff decided: lock it unless explicit reset
      lockIntent = true;
    }

    if (body.lead_stage !== undefined) {
      if (!isValidStage(body.lead_stage)) {
        return Response.json(
          {
            ok: false,
            error: "invalid_lead_stage",
            message: `Invalid lead stage '${body.lead_stage}'. Must be one of: none, enquiry, quoted, negotiating, booked, lost.`,
          },
          { status: 400 }
        );
      }
      nextStage = body.lead_stage;
      // Staff decided: lock it
      lockIntent = true;
    }

    const topicParam = body.interest_topic !== undefined ? String(body.interest_topic).trim() : null;
    const quoteParam = body.quote_summary !== undefined ? String(body.quote_summary).trim() : null;

    const updated = await one(
      `UPDATE wa_contacts
          SET intent = $3,
              lead_stage = $4,
              interest_topic = CASE WHEN $5::text IS NOT NULL THEN NULLIF($5, '') ELSE interest_topic END,
              quote_summary = CASE WHEN $6::text IS NOT NULL THEN NULLIF($6, '') ELSE quote_summary END,
              intent_locked = $7,
              intent_updated_at = now()
        WHERE tenant_id = $1 AND phone = $2
        RETURNING phone, name, intent, lead_stage, interest_topic, quote_summary, intent_locked, intent_updated_at`,
      [tenantId, digits, nextIntent, nextStage, topicParam, quoteParam, lockIntent]
    );

    return Response.json({ ok: true, contact: updated });
  } catch (e) {
    return errorResponse(e);
  }
}
