import { requireTenant, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

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
