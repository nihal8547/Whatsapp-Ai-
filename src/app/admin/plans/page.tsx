import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { q } from "@/lib/db";
import PlansManager from "@/app/admin/plans/plans-client";

export const dynamic = "force-dynamic";

export default async function AdminPlansPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.superAdmin) redirect("/desk");

  const plans = await q(
    `SELECT id, code, name, price_qar, monthly_reply_limit, active FROM wa_plans ORDER BY active DESC, id`
  );

  return <PlansManager initialPlans={plans} />;
}
