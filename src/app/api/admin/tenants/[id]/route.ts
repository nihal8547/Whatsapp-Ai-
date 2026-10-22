import { requireSession, AuthError, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const s = await requireSession();
    if (!s.superAdmin) throw new AuthError("forbidden", 403);
    const { id } = await ctx.params;

    const tenant = await one(
      `SELECT t.id, t.name, t.slug, t.status, t.trial_ends_at, t.created_at,
              t.business_type, t.admin_notes, t.modules,
              COALESCE(p.name,'No plan') AS plan, p.id AS plan_id, p.price_qar,
              bs.timezone, bs.admin_phone,
              COALESCE((bs.broadcast_settings->>'enabled')::boolean, true) AS broadcasts_enabled,
              COALESCE((bs.broadcast_settings->>'daily_cap')::int, 100) AS broadcast_daily_cap,
              i.instance_name, COALESCE(i.status,'none') AS wa_status
         FROM wa_tenants t
         LEFT JOIN wa_plans p ON p.id = t.plan_id
         LEFT JOIN wa_bot_settings bs ON bs.tenant_id = t.id
         LEFT JOIN wa_instances i ON i.tenant_id = t.id
        WHERE t.id = $1::int`,
      [id]
    );
    if (!tenant) return Response.json({ ok: false, error: "not_found" }, { status: 404 });

    const usage = await q(
      `SELECT day, messages_in AS msg_received, ai_replies
         FROM wa_usage_daily
        WHERE tenant_id = $1
        ORDER BY day DESC LIMIT 30`,
      [id]
    );

    const counts = await one(
      `SELECT
         (SELECT count(*) FROM wa_services     WHERE tenant_id = $1 AND active)           AS services,
         (SELECT count(*) FROM wa_appointments WHERE tenant_id = $1 AND status='confirmed'
            AND start_time > now())                                                         AS upcoming,
         (SELECT count(*) FROM wa_tenant_users WHERE tenant_id = $1)                       AS team,
         (SELECT count(*) FROM wa_contacts     WHERE tenant_id = $1)                       AS contacts`,
      [id]
    );

    const team = await q(
      `SELECT email, role FROM wa_tenant_users WHERE tenant_id = $1 ORDER BY role, email`,
      [id]
    );

    return Response.json({ ok: true, tenant, usage, counts, team });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const s = await requireSession();
    if (!s.superAdmin) throw new AuthError("forbidden", 403);
    const { id } = await ctx.params;
    const b = await req.json();

    const row = await one(
      `UPDATE wa_tenants SET
         status        = COALESCE(NULLIF($2,''), status),
         plan_id       = COALESCE($3, plan_id),
         trial_ends_at = CASE WHEN $4::text = '' THEN trial_ends_at ELSE $4::timestamptz END,
         admin_notes   = COALESCE($5, admin_notes),
         modules       = CASE 
                           WHEN $6::text = '__NULL__' THEN NULL 
                           WHEN $6::text IS NOT NULL THEN $6::jsonb 
                           ELSE modules 
                         END
       WHERE id = $1::int
       RETURNING id, status, plan_id, admin_notes, modules`,
      [
        id,
        ["trial", "active", "suspended", "cancelled"].includes(b.status) ? b.status : "",
        b.plan_id ? Number(b.plan_id) : null,
        b.trial_ends_at ? String(b.trial_ends_at) : "",
        b.admin_notes !== undefined ? String(b.admin_notes) : null,
        b.modules === null ? "__NULL__" : (Array.isArray(b.modules) ? JSON.stringify(b.modules) : null),
      ]
    );
    if (!row) return Response.json({ ok: false, error: "not_found" }, { status: 404 });

    if (b.broadcasts_enabled !== undefined || b.broadcast_daily_cap !== undefined) {
      let bUpdate = `UPDATE wa_bot_settings
            SET broadcast_settings = COALESCE(broadcast_settings, '{"enabled": true, "daily_cap": 100, "hourly_cap": 25, "window_end": "21:00", "window_start": "09:00"}'::jsonb)`;
      
      if (b.broadcasts_enabled !== undefined) {
        bUpdate += `, broadcast_settings = jsonb_set(COALESCE(broadcast_settings, '{}'::jsonb), '{enabled}', '${Boolean(b.broadcasts_enabled)}'::jsonb)`;
      }
      if (b.broadcast_daily_cap !== undefined) {
        bUpdate += `, broadcast_settings = jsonb_set(COALESCE(broadcast_settings, '{}'::jsonb), '{daily_cap}', '${Math.max(1, Number(b.broadcast_daily_cap) || 100)}'::jsonb)`;
      }
      bUpdate += `, updated_at = now() WHERE tenant_id = $1::int`;

      await one(bUpdate, [id]);
    }

    return Response.json({ ok: true, ...row, broadcasts_enabled: b.broadcasts_enabled });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const s = await requireSession();
    if (!s.superAdmin) throw new AuthError("forbidden", 403);
    const { id } = await ctx.params;
    const tenantIdNum = Number(id);

    if (s.tenantId && s.tenantId === tenantIdNum) {
      return Response.json(
        { ok: false, error: "cannot_delete_active_workspace" },
        { status: 400 }
      );
    }

    const row = await one(
      `DELETE FROM wa_tenants WHERE id = $1::int RETURNING id, name`,
      [id]
    );
    if (!row) return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    return Response.json({ ok: true, deleted: row });
  } catch (e) {
    return errorResponse(e);
  }
}

