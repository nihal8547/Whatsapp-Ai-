import { requireOwner, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

const VALID_KINDS = ["product", "dish", "room_type", "package", "listing", "course", "add_on"];

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireOwner(req);
    const { id } = await ctx.params;
    const itemId = Number(id);
    if (!itemId) return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });

    const body = await req.json();

    const existing = await one(
      `SELECT * FROM wa_catalog_items WHERE id = $1 AND tenant_id = $2`,
      [itemId, tenantId]
    );
    if (!existing) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const name = body.name !== undefined ? String(body.name).trim() : existing.name;
    if (!name) {
      return Response.json({ ok: false, error: "name_cannot_be_empty" }, { status: 400 });
    }

    let kind = body.kind !== undefined ? String(body.kind) : existing.kind;
    if (!VALID_KINDS.includes(kind)) {
      kind = existing.kind || "product";
    }

    let aliases = existing.aliases;
    if (body.aliases !== undefined) {
      if (Array.isArray(body.aliases)) {
        aliases = body.aliases.map((a: any) => String(a).trim()).filter(Boolean);
      } else if (typeof body.aliases === "string") {
        aliases = body.aliases.split(",").map((s: string) => s.trim()).filter(Boolean);
      }
    }

    const categoryId = body.category_id !== undefined
      ? (body.category_id ? Number(body.category_id) : null)
      : existing.category_id;
    const description = body.description !== undefined ? (body.description ? String(body.description).trim() : null) : existing.description;
    const price = body.price !== undefined
      ? (body.price !== null && body.price !== "" ? Number(body.price) : null)
      : existing.price;
    const currency = body.currency !== undefined ? String(body.currency).trim() : existing.currency;
    const unit = body.unit !== undefined ? String(body.unit).trim() : existing.unit;
    const trackStock = body.track_stock !== undefined ? Boolean(body.track_stock) : existing.track_stock;
    const stockQty = body.stock_qty !== undefined
      ? (body.stock_qty !== null && body.stock_qty !== "" ? Number(body.stock_qty) : null)
      : existing.stock_qty;
    const available = body.available !== undefined ? Boolean(body.available) : existing.available;
    const variants = body.variants !== undefined
      ? JSON.stringify(Array.isArray(body.variants) ? body.variants : [])
      : JSON.stringify(existing.variants || []);
    const mediaId = body.media_id !== undefined
      ? (body.media_id ? Number(body.media_id) : null)
      : existing.media_id;
    const sortOrder = body.sort_order !== undefined ? Number(body.sort_order) : existing.sort_order;
    const active = body.active !== undefined ? Boolean(body.active) : existing.active;

    const updated = await one(
      `UPDATE wa_catalog_items SET
         category_id = $1,
         kind = $2,
         name = $3,
         aliases = $4,
         description = $5,
         price = $6,
         currency = $7,
         unit = $8,
         track_stock = $9,
         stock_qty = $10,
         available = $11,
         variants = $12::jsonb,
         media_id = $13,
         sort_order = $14,
         active = $15,
         updated_at = now()
       WHERE id = $16 AND tenant_id = $17
       RETURNING *`,
      [
        categoryId,
        kind,
        name,
        aliases,
        description,
        price,
        currency,
        unit,
        trackStock,
        stockQty,
        available,
        variants,
        mediaId,
        sortOrder,
        active,
        itemId,
        tenantId,
      ]
    );

    return Response.json({ ok: true, item: updated });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await requireOwner(req);
    const { id } = await ctx.params;
    const itemId = Number(id);

    const deleted = await one(
      `DELETE FROM wa_catalog_items WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [itemId, tenantId]
    );

    if (!deleted) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
