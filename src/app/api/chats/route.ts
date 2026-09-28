import { requireTenant, errorResponse } from "@/lib/auth";
import { q } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const url = new URL(req.url);
    const filter = url.searchParams.get("filter") || "all";
    const search = (url.searchParams.get("search") || "").trim();

    const threads = await q(
      `SELECT c.phone,
              COALESCE(NULLIF(c.name,''), '') AS name,
              c.bot_enabled, c.needs_human, c.last_message_at,
              COALESCE((SELECT m.content FROM wa_messages m
                         WHERE m.tenant_id = c.tenant_id AND m.phone = c.phone
                         ORDER BY m.id DESC LIMIT 1), '') AS last_text
         FROM wa_contacts c
        WHERE c.tenant_id = $1
          AND ($2 = 'all' OR c.needs_human)
          AND ($3 = '' OR c.phone ILIKE '%' || $3 || '%' OR COALESCE(c.name,'') ILIKE '%' || $3 || '%')
        ORDER BY c.needs_human DESC, c.last_message_at DESC NULLS LAST
        LIMIT 80`,
      [tenantId, filter, search]
    );
    return Response.json({ ok: true, threads });
  } catch (e) {
    return errorResponse(e);
  }
}
