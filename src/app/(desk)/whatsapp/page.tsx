import { requireTenant } from "@/lib/auth";
import WhatsAppConnect from "./connect";

export const dynamic = "force-dynamic";

export default async function WhatsAppPage() {
  const { session } = await requireTenant();
  return <WhatsAppConnect readOnly={session.role === "staff" && !session.superAdmin} />;
}
