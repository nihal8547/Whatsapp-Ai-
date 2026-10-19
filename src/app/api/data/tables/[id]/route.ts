import { requireTenant, requireOwner, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { neutralizeCell } from "@/lib/csv-data";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await requireTenant(req);
    const { id } = await ctx.params;
    const tableId = Number(id);

    const table = await one(
      `SELECT * FROM wa_data_tables WHERE id = $1 AND tenant_id = $2`,
      [tableId, tenantId]
    );
    if (!table) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const url = new URL(req.url);
    const isExport = url.searchParams.get("export") === "true";

    // 1. Export as CSV
    if (isExport) {
      const rows = await q<{ data: Record<string, any> }>(
        `SELECT data FROM wa_data_rows WHERE table_id = $1 AND tenant_id = $2 ORDER BY id ASC`,
        [tableId, tenantId]
      );

      const columns: Array<{ name: string; key: string }> = Array.isArray(table.columns) ? table.columns : [];
      const headers = columns.map((c) => c.name || c.key);

      let csvText = headers.map(neutralizeCell).join(",") + "\n";
      for (const r of rows) {
        const line = headers.map((h) => {
          const val = r.data ? r.data[h] : "";
          return neutralizeCell(val);
        });
        csvText += line.join(",") + "\n";
      }

      return new Response(csvText, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${table.name}.csv"`,
        },
      });
    }

    // 2. Paged and searchable rows
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
    const offset = (page - 1) * limit;
    const search = (url.searchParams.get("search") || "").trim();

    let query = `SELECT id, data, search_text FROM wa_data_rows WHERE table_id = $1 AND tenant_id = $2`;
    const params: any[] = [tableId, tenantId];

    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      query += ` AND search_text ILIKE $${params.length}`;
    }

    const countRes = await one<{ count: number }>(
      `SELECT count(*)::int AS count FROM wa_data_rows WHERE table_id = $1 AND tenant_id = $2 ${
        search ? `AND search_text ILIKE '%${search.toLowerCase()}%'` : ""
      }`,
      [tableId, tenantId]
    );

    query += ` ORDER BY id ASC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const rows = await q(query, params);

    return Response.json({
      ok: true,
      table,
      rows,
      pagination: {
        page,
        limit,
        total: countRes?.count ?? 0,
        totalPages: Math.ceil((countRes?.count ?? 0) / limit),
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  try {
    const { tenantId } = await requireOwner(req);
    const { id } = await ctx.params;
    const tableId = Number(id);

    const existing = await one(
      `SELECT id FROM wa_data_tables WHERE id = $1 AND tenant_id = $2`,
      [tableId, tenantId]
    );
    if (!existing) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const body = await req.json();
    const updates: string[] = [];
    const params: any[] = [tableId, tenantId];

    if (body.title !== undefined) {
      params.push(String(body.title).trim());
      updates.push(`title = $${params.length}`);
    }

    if (body.description !== undefined) {
      const desc = String(body.description).trim();
      if (!desc) {
        return Response.json({ ok: false, error: "Description cannot be empty." }, { status: 400 });
      }
      params.push(desc);
      updates.push(`description = $${params.length}`);
    }

    if (body.active !== undefined) {
      params.push(Boolean(body.active));
      updates.push(`active = $${params.length}`);
    }

    if (updates.length === 0) {
      return Response.json({ ok: true, message: "no_changes" });
    }

    updates.push("updated_at = now()");

    const updated = await one(
      `UPDATE wa_data_tables
          SET ${updates.join(", ")}
        WHERE id = $1 AND tenant_id = $2
        RETURNING *`,
      params
    );

    return Response.json({ ok: true, table: updated });
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
    const tableId = Number(id);

    const deleted = await one(
      `DELETE FROM wa_data_tables WHERE id = $1 AND tenant_id = $2 RETURNING id`,
      [tableId, tenantId]
    );

    if (!deleted) {
      return Response.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    return Response.json({ ok: true, deletedId: tableId });
  } catch (e) {
    return errorResponse(e);
  }
}
