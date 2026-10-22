import { requireTenant, requireOwner, errorResponse, AuthError } from "@/lib/auth";
import { q, one } from "@/lib/db";

const VALID_MATCH_TYPES = ["source_id", "title_contains", "any"] as const;
type MatchType = (typeof VALID_MATCH_TYPES)[number];

/** GET /api/ads/playbooks */
export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);

    const playbooks = await q(
      `SELECT pb.id, pb.name, pb.match_type, pb.match_value, pb.instructions,
              pb.media_id, pb.active, pb.sort_order,
              m.title AS media_title, m.public_token AS media_token
         FROM wa_ad_playbooks pb
         LEFT JOIN wa_media m ON m.id = pb.media_id AND m.tenant_id = pb.tenant_id
        WHERE pb.tenant_id = $1
        ORDER BY pb.sort_order ASC, pb.id ASC`,
      [tenantId]
    );

    // Media library (active items only, for the form picker)
    const media = await q(
      `SELECT id, title, category, public_token, mime_type
         FROM wa_media
        WHERE tenant_id = $1 AND active = true
        ORDER BY title ASC`,
      [tenantId]
    );

    return Response.json({ ok: true, playbooks, media });
  } catch (e) {
    return errorResponse(e);
  }
}

/** POST /api/ads/playbooks — create a new playbook */
export async function POST(req: Request) {
  try {
    const { tenantId, session } = await requireOwner(req);
    if (session.role === "staff" && !session.superAdmin) {
      throw new AuthError("forbidden", 403);
    }

    const body = await req.json();
    const validation = validateBody(body);
    if (!validation.ok) {
      return Response.json({ ok: false, error: validation.error }, { status: 400 });
    }
    const { name, match_type, match_value, instructions, media_id, active, sort_order } = validation;

    // Validate media_id belongs to this tenant
    if (media_id !== null) {
      const m = await one(
        `SELECT id FROM wa_media WHERE id = $1 AND tenant_id = $2 AND active = true`,
        [media_id, tenantId]
      );
      if (!m) {
        return Response.json({ ok: false, error: "media_not_found_or_wrong_tenant" }, { status: 400 });
      }
    }

    // Check duplicate
    if (match_type !== "any") {
      const dup = await one(
        `SELECT id FROM wa_ad_playbooks WHERE tenant_id = $1 AND match_type = $2 AND match_value = $3`,
        [tenantId, match_type, match_value]
      );
      if (dup) {
        return Response.json(
          { ok: false, error: "duplicate_playbook", message: "A playbook with the same match type and value already exists." },
          { status: 409 }
        );
      }
    } else {
      const dup = await one(
        `SELECT id FROM wa_ad_playbooks WHERE tenant_id = $1 AND match_type = 'any'`,
        [tenantId]
      );
      if (dup) {
        return Response.json(
          { ok: false, error: "duplicate_playbook", message: "An \"Any ad\" playbook already exists. Only one is allowed." },
          { status: 409 }
        );
      }
    }

    const row = await one(
      `INSERT INTO wa_ad_playbooks
         (tenant_id, name, match_type, match_value, instructions, media_id, active, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, name, match_type, match_value, instructions, media_id, active, sort_order`,
      [tenantId, name, match_type, match_value, instructions, media_id, active, sort_order]
    );

    return Response.json({ ok: true, playbook: row }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}

// ─── shared validation ─────────────────────────────────────────────────────

function validateBody(body: any): { ok: true; name: string; match_type: MatchType; match_value: string; instructions: string; media_id: number | null; active: boolean; sort_order: number } | { ok: false; error: string } {
  const name = String(body.name ?? "").trim();
  if (!name) return { ok: false, error: "name_required" };
  if (name.length > 100) return { ok: false, error: "name_too_long" };

  const match_type = body.match_type as MatchType;
  if (!VALID_MATCH_TYPES.includes(match_type)) {
    return { ok: false, error: "invalid_match_type" };
  }

  const raw_match_value = body.match_value !== undefined ? String(body.match_value ?? "").trim() : "";
  if (match_type !== "any" && !raw_match_value) {
    return { ok: false, error: "match_value_required" };
  }
  const match_value = match_type === "any" ? "" : raw_match_value;

  const instructions = String(body.instructions ?? "").trim();
  if (!instructions) return { ok: false, error: "instructions_required" };
  if (instructions.length > 2000) return { ok: false, error: "instructions_too_long" };

  const media_id = body.media_id ? Number(body.media_id) : null;
  const active = typeof body.active === "boolean" ? body.active : true;
  const sort_order = Number(body.sort_order ?? 0) || 0;

  return { ok: true, name, match_type, match_value, instructions, media_id, active, sort_order };
}
