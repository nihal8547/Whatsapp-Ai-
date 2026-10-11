import { requireTenant } from "@/lib/auth";
import { q } from "@/lib/db";
import { getTenantConfig } from "@/lib/packs";
import FaqsEditor from "./editor";

export const dynamic = "force-dynamic";

export default async function FaqsPage() {
  const { tenantId, session } = await requireTenant();
  const config = await getTenantConfig(tenantId);

  const faqs = await q(
    `SELECT id, question, answer, keywords, sort_order, active, created_at
       FROM wa_faqs
      WHERE tenant_id = $1
      ORDER BY sort_order ASC, id ASC`,
    [tenantId]
  );

  return (
    <FaqsEditor
      initialFaqs={faqs}
      readOnly={session.role === "staff" && !session.superAdmin}
      labels={config.labels}
    />
  );
}
