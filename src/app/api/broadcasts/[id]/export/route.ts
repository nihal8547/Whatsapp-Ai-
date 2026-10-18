import { requireOwner, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await requireOwner(req);
    const { id } = await ctx.params;
    const broadcastId = Number(id);

    const broadcast = await one<{ name: string }>(
      `SELECT name FROM wa_broadcasts WHERE id = $1 AND tenant_id = $2`,
      [broadcastId, tenantId]
    );
    if (!broadcast) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const recipients = await q<{
      phone: string;
      contact_name: string | null;
      status: string;
      skip_reason: string | null;
      error: string | null;
      sent_at: Date | string | null;
      has_replied: boolean;
    }>(
      `SELECT r.phone, COALESCE(c.name, '') AS contact_name, r.status,
              r.skip_reason, r.error, r.sent_at,
              EXISTS(
                SELECT 1 FROM wa_messages m
                 WHERE m.tenant_id = r.tenant_id
                   AND m.phone = r.phone
                   AND m.direction IN ('in', 'inbound')
                   AND m.created_at >= r.sent_at
                   AND m.created_at <= r.sent_at + interval '48 hours'
              ) AS has_replied
         FROM wa_broadcast_recipients r
         LEFT JOIN wa_contacts c ON c.tenant_id = r.tenant_id AND c.phone = r.phone
        WHERE r.broadcast_id = $1 AND r.tenant_id = $2
        ORDER BY r.id ASC`,
      [broadcastId, tenantId]
    );

    const headers = ["phone", "name", "status", "skip_reason", "error", "sent_at", "replied_within_48h"];
    const rows = [headers.join(",")];

    for (const r of recipients) {
      const escape = (val: string | Date | boolean | null | undefined) => {
        if (val === null || val === undefined) return '""';
        const str = String(val);
        return `"${str.replace(/"/g, '""')}"`;
      };
      rows.push(
        [
          escape(r.phone),
          escape(r.contact_name),
          escape(r.status),
          escape(r.skip_reason),
          escape(r.error),
          escape(r.sent_at),
          escape(r.has_replied ? "Yes" : "No"),
        ].join(",")
      );
    }

    const csvContent = rows.join("\r\n");
    const sanitizedName = broadcast.name.replace(/[^a-z0-9_-]/gi, "_");
    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="broadcast-${sanitizedName}-recipients.csv"`,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
