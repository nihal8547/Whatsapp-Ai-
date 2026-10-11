import { requireTenant } from "@/lib/auth";
import AnalyticsClient from "./client";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requireTenant();
  return <AnalyticsClient />;
}
