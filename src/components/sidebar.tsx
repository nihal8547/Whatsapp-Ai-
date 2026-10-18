"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import NotificationsBell from "@/components/notifications-bell";


export type NavItem = {
  href: string;
  labelKey?: string;
  defaultLabel: string;
  module?: string;
  pageExists: boolean;
};

export const NAV_REGISTRY: NavItem[] = [
  { href: "/desk", defaultLabel: "Today", pageExists: true },
  { href: "/chats", defaultLabel: "Chats", labelKey: "chats", pageExists: true },
  { href: "/appointments", defaultLabel: "Appointments", labelKey: "appointments", module: "appointments", pageExists: true },
  { href: "/contacts", defaultLabel: "Contacts", labelKey: "customers", pageExists: true },
  { href: "/broadcasts", defaultLabel: "Broadcasts", pageExists: true },
  { href: "/faqs", defaultLabel: "FAQ", labelKey: "faqs", module: "faq", pageExists: true },
  { href: "/analytics", defaultLabel: "Analytics", pageExists: true },
  { href: "/services", defaultLabel: "Services & hours", labelKey: "services", module: "appointments", pageExists: true },
  { href: "/media", defaultLabel: "Media library", module: "media", pageExists: true },
  { href: "/assistant", defaultLabel: "Assistant", pageExists: true },
  { href: "/whatsapp", defaultLabel: "WhatsApp number", pageExists: true },
  { href: "/settings", defaultLabel: "Settings", pageExists: true },
  { href: "/team", defaultLabel: "Team", pageExists: true },
  // Active modules:
  { href: "/catalog", defaultLabel: "Catalog", labelKey: "catalog", module: "catalog", pageExists: true },
  { href: "/orders", defaultLabel: "Orders", labelKey: "orders", module: "orders", pageExists: true },
  { href: "/leads", defaultLabel: "Leads", labelKey: "leads", module: "leads", pageExists: true },
  // Modules not built yet:
  { href: "/stays", defaultLabel: "Stays", module: "stays", pageExists: false },
  { href: "/resources", defaultLabel: "Resources", labelKey: "resources", module: "resources", pageExists: false },
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
  modules?: string[];
  labels?: Record<string, string>;
};

export default function Sidebar({ session, tenant, modules = [], labels = {} }: Props) {
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

  const visibleLinks = NAV_REGISTRY.filter((item) => {
    if (!item.pageExists) return false;
    if (item.href === "/broadcasts" && session.role === "staff" && !session.superAdmin) return false;
    if (!item.module) return true;
    return modules.includes(item.module);
  });

  return (
    <>
      <div className="lg:hidden flex items-center justify-between px-4 h-14 border-b border-line bg-panel sticky top-0 z-30">
        <span className="font-semibold truncate">{tenant.name}</span>
        <div className="flex items-center gap-2">
          <NotificationsBell />
          <button onClick={() => setOpen(!open)} className="text-sm text-ink-soft px-2 py-1">
            {open ? "Close" : "Menu"}
          </button>
        </div>
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
          {visibleLinks.map((l) => {
            const active = path === l.href || path.startsWith(l.href + "/");
            let labelText = l.defaultLabel;
            if (l.href === "/services") {
              const svcLabel = labels["services"] || labels["service"] || "Services";
              labelText = `${svcLabel} & hours`;
            } else if (l.labelKey && labels[l.labelKey]) {
              labelText = labels[l.labelKey];
            }

            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`block px-3 py-2 rounded-md text-sm transition-colors ${
                  active ? "bg-pine-wash text-pine-deep font-medium" : "text-ink-soft hover:bg-canvas"
                }`}
              >
                {labelText}
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
