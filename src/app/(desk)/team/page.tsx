import { requireTenant } from "@/lib/auth";
import { q } from "@/lib/db";
import TeamList from "./list";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const { tenantId, session } = await requireTenant();
  const members = await q(
    `SELECT id, email, COALESCE(full_name,'') AS full_name, role, created_at
       FROM wa_tenant_users WHERE tenant_id = $1 ORDER BY id`,
    [tenantId]
  );
  return (
    <TeamList
      initial={members}
      meId={session.userId}
      readOnly={session.role === "staff" && !session.superAdmin}
    />
  );
}
