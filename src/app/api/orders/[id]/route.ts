import { requireTenant, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireTenant(req);
    const { id } = await ctx.params;
    const orderId = Number(id);
    if (!orderId) return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });

    const body = await req.json();

    const existing = await one(
      `SELECT * FROM wa_orders WHERE id = $1 AND tenant_id = $2`,
      [orderId, tenantId]
    );
    if (!existing) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const staffNotes = body.staff_notes !== undefined ? String(body.staff_notes) : existing.staff_notes;
    const paymentStatus = body.payment_status !== undefined ? String(body.payment_status) : existing.payment_status;
    const trackingRef = body.tracking_ref !== undefined ? String(body.tracking_ref) : existing.tracking_ref;

    const updated = await one(
      `UPDATE wa_orders
          SET staff_notes = $1,
              payment_status = $2,
              tracking_ref = $3,
              updated_at = now()
        WHERE id = $4 AND tenant_id = $5
        RETURNING *`,
      [staffNotes, paymentStatus, trackingRef, orderId, tenantId]
    );

    return Response.json({ ok: true, order: updated });
  } catch (e) {
    return errorResponse(e);
  }
}
