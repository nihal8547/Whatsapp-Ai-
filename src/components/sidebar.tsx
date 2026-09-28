"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/desk", label: "Today" },
  { href: "/chats", label: "Chats" },
  { href: "/appointments", label: "Appointments" },
  { href: "/contacts", label: "Contacts" },
  { href: "/services", label: "Services & hours" },
  { href: "/assistant", label: "Assistant" },
  { href: "/whatsapp", label: "WhatsApp number" },
  { href: "/team", label: "Team" },
];

type Props = {
  session: { name: string; email: string; superAdmin: boolean; role: string };
  tenant: {
    name: string;
    status: string;
    plan: string;
    waStatus: string | null;
    repliesUsed: number;
    replyLimit: number | null;
    trialEndsAt: string | null;
  };
};

export default function Sidebar({ session, tenant }: Props) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const connected = tenant.waStatus === "connected";
  const trialDays = tenant.trialEndsAt
    ? Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / 86400000)
    : null;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <div className="lg:hidden flex items-center justify-between px-4 h-14 border-b border-line bg-panel sticky top-0 z-30">
        <span className="font-semibold truncate">{tenant.name}</span>
        <button onClick={() => setOpen(!open)} className="text-sm text-ink-soft px-2 py-1">
          {open ? "Close" : "Menu"}
        </button>
      </div>

      <nav
        className={`${
          open ? "block" : "hidden"
        } lg:block border-r border-line bg-panel lg:sticky lg:top-0 lg:h-screen overflow-y-auto`}
      >
        <div className="p-5 hidden lg:block">
          <p className="font-semibold leading-tight truncate">{tenant.name}</p>
          <p className="text-xs text-ink-soft mt-0.5">{tenant.plan}</p>
        </div>

        <div className="px-3 pb-3 space-y-0.5">
          {LINKS.map((l) => {
            const active = path === l.href || path.startsWith(l.href + "/");
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                  active ? "bg-pine-wash text-pine-deep font-medium" : "text-ink-soft hover:bg-canvas"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          {session.superAdmin && (
            <Link
              href="/admin"
              onClick={() => setOpen(false)}
              className={`block px-3 py-2 rounded-md text-sm ${
                path.startsWith("/admin")
                  ? "bg-pine-wash text-pine-deep font-medium"
                  : "text-ink-soft hover:bg-canvas"
              }`}
            >
              All workspaces
            </Link>
          )}
        </div>

        <div className="px-5 py-4 mt-2 border-t border-line space-y-3">
          <Link href="/whatsapp" className="flex items-center gap-2 text-sm">
            <span
              className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-pine" : "bg-amber"}`}
              aria-hidden
            />
            <span className={connected ? "text-ink-soft" : "text-amber font-medium"}>
              {connected ? "WhatsApp connected" : "Connect WhatsApp"}
            </span>
          </Link>

          {tenant.replyLimit !== null && (
            <div>
              <div className="flex justify-between text-xs text-ink-soft mb-1">
                <span>AI replies this month</span>
                <span className="tabular">
                  {tenant.repliesUsed}/{tenant.replyLimit}
                </span>
              </div>
              <div className="h-1 bg-canvas rounded-full overflow-hidden">
                <div
                  className="h-full bg-pine"
                  style={{
                    width: `${Math.min(100, (tenant.repliesUsed / tenant.replyLimit) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {tenant.status === "trial" && trialDays !== null && (
            <p className="text-xs text-ink-soft">
              {trialDays > 0 ? `Trial ends in ${trialDays} days` : "Trial has ended"}
            </p>
          )}
        </div>

        <div className="px-5 py-4 border-t border-line">
          <p className="text-sm font-medium truncate">{session.name}</p>
          <p className="text-xs text-ink-soft truncate">{session.email}</p>
          <button onClick={logout} className="text-xs text-ink-soft hover:text-ink mt-2">
            Sign out
          </button>
        </div>
      </nav>
    </>
  );
}
