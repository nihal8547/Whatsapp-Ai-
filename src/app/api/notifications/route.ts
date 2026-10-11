import { requireTenant, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const { searchParams } = new URL(req.url);
    const since = searchParams.get("since");

    let items;
    if (since) {
      items = await q(
        `SELECT id, kind, title, body, ref_type, ref_id, created_at, read_at
           FROM wa_notifications
          WHERE tenant_id = $1 AND (created_at > $2::timestamptz OR read_at IS NULL)
          ORDER BY created_at DESC
          LIMIT 50`,
        [tenantId, since]
      );
    } else {
      items = await q(
        `SELECT id, kind, title, body, ref_type, ref_id, created_at, read_at
           FROM wa_notifications
          WHERE tenant_id = $1
          ORDER BY created_at DESC
          LIMIT 50`,
        [tenantId]
      );
    }

    const unread = await one<{ count: number }>(
      `SELECT count(*)::int AS count
         FROM wa_notifications
        WHERE tenant_id = $1 AND read_at IS NULL`,
      [tenantId]
    );

    return Response.json({
      ok: true,
      notifications: items,
      unreadCount: unread?.count ?? 0,
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const body = await req.json().catch(() => ({}));
    const { id, all } = body;

    if (all) {
      await q(
        `UPDATE wa_notifications
            SET read_at = now()
          WHERE tenant_id = $1 AND read_at IS NULL`,
        [tenantId]
      );
    } else if (id) {
      await q(
        `UPDATE wa_notifications
            SET read_at = now()
          WHERE tenant_id = $1 AND id = $2`,
        [tenantId, id]
      );
    }

    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
