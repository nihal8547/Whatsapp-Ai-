import { requireTenant, errorResponse } from "@/lib/auth";
import { q } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim();
    const consent = (searchParams.get("consent") || "").trim();

    const contacts = await q<{
      phone: string;
      name: string | null;
      consent_status: string;
      consent_source: string | null;
      consent_at: Date | string | null;
      opted_out_at: Date | string | null;
      last_message_at: Date | string | null;
      created_at: Date | string;
    }>(
      `SELECT phone, COALESCE(name, '') AS name, consent_status,
              COALESCE(consent_source, '') AS consent_source,
              consent_at, opted_out_at, last_message_at, created_at
         FROM wa_contacts
        WHERE tenant_id = $1
          AND ($2 = '' OR phone ILIKE '%' || $2 || '%' OR COALESCE(name,'') ILIKE '%' || $2 || '%')
          AND ($3 = '' OR consent_status = $3)
        ORDER BY created_at DESC`,
      [tenantId, search, consent]
    );

    // Format as CSV
    const headers = ["phone", "name", "consent_status", "consent_source", "consent_at", "opted_out_at", "last_message_at"];
    const rows = [headers.join(",")];

    for (const c of contacts) {
      const escape = (val: string | Date | null | undefined) => {
        if (!val) return '""';
        const str = typeof val === "string" ? val : new Date(val).toISOString();
        return `"${str.replace(/"/g, '""')}"`;
      };
      rows.push(
        [
          escape(c.phone),
          escape(c.name),
          escape(c.consent_status),
          escape(c.consent_source),
          escape(c.consent_at),
          escape(c.opted_out_at),
          escape(c.last_message_at),
        ].join(",")
      );
    }

    const csvContent = rows.join("\r\n");
    return new Response(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contacts-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
