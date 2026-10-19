import { requireTenant, requireOwner, errorResponse } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { MAX_KNOWLEDGE_TABLES, slugifyTableName } from "@/lib/csv-data";

export async function GET(req: Request) {
  try {
    const { tenantId } = await requireTenant(req);

    const tables = await q(
      `SELECT id, name, title, description, columns, row_count, active, created_at, updated_at
         FROM wa_data_tables
        WHERE tenant_id = $1
        ORDER BY created_at DESC`,
      [tenantId]
    );

    const uploads = await q(
      `SELECT u.id, u.kind, u.filename, u.total_rows, u.imported_rows, u.rejected_rows,
              u.target_table_id, u.created_at, tu.full_name AS uploaded_by_name
         FROM wa_csv_uploads u
         LEFT JOIN wa_tenant_users tu ON tu.id = u.uploaded_by
        WHERE u.tenant_id = $1
        ORDER BY u.created_at DESC LIMIT 50`,
      [tenantId]
    );

    return Response.json({ ok: true, tables, uploads });
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const { tenantId } = await requireOwner(req);
    const body = await req.json();

    const countRes = await one<{ count: number }>(
      `SELECT count(*)::int AS count FROM wa_data_tables WHERE tenant_id = $1`,
      [tenantId]
    );
    if ((countRes?.count ?? 0) >= MAX_KNOWLEDGE_TABLES) {
      return Response.json(
        { ok: false, error: `Maximum of ${MAX_KNOWLEDGE_TABLES} knowledge tables reached.` },
        { status: 400 }
      );
    }

    const rawName = String(body.name ?? "").trim();
    const name = slugifyTableName(rawName);
    const title = String(body.title ?? "").trim() || name;
    const description = String(body.description ?? "").trim();

    if (!description) {
      return Response.json(
        { ok: false, error: "Description ('When should the assistant use this?') is required." },
        { status: 400 }
      );
    }

    const columns = body.columns || [];

    const newTable = await one(
      `INSERT INTO wa_data_tables (tenant_id, name, title, description, columns, row_count, active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, 0, true, now(), now())
       RETURNING *`,
      [tenantId, name, title, description, JSON.stringify(columns)]
    );

    return Response.json({ ok: true, table: newTable }, { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
