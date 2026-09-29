import { requireOwner, errorResponse } from "@/lib/auth";
import { one } from "@/lib/db";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await requireOwner(req);
    const { id } = await ctx.params;
    const b = await req.json();

    // Build keywords array from either an array or a comma-separated string.
    let keywords: string[] | null = null;
    if (b.keywords !== undefined) {
      if (Array.isArray(b.keywords)) {
        keywords = (b.keywords as string[]).map((k: string) => k.trim()).filter(Boolean);
      } else {
        keywords = String(b.keywords)
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean);
      }
    }

    const row = await one(
      `UPDATE wa_media SET
         title      = COALESCE(NULLIF($3,''), title),
         category   = COALESCE($4, category),
         keywords   = COALESCE($5, keywords),
         caption    = COALESCE($6, caption),
         service_id = COALESCE($7, service_id),
         active     = COALESCE($8, active)
       WHERE tenant_id = $1 AND id = $2::int
       RETURNING id`,
      [
        tenantId,
        id,
        String(b.title ?? ""),
        b.category ?? null,
        keywords,
        b.caption !== undefined ? (String(b.caption).trim() || null) : null,
        b.service_id !== undefined
          ? b.service_id === null
            ? null
            : Number(b.service_id)
          : null,
        b.active !== undefined ? Boolean(b.active) : null,
      ]
    );

    if (!row) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    return Response.json({ ok: true, ...row });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await requireOwner(req);
    const { id } = await ctx.params;

    // Soft-delete: set active = false, matching the Services pattern.
    // Keep the row so any in-flight bot replies still resolve the URL.
    const row = await one(
      `UPDATE wa_media SET active = false
       WHERE tenant_id = $1 AND id = $2::int
       RETURNING id`,
      [tenantId, id]
    );

    if (!row) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
