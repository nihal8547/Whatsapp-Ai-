import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { q } from "@/lib/db";
import BusinessPacksManager from "@/app/admin/packs/packs-client";

export const dynamic = "force-dynamic";

export default async function AdminPacksPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.superAdmin) redirect("/desk");

  const packs = await q<{
    code: string;
    name: string;
    modules: any;
    labels: any;
    active: boolean;
    tenant_count: number;
  }>(`
    SELECT p.code, p.name, p.modules, p.labels, p.active,
           (SELECT count(*) FROM wa_tenants t WHERE t.pack_code = p.code)::int AS tenant_count
      FROM wa_business_packs p
     ORDER BY p.name ASC
  `);

  return <BusinessPacksManager initialPacks={packs} />;
}
