import { requireOwner, errorResponse, AuthError } from "@/lib/auth";
import { one } from "@/lib/db";

const VALID_MATCH_TYPES = ["source_id", "title_contains", "any"] as const;
type MatchType = (typeof VALID_MATCH_TYPES)[number];

/** PATCH /api/ads/playbooks/[id] */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId, session } = await requireOwner(req);
    if (session.role === "staff" && !session.superAdmin) throw new AuthError("forbidden", 403);

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!id) return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });

    const current = await one(
      `SELECT id, name, match_type, match_value, instructions, media_id, active, sort_order
         FROM wa_ad_playbooks WHERE id = $1 AND tenant_id = $2`,
      [id, tenantId]
    );
    if (!current) return Response.json({ ok: false, error: "not_found" }, { status: 404 });

    const body = await req.json();

    const name = body.name !== undefined ? String(body.name).trim() : current.name;
    if (!name) return Response.json({ ok: false, error: "name_required" }, { status: 400 });

    const match_type: MatchType = VALID_MATCH_TYPES.includes(body.match_type)
      ? body.match_type
      : current.match_type;

    let match_value: string = body.match_value !== undefined
      ? (String(body.match_value).trim())
      : current.match_value;

    if (match_type !== "any" && !match_value) {
      return Response.json({ ok: false, error: "match_value_required" }, { status: 400 });
    }
    if (match_type === "any") match_value = "";

    const instructions = body.instructions !== undefined
      ? String(body.instructions).trim()
      : current.instructions;
    if (!instructions) return Response.json({ ok: false, error: "instructions_required" }, { status: 400 });
    if (instructions.length > 2000) return Response.json({ ok: false, error: "instructions_too_long" }, { status: 400 });

    // media_id — verify ownership if changing
    let media_id: number | null = body.media_id !== undefined ? (body.media_id ? Number(body.media_id) : null) : current.media_id;
    if (media_id !== null && media_id !== current.media_id) {
      const m = await one(
        `SELECT id FROM wa_media WHERE id = $1 AND tenant_id = $2 AND active = true`,
        [media_id, tenantId]
      );
      if (!m) return Response.json({ ok: false, error: "media_not_found_or_wrong_tenant" }, { status: 400 });
    }

    const active = typeof body.active === "boolean" ? body.active : current.active;
    const sort_order = body.sort_order !== undefined ? Number(body.sort_order) : current.sort_order;

    // Duplicate check (exclude self)
    if (match_type !== "any" && (match_type !== current.match_type || match_value !== current.match_value)) {
      const dup = await one(
        `SELECT id FROM wa_ad_playbooks WHERE tenant_id = $1 AND match_type = $2 AND match_value = $3 AND id != $4`,
        [tenantId, match_type, match_value, id]
      );
      if (dup) {
        return Response.json(
          { ok: false, error: "duplicate_playbook", message: "A playbook with the same match type and value already exists." },
          { status: 409 }
        );
      }
    }

    const updated = await one(
      `UPDATE wa_ad_playbooks
          SET name = $1, match_type = $2, match_value = $3, instructions = $4,
              media_id = $5, active = $6, sort_order = $7, updated_at = now()
        WHERE id = $8 AND tenant_id = $9
        RETURNING id, name, match_type, match_value, instructions, media_id, active, sort_order`,
      [name, match_type, match_value, instructions, media_id, active, sort_order, id, tenantId]
    );

    return Response.json({ ok: true, playbook: updated });
  } catch (e) {
    return errorResponse(e);
  }
}

/** DELETE /api/ads/playbooks/[id] */
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId, session } = await requireOwner(req);
    if (session.role === "staff" && !session.superAdmin) throw new AuthError("forbidden", 403);

    const { id: rawId } = await params;
    const id = Number(rawId);
    if (!id) return Response.json({ ok: false, error: "invalid_id" }, { status: 400 });

    const deleted = await one(
      `DELETE FROM wa_ad_playbooks WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [id, tenantId]
    );
    if (!deleted) return Response.json({ ok: false, error: "not_found" }, { status: 404 });

    return Response.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
