import { requireTenant, errorResponse } from "@/lib/auth";
import { q } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);

    const events = await q<{
      id: number;
      tenant_id: number;
      kind: string;
      detail: string;
      created_at: string;
    }>(
      `SELECT id, tenant_id, kind, detail,
              to_char(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at
         FROM wa_safety_events
        WHERE tenant_id = $1
        ORDER BY created_at DESC, id DESC
        LIMIT 50`,
      [tenantId]
    );

    return Response.json({
      ok: true,
      events: events ?? [],
    });
  } catch (e) {
    return errorResponse(e);
  }
}
