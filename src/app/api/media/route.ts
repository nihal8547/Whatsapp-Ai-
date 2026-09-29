import { requireTenant, requireOwner, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);

    // Fetch dashboard_url from platform settings to build the public URL.
    const ps = await one<{ dashboard_url: string }>(
      `SELECT dashboard_url FROM wa_platform_settings WHERE id = 1`
    );
    const baseUrl = (ps?.dashboard_url ?? "").replace(/\/$/, "");

    const rows = await q(
      `SELECT id, title, category, keywords, COALESCE(caption,'') AS caption,
              service_id, mime_type, active, created_at,
              public_token
         FROM wa_media
        WHERE tenant_id = $1
        ORDER BY active DESC, created_at DESC`,
      [tenantId]
    );

    const media = rows.map((r) => ({
      ...r,
      url: `${baseUrl}/media/${r.public_token}`,
    }));

    return Response.json({ ok: true, media });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    // Only owner/admin may add photos; staff cannot manage the media library.
    const { tenantId } = await requireOwner(req);

    const form = await req.formData();
    const file = form.get("file") as File | null;
    const title = String(form.get("title") || "").trim();
    const category = String(form.get("category") || "general");
    const keywordsRaw = String(form.get("keywords") || "");
    const caption = String(form.get("caption") || "").trim() || null;
    const serviceIdRaw = form.get("service_id");
    const serviceId =
      serviceIdRaw && String(serviceIdRaw) !== ""
        ? Number(serviceIdRaw)
        : null;

    if (!file) {
      return Response.json({ ok: false, error: "no_file" }, { status: 400 });
    }
    if (!title) {
      return Response.json({ ok: false, error: "missing_title" }, { status: 400 });
    }
    if (!ALLOWED_MIME.includes(file.type)) {
      return Response.json(
        { ok: false, error: "unsupported_mime_type" },
        { status: 415 }
      );
    }

    const arrayBuf = await file.arrayBuffer();
    if (arrayBuf.byteLength > MAX_BYTES) {
      return Response.json({ ok: false, error: "file_too_large" }, { status: 413 });
    }

    const buffer = Buffer.from(arrayBuf);

    // Keywords: comma-separated string → trimmed array, drop empties.
    const keywords = keywordsRaw
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (!["offer", "package", "service", "general"].includes(category)) {
      return Response.json({ ok: false, error: "invalid_category" }, { status: 400 });
    }

    const row = await one(
      `INSERT INTO wa_media (tenant_id, title, category, keywords, caption, service_id, mime_type, file_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, title, category, keywords, public_token`,
      [tenantId, title, category, keywords, caption, serviceId, file.type, buffer]
    );

    return Response.json({ ok: true, media: row }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
