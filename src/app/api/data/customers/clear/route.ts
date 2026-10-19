import { requireOwner, errorResponse } from "@/lib/auth";
import { q } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);

    const result = await q(
      `UPDATE wa_contacts
          SET attributes = '{}'::jsonb
        WHERE tenant_id = $1
        RETURNING phone`,
      [tenantId]
    );

    return Response.json({
      ok: true,
      clearedCount: result.length,
      message: `Cleared custom fields from ${result.length} contacts.`,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
