import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import ImportClient from "./import-client";

export const dynamic = "force-dynamic";

export default async function ContactsImportPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const isOwner = session.role === "owner" || session.superAdmin;
  if (!isOwner) {
    redirect("/contacts");
  }

  return <ImportClient />;
}
