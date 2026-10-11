import { requireTenant } from "@/lib/auth";
import { q } from "@/lib/db";
import { getTenantConfig } from "@/lib/packs";
import SettingsEditor from "./editor";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { tenantId, session } = await requireTenant();
  const config = await getTenantConfig(tenantId);

  const packs = await q(
    `SELECT code, name, modules, labels, persona_rules, version
       FROM wa_business_packs
      WHERE active = true
      ORDER BY name ASC`
  );

  return (
    <SettingsEditor
      tenantId={tenantId}
      isOwner={session.role === "owner" || session.superAdmin}
      currentPack={config.pack}
      activeModules={config.modules}
      labels={config.labels}
      availablePacks={packs}
    />
  );
}
