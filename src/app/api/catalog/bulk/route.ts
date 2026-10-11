import { requireOwner, errorResponse } from "@/lib/auth";
import { q } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);
    const body = await req.json();

    const { action, item_ids } = body;
    if (!Array.isArray(item_ids) || item_ids.length === 0) {
      return Response.json({ ok: false, error: "no_items_selected" }, { status: 400 });
    }

    const ids = item_ids.map((id: any) => Number(id)).filter(Boolean);
    if (ids.length === 0) {
      return Response.json({ ok: false, error: "invalid_item_ids" }, { status: 400 });
    }

    if (action === "sold_out") {
      const available = body.available !== undefined ? Boolean(body.available) : false;
      await q(
        `UPDATE wa_catalog_items
            SET available = $1, updated_at = now()
          WHERE tenant_id = $2 AND id = ANY($3::int[])`,
        [available, tenantId, ids]
      );
      return Response.json({ ok: true, count: ids.length });
    }

    if (action === "adjust_price") {
      const percent = Number(body.percent);
      if (isNaN(percent) || percent < -90 || percent > 500) {
        return Response.json(
          { ok: false, error: "invalid_percentage", message: "Percentage must be between -90% and +500%." },
          { status: 400 }
        );
      }

      await q(
        `UPDATE wa_catalog_items
            SET price = GREATEST(0, ROUND(price * (1 + $1::numeric / 100), 2)),
                updated_at = now()
          WHERE tenant_id = $2 AND id = ANY($3::int[]) AND price IS NOT NULL`,
        [percent, tenantId, ids]
      );
      return Response.json({ ok: true, count: ids.length });
    }

    return Response.json({ ok: false, error: "unknown_action" }, { status: 400 });
  } catch (e) {
    return errorResponse(e);
  }
}
