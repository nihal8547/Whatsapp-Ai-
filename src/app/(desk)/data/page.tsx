import { redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { q } from "@/lib/db";
import DataClient from "./data-client";

export const dynamic = "force-dynamic";

export default async function DataPage() {
  let ctx;
  try {
    ctx = await requireOwner();
  } catch {
    redirect("/desk");
  }

  const { tenantId, session } = ctx;

  // 1. Fetch existing knowledge tables
  const tables = await q(
    `SELECT id, name, title, description, columns, row_count, active, created_at, updated_at
       FROM wa_data_tables
      WHERE tenant_id = $1
      ORDER BY created_at DESC`,
    [tenantId]
  );

  // 2. Fetch upload history
  const uploads = await q(
    `SELECT u.id, u.kind, u.filename, u.total_rows, u.imported_rows, u.rejected_rows,
            u.column_map, u.target_table_id, u.created_at, tu.full_name AS uploaded_by_name
       FROM wa_csv_uploads u
       LEFT JOIN wa_tenant_users tu ON tu.id = u.uploaded_by
      WHERE u.tenant_id = $1
      ORDER BY u.created_at DESC LIMIT 50`,
    [tenantId]
  );

  // 3. Count contacts with custom fields
  const customFieldsStat = await q<{ count: number }>(
    `SELECT count(*)::int AS count
       FROM wa_contacts
      WHERE tenant_id = $1
        AND attributes IS NOT NULL
        AND attributes != '{}'::jsonb`,
    [tenantId]
  );
  const contactsWithFields = customFieldsStat[0]?.count ?? 0;

  return (
    <DataClient
      initialTables={tables}
      initialUploads={uploads}
      contactsWithFieldsCount={contactsWithFields}
      userName={session.name}
    />
  );
}
