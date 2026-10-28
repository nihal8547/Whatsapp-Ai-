import { requireOwner, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);

    const logs = await q(
      `SELECT l.id, l.tenant_id, l.key_id, l.method, l.path, l.status, l.ip,
              to_char(l.created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS created_at,
              COALESCE(k.name, 'Unknown / Deleted key') AS key_name,
              k.key_prefix
         FROM wa_api_logs l
         LEFT JOIN wa_tenant_api_keys k ON k.id = l.key_id
        WHERE l.tenant_id = $1
        ORDER BY l.created_at DESC
        LIMIT 100`,
      [tenantId]
    );

    return Response.json({ ok: true, logs });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);

    await one(`DELETE FROM wa_api_logs WHERE tenant_id = $1`, [tenantId]);

    return Response.json({ ok: true, cleared: true });
  } catch (e) {
    return errorResponse(e);
  }
}
