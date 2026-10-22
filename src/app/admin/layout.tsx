import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { one } from "@/lib/db";
import AdminSidebar from "@/components/admin-sidebar";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.superAdmin) redirect("/desk");

  const dbUser = await one<{ is_super_admin: boolean }>(
    `SELECT is_super_admin FROM wa_tenant_users WHERE id = $1 AND lower(email) = lower($2)`,
    [session.userId, session.email]
  );
  if (!dbUser?.is_super_admin) {
    redirect("/desk");
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <AdminSidebar
        session={{
          name: session.name,
          email: session.email,
          superAdmin: session.superAdmin,
          role: session.role,
          hasOwnTenant: !!session.tenantId,
        }}
      />
      <main className="min-w-0 bg-canvas">{children}</main>
    </div>
  );
}
