import { requireTenant, requireOwner, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

const MAX_ITEMS_PER_TENANT = 5000;
const VALID_KINDS = ["product", "dish", "room_type", "package", "listing", "course", "add_on"];

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const { searchParams } = new URL(req.url);

    const qSearch = searchParams.get("q")?.trim();
    const categoryId = searchParams.get("category_id");
    const available = searchParams.get("available");
    const active = searchParams.get("active");
    const kind = searchParams.get("kind");

    const conditions: string[] = ["i.tenant_id = $1"];
    const params: any[] = [tenantId];
    let idx = 2;

    if (qSearch) {
      conditions.push(
        `(i.name ILIKE $${idx} OR i.description ILIKE $${idx} OR EXISTS (SELECT 1 FROM unnest(i.aliases) a WHERE a ILIKE $${idx}))`
      );
      params.push(`%${qSearch}%`);
      idx++;
    }

    if (categoryId && categoryId !== "all") {
      conditions.push(`i.category_id = $${idx}`);
      params.push(Number(categoryId));
      idx++;
    }

    if (available && available !== "all") {
      conditions.push(`i.available = $${idx}`);
      params.push(available === "true");
      idx++;
    }

    if (active && active !== "all") {
      conditions.push(`i.active = $${idx}`);
      params.push(active === "true");
      idx++;
    }

    if (kind && kind !== "all") {
      conditions.push(`i.kind = $${idx}`);
      params.push(kind);
      idx++;
    }

    // Get dashboard URL for media tokens
    const ps = await one<{ dashboard_url: string }>(
      `SELECT dashboard_url FROM wa_platform_settings WHERE id = 1`
    );
    const baseUrl = (ps?.dashboard_url ?? "").replace(/\/$/, "");

    const items = await q(
      `SELECT i.id, i.tenant_id, i.category_id, i.kind, i.name, i.aliases,
              i.description, i.price, i.currency, i.unit, i.track_stock,
              i.stock_qty, i.available, i.variants, i.attributes, i.media_id,
              i.sort_order, i.active, i.created_at, i.updated_at,
              c.name AS category_name,
              m.public_token AS media_token,
              m.title AS media_title
         FROM wa_catalog_items i
         LEFT JOIN wa_catalog_categories c ON c.id = i.category_id AND c.tenant_id = i.tenant_id
         LEFT JOIN wa_media m ON m.id = i.media_id AND m.tenant_id = i.tenant_id
        WHERE ${conditions.join(" AND ")}
        ORDER BY i.sort_order ASC, i.name ASC`,
      params
    );

    const mapped = items.map((it) => ({
      ...it,
      media_url: it.media_token ? `${baseUrl}/media/${it.media_token}` : null,
    }));

    return Response.json({ ok: true, items: mapped });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);

    // Enforce 5,000 item limit
    const countRow = await one<{ cnt: number }>(
      `SELECT count(*)::int AS cnt FROM wa_catalog_items WHERE tenant_id = $1`,
      [tenantId]
    );
    if ((countRow?.cnt ?? 0) >= MAX_ITEMS_PER_TENANT) {
      return Response.json(
        { ok: false, error: "catalog_limit_reached", message: "Maximum 5,000 items per tenant reached." },
        { status: 400 }
      );
    }

    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) {
      return Response.json({ ok: false, error: "missing_name" }, { status: 400 });
    }

    let kind = String(body.kind || "product");
    if (!VALID_KINDS.includes(kind)) {
      kind = "product";
    }

    let aliases: string[] = [];
    if (Array.isArray(body.aliases)) {
      aliases = body.aliases.map((a: any) => String(a).trim()).filter(Boolean);
    } else if (typeof body.aliases === "string") {
      aliases = body.aliases.split(",").map((s: string) => s.trim()).filter(Boolean);
    }

    const categoryId = body.category_id ? Number(body.category_id) : null;
    const description = body.description ? String(body.description).trim() : null;
    const price = body.price !== undefined && body.price !== null && body.price !== "" ? Number(body.price) : null;
    const currency = String(body.currency || "QAR").trim();
    const unit = String(body.unit || "each").trim();
    const trackStock = Boolean(body.track_stock);
    const stockQty = body.stock_qty !== undefined && body.stock_qty !== null && body.stock_qty !== "" ? Number(body.stock_qty) : null;
    const available = body.available !== undefined ? Boolean(body.available) : true;
    const variants = Array.isArray(body.variants) ? JSON.stringify(body.variants) : "[]";
    const mediaId = body.media_id ? Number(body.media_id) : null;
    const sortOrder = body.sort_order ? Number(body.sort_order) : 0;
    const active = body.active !== undefined ? Boolean(body.active) : true;

    const inserted = await one(
      `INSERT INTO wa_catalog_items (
         tenant_id, category_id, kind, name, aliases, description,
         price, currency, unit, track_stock, stock_qty, available,
         variants, media_id, sort_order, active, updated_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10, $11, $12,
         $13::jsonb, $14, $15, $16, now()
       )
       ON CONFLICT (tenant_id, name) DO UPDATE SET
         category_id = EXCLUDED.category_id,
         kind = EXCLUDED.kind,
         aliases = EXCLUDED.aliases,
         description = EXCLUDED.description,
         price = EXCLUDED.price,
         currency = EXCLUDED.currency,
         unit = EXCLUDED.unit,
         track_stock = EXCLUDED.track_stock,
         stock_qty = EXCLUDED.stock_qty,
         available = EXCLUDED.available,
         variants = EXCLUDED.variants,
         media_id = EXCLUDED.media_id,
         sort_order = EXCLUDED.sort_order,
         active = EXCLUDED.active,
         updated_at = now()
       RETURNING *`,
      [
        tenantId,
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
      ]
    );

    return Response.json({ ok: true, item: inserted });
  } catch (e) {
    return errorResponse(e);
  }
}
