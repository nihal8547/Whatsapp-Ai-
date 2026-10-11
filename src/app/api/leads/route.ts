import { requireTenant, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";

const VALID_STAGES = ["new", "qualified", "quoted", "negotiating", "won", "lost"];

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);
    const { searchParams } = new URL(req.url);

    const kind = searchParams.get("kind");
    const owner = searchParams.get("owner");
    const stage = searchParams.get("stage");
    const search = searchParams.get("search")?.trim();
    const dateFrom = searchParams.get("date_from");
    const dateTo = searchParams.get("date_to");
    const format = searchParams.get("format");
    const leadId = searchParams.get("id");

    const conditions: string[] = ["l.tenant_id = $1"];
    const params: any[] = [tenantId];
    let idx = 2;

    if (leadId) {
      conditions.push(`l.id = $${idx}`);
      params.push(Number(leadId));
      idx++;
    }

    if (kind && kind !== "all") {
      conditions.push(`l.kind = $${idx}`);
      params.push(kind);
      idx++;
    }

    if (owner && owner !== "all") {
      if (owner === "unassigned") {
        conditions.push(`l.assigned_to IS NULL`);
      } else {
        conditions.push(`l.assigned_to = $${idx}`);
        params.push(Number(owner));
        idx++;
      }
    }

    if (stage && stage !== "all") {
      conditions.push(`l.stage = $${idx}`);
      params.push(stage);
      idx++;
    }

    if (search) {
      conditions.push(
        `(l.name ILIKE $${idx} OR l.phone ILIKE $${idx} OR l.summary ILIKE $${idx})`
      );
      params.push(`%${search}%`);
      idx++;
    }

    if (dateFrom) {
      conditions.push(`l.created_at >= $${idx}::timestamptz`);
      params.push(dateFrom);
      idx++;
    }

    if (dateTo) {
      conditions.push(`l.created_at <= ($${idx}::timestamptz + interval '1 day')`);
      params.push(dateTo);
      idx++;
    }

    const whereClause = conditions.join(" AND ");

    const sql = `
      SELECT l.id, l.tenant_id, l.phone, l.name, l.kind, l.stage, l.summary,
             l.details, l.budget_min, l.budget_max, l.currency, l.value,
             l.assigned_to, l.next_followup_at, l.followups_sent, l.lost_reason,
             l.source, l.staff_alerted, l.created_at, l.updated_at,
             c.first_ad_title, c.lead_source,
             u.full_name AS owner_name, u.email AS owner_email
        FROM wa_leads l
        LEFT JOIN wa_contacts c ON c.tenant_id = l.tenant_id AND c.phone = l.phone
        LEFT JOIN wa_tenant_users u ON u.tenant_id = l.tenant_id AND u.id = l.assigned_to
       WHERE ${whereClause}
       ORDER BY l.updated_at DESC, l.id DESC
       LIMIT 1000
    `;

    const leads = await q(sql, params);

    if (format === "csv") {
      const csvHeader = [
        "ID",
        "Phone",
        "Name",
        "Kind",
        "Stage",
        "Summary",
        "Budget Min",
        "Budget Max",
        "Currency",
        "Value",
        "Owner",
        "Next Follow-up",
        "Ad Title",
        "Created At",
      ].join(",");

      const csvRows = leads.map((r: any) => {
        const escape = (val: any) => {
          if (val === null || val === undefined) return '""';
          const str = String(val).replace(/"/g, '""');
          return `"${str}"`;
        };
        return [
          r.id,
          escape(r.phone),
          escape(r.name || ""),
          escape(r.kind || ""),
          escape(r.stage || ""),
          escape(r.summary || ""),
          r.budget_min !== null ? r.budget_min : "",
          r.budget_max !== null ? r.budget_max : "",
          escape(r.currency || "QAR"),
          r.value !== null ? r.value : "",
          escape(r.owner_name || "Unassigned"),
          escape(r.next_followup_at ? new Date(r.next_followup_at).toISOString() : ""),
          escape(r.first_ad_title || ""),
          escape(r.created_at ? new Date(r.created_at).toISOString() : ""),
        ].join(",");
      });

      const csvContent = [csvHeader, ...csvRows].join("\r\n");
      return new Response(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="leads_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    return Response.json({ ok: true, leads });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId, session } = await requireTenant(req);
    const body = await req.json();

    const phone = String(body.phone || "").replace(/[^0-9]/g, "");
    if (!phone) {
      return Response.json({ ok: false, error: "phone_required" }, { status: 400 });
    }

    const name = body.name ? String(body.name).trim() : null;
    const kind = body.kind ? String(body.kind).trim() : "general";
    const stage = VALID_STAGES.includes(body.stage) ? body.stage : "new";
    const summary = body.summary ? String(body.summary).trim() : "";
    const details = body.details && typeof body.details === "object" ? body.details : {};
    const budgetMin = body.budget_min !== undefined && body.budget_min !== null && body.budget_min !== "" ? Number(body.budget_min) : null;
    const budgetMax = body.budget_max !== undefined && body.budget_max !== null && body.budget_max !== "" ? Number(body.budget_max) : null;
    const currency = body.currency ? String(body.currency).trim().toUpperCase() : "QAR";
    const value = body.value !== undefined && body.value !== null && body.value !== "" ? Number(body.value) : null;
    const nextFollowupAt = body.next_followup_at ? new Date(body.next_followup_at) : null;

    let assignedTo = body.assigned_to !== undefined && body.assigned_to !== null && body.assigned_to !== "" ? Number(body.assigned_to) : null;
    if (assignedTo) {
      const user = await one(`SELECT id, full_name FROM wa_tenant_users WHERE tenant_id = $1 AND id = $2`, [tenantId, assignedTo]);
      if (!user) {
        return Response.json({ ok: false, error: "invalid_assignee" }, { status: 400 });
      }
    }

    // Ensure contact exists
    await q(
      `INSERT INTO wa_contacts (tenant_id, phone, name)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, phone) DO UPDATE
         SET name = COALESCE(EXCLUDED.name, wa_contacts.name)`,
      [tenantId, phone, name]
    );

    const lead = await one(
      `INSERT INTO wa_leads (
         tenant_id, phone, name, kind, stage, summary, details,
         budget_min, budget_max, currency, value, assigned_to,
         next_followup_at, source, staff_alerted
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, false)
       RETURNING *`,
      [
        tenantId,
        phone,
        name,
        kind,
        stage,
        summary,
        JSON.stringify(details),
        budgetMin,
        budgetMax,
        currency,
        value,
        assignedTo,
        nextFollowupAt,
        body.source || "dashboard",
      ]
    );

    // Write initial event
    await q(
      `INSERT INTO wa_lead_events (lead_id, tenant_id, kind, body, data, created_by)
       VALUES ($1, $2, 'stage', $3, $4, $5)`,
      [
        lead.id,
        tenantId,
        `Lead created in stage: ${stage}`,
        JSON.stringify({ from: null, to: stage }),
        session?.userId || null,
      ]
    );

    return Response.json({ ok: true, lead });
  } catch (e: any) {
    if (e?.code === "23505") {
      return Response.json({ ok: false, error: "open_lead_already_exists" }, { status: 409 });
    }
    return errorResponse(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const { tenantId, session } = await requireTenant(req);
    const body = await req.json();

    const id = Number(body.id);
    if (!id) {
      return Response.json({ ok: false, error: "lead_id_required" }, { status: 400 });
    }

    const current = await one(
      `SELECT l.*, u.full_name AS current_assignee_name
         FROM wa_leads l
         LEFT JOIN wa_tenant_users u ON u.tenant_id = l.tenant_id AND u.id = l.assigned_to
        WHERE l.id = $1 AND l.tenant_id = $2`,
      [id, tenantId]
    );

    if (!current) {
      return Response.json({ ok: false, error: "lead_not_found" }, { status: 404 });
    }

    // 1. Stage update
    if (body.stage !== undefined && body.stage !== current.stage) {
      const newStage = String(body.stage);
      if (!VALID_STAGES.includes(newStage)) {
        return Response.json({ ok: false, error: "invalid_stage" }, { status: 400 });
      }

      const isCurrentFinal = current.stage === "won" || current.stage === "lost";
      const reopenNote = body.note ? String(body.note).trim() : "";

      // Rule: Won and Lost are final unless reopened with a note
      if (isCurrentFinal && !reopenNote) {
        return Response.json(
          { ok: false, error: "reopen_note_required", message: "A note is required to reopen a Won or Lost lead." },
          { status: 400 }
        );
      }

      let wonValue = current.value;
      if (newStage === "won") {
        if (body.value !== undefined && body.value !== null && body.value !== "") {
          wonValue = Number(body.value);
        }
      }

      let lostReason = current.lost_reason;
      if (newStage === "lost") {
        lostReason = body.lost_reason ? String(body.lost_reason).trim() : (body.note || "Lost");
      }

      await q(
        `UPDATE wa_leads
            SET stage = $1,
                value = $2,
                lost_reason = $3,
                updated_at = now()
          WHERE id = $4 AND tenant_id = $5`,
        [newStage, wonValue, lostReason, id, tenantId]
      );

      const eventBody = isCurrentFinal
        ? `Reopened lead (${current.stage} → ${newStage}): ${reopenNote}`
        : newStage === "won"
        ? `Marked Won with value ${current.currency} ${wonValue ?? 0}${body.note ? ` - ${body.note}` : ""}`
        : newStage === "lost"
        ? `Marked Lost: ${lostReason}`
        : `Stage changed: ${current.stage} → ${newStage}${body.note ? ` (${body.note})` : ""}`;

      await q(
        `INSERT INTO wa_lead_events (lead_id, tenant_id, kind, body, data, created_by)
         VALUES ($1, $2, 'stage', $3, $4, $5)`,
        [
          id,
          tenantId,
          eventBody,
          JSON.stringify({ from: current.stage, to: newStage, value: wonValue, lost_reason: lostReason }),
          session?.userId || null,
        ]
      );
    }

    // 2. Assignee update
    if (body.assigned_to !== undefined) {
      let newAssigneeId: number | null = null;
      let assigneeName = "Unassigned";

      if (body.assigned_to !== null && body.assigned_to !== "") {
        newAssigneeId = Number(body.assigned_to);
        const user = await one(
          `SELECT id, full_name, email FROM wa_tenant_users WHERE tenant_id = $1 AND id = $2`,
          [tenantId, newAssigneeId]
        );
        if (!user) {
          return Response.json(
            { ok: false, error: "invalid_assignee", message: "Assignee does not belong to this tenant." },
            { status: 403 }
          );
        }
        assigneeName = user.full_name || user.email;
      }

      if (newAssigneeId !== current.assigned_to) {
        await q(
          `UPDATE wa_leads
              SET assigned_to = $1,
                  updated_at = now()
            WHERE id = $2 AND tenant_id = $3`,
          [newAssigneeId, id, tenantId]
        );

        await q(
          `INSERT INTO wa_lead_events (lead_id, tenant_id, kind, body, data, created_by)
           VALUES ($1, $2, 'assign', $3, $4, $5)`,
          [
            id,
            tenantId,
            `Assigned to ${assigneeName}`,
            JSON.stringify({ assigned_to: newAssigneeId, assignee_name: assigneeName }),
            session?.userId || null,
          ]
        );

        // Assigning a lead creates a wa_notifications row for the assignee's tenant
        if (newAssigneeId) {
          await q(
            `INSERT INTO wa_notifications (tenant_id, kind, title, body, ref_type, ref_id)
             VALUES ($1, 'lead_assigned', $2, $3, 'lead', $4)`,
            [
              tenantId,
              `Lead assigned: ${current.name || current.phone}`,
              `Assigned to ${assigneeName} by ${session?.name || "Team"}`,
              id,
            ]
          );
        }
      }
    }

    // 3. Next follow-up date update
    if (body.next_followup_at !== undefined) {
      const followupDate = body.next_followup_at ? new Date(body.next_followup_at) : null;
      await q(
        `UPDATE wa_leads
            SET next_followup_at = $1,
                updated_at = now()
          WHERE id = $2 AND tenant_id = $3`,
        [followupDate, id, tenantId]
      );

      await q(
        `INSERT INTO wa_lead_events (lead_id, tenant_id, kind, body, data, created_by)
         VALUES ($1, $2, 'followup', $3, $4, $5)`,
        [
          id,
          tenantId,
          followupDate
            ? `Next follow-up scheduled for ${followupDate.toLocaleString()}`
            : "Follow-up schedule removed",
          JSON.stringify({ next_followup_at: followupDate }),
          session?.userId || null,
        ]
      );
    }

    // 4. Standalone note
    if (body.note && body.stage === undefined) {
      const noteText = String(body.note).trim();
      if (noteText) {
        await q(
          `INSERT INTO wa_lead_events (lead_id, tenant_id, kind, body, data, created_by)
           VALUES ($1, $2, 'note', $3, $4, $5)`,
          [id, tenantId, noteText, JSON.stringify({ note: noteText }), session?.userId || null]
        );
        await q(`UPDATE wa_leads SET updated_at = now() WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
      }
    }

    // Fetch updated row
    const updated = await one(
      `SELECT l.*,
              c.first_ad_title, c.lead_source,
              u.full_name AS owner_name, u.email AS owner_email
         FROM wa_leads l
         LEFT JOIN wa_contacts c ON c.tenant_id = l.tenant_id AND c.phone = l.phone
         LEFT JOIN wa_tenant_users u ON u.tenant_id = l.tenant_id AND u.id = l.assigned_to
        WHERE l.id = $1 AND l.tenant_id = $2`,
      [id, tenantId]
    );

    return Response.json({ ok: true, lead: updated });
  } catch (e) {
    return errorResponse(e);
  }
}
