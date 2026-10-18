import { requireTenant, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { normalizePhoneNumber, isValidConsentSource } from "@/lib/contacts-import";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const consent = (searchParams.get("consent") || "").trim();
    const limit = Math.min(Number(searchParams.get("limit") || 200), 500);

    const contacts = await q(
      `SELECT c.phone, COALESCE(NULLIF(c.name,''),'') AS name, c.needs_human, c.bot_enabled,
              c.last_message_at, c.consent_status, c.consent_source, c.consent_at, c.opted_out_at,
              COALESCE(um.summary,'') AS summary,
              c.lead_source, c.first_ad_title,
              (SELECT count(*) FROM wa_appointments a
                WHERE a.tenant_id = c.tenant_id AND a.phone = c.phone AND a.status = 'confirmed') AS bookings
         FROM wa_contacts c
         LEFT JOIN wa_user_memory um ON um.tenant_id = c.tenant_id AND um.phone = c.phone
        WHERE c.tenant_id = $1
          AND ($2 = '' OR c.phone ILIKE '%' || $2 || '%' OR COALESCE(c.name,'') ILIKE '%' || $2 || '%')
          AND ($3 = '' OR c.consent_status = $3)
        ORDER BY c.last_message_at DESC NULLS LAST LIMIT $4`,
      [tenantId, search, consent, limit]
    );

    return Response.json({ ok: true, contacts });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const body = await req.json();

    const consentConfirmed = Boolean(body.consentConfirmed);
    if (!consentConfirmed) {
      return Response.json(
        { ok: false, error: "consent_confirmation_required", message: "Consent declaration must be confirmed before adding contact." },
        { status: 400 }
      );
    }

    const consentSource = String(body.consentSource ?? "").trim();
    if (!isValidConsentSource(consentSource)) {
      return Response.json(
        { ok: false, error: "invalid_consent_source", message: "Please select a valid consent source." },
        { status: 400 }
      );
    }

    const rawPhone = String(body.phone ?? "").trim();
    const { phone: normalized, valid, reason } = normalizePhoneNumber(rawPhone);
    if (!valid) {
      return Response.json({ ok: false, error: "invalid_phone", message: reason || "Invalid phone number." }, { status: 400 });
    }

    const name = String(body.name ?? "").trim() || null;
    const note = String(body.consentNote ?? "").trim() || null;

    // Check existing contact
    const existing = await one<{ phone: string; consent_status: string; name: string | null }>(
      `SELECT phone, consent_status, name FROM wa_contacts WHERE tenant_id = $1 AND phone = $2`,
      [tenantId, normalized]
    );

    if (existing) {
      if (existing.consent_status === "opted_out") {
        // Staff cannot change an opted_out contact; only customer can by sending START
        return Response.json(
          {
            ok: false,
            error: "contact_opted_out",
            message: "This contact previously opted out and cannot be re-opted in by staff. Only the customer can opt back in by sending START on WhatsApp.",
          },
          { status: 400 }
        );
      }

      // Update existing contact
      await one(
        `UPDATE wa_contacts
            SET name = COALESCE(NULLIF($3, ''), name),
                consent_status = 'opted_in',
                consent_source = $4,
                consent_at = now(),
                notes = CASE WHEN $5::text IS NOT NULL THEN COALESCE(notes || E'\n', '') || $5 ELSE notes END
          WHERE tenant_id = $1 AND phone = $2
          RETURNING phone`,
        [tenantId, normalized, name, consentSource, note]
      );
      return Response.json({ ok: true, phone: normalized, status: "updated" });
    }

    // Insert new contact
    await one(
      `INSERT INTO wa_contacts (
         tenant_id, phone, name, consent_status, consent_source, consent_at, notes, created_at
       ) VALUES ($1, $2, $3, 'opted_in', $4, now(), $5, now())
       RETURNING phone`,
      [tenantId, normalized, name, consentSource, note]
    );

    return Response.json({ ok: true, phone: normalized, status: "created" });
  } catch (e) {
    return errorResponse(e);
  }
}
