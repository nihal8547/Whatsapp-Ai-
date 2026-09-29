"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

type Session = {
  name: string;
  email: string;
  superAdmin: boolean;
  role: string;
  hasOwnTenant: boolean;
};

const NAV_ITEMS = [
  { href: "/admin", label: "Workspaces", icon: "🏢" },
  { href: "/admin#overview", label: "Overview & Stats", icon: "📊" },
  { href: "/admin#plans", label: "Plans & Pricing", icon: "🏷️" },
  { href: "/admin#settings", label: "Platform Settings", icon: "⚙️" },
  { href: "/media", label: "Media Library", icon: "🖼️" },
];

export default function AdminSidebar({ session }: { session: Session }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const isTenantDetail = path.startsWith("/admin/tenants/");

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* ── Mobile top bar ── */}
      <div className="lg:hidden flex items-center justify-between px-4 h-14 border-b border-line bg-panel sticky top-0 z-30">
        <div className="flex items-center gap-2">
          <span className="w-7 h-7 rounded-md bg-pine text-white flex items-center justify-center font-bold text-sm">
            W
          </span>
          <span className="font-semibold text-sm">Webbea Admin</span>
        </div>
        <button
          onClick={() => setOpen(!open)}
          className="text-sm text-ink-soft px-2.5 py-1 rounded border border-line bg-canvas hover:text-ink"
        >
          {open ? "Close" : "Menu"}
        </button>
      </div>

      {/* ── Main Sidebar ── */}
      <nav
        className={`${
          open ? "block" : "hidden"
        } lg:flex lg:flex-col justify-between border-r border-line bg-panel lg:sticky lg:top-0 lg:h-screen overflow-y-auto z-20`}
      >
        <div>
          {/* ── Brand Header ── */}
          <div className="p-5 border-b border-line">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-pine text-white flex items-center justify-center font-bold text-base shadow-xs">
                W
              </span>
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-tight text-ink truncate">
                  Webbea Platform
                </p>
                <span className="inline-block mt-1 text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-pine-wash text-pine-deep">
                  Super Admin
                </span>
              </div>
            </div>

            {session.hasOwnTenant && (
              <Link
                href="/desk"
                onClick={() => setOpen(false)}
                className="mt-3 flex items-center justify-center gap-1.5 w-full py-1.5 px-3 rounded-md text-xs font-medium text-pine bg-pine-wash/50 hover:bg-pine-wash border border-pine/20 transition-colors"
              >
                <span>← Switch to Desk</span>
              </Link>
            )}
          </div>

          {/* ── Navigation Links ── */}
          <div className="p-3 space-y-1">
            <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
              Management
            </p>

            {NAV_ITEMS.map((item) => {
              const active =
                !isTenantDetail &&
                (item.href === "/admin"
                  ? path === "/admin"
                  : path === item.href || (path.startsWith(item.href) && item.href !== "/admin"));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors ${
                    active
                      ? "bg-pine-wash text-pine-deep font-medium"
                      : "text-ink-soft hover:bg-canvas hover:text-ink"
                  }`}
                >
                  <span className="text-base" aria-hidden>{item.icon}</span>
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {isTenantDetail && (
              <div className="mt-4 pt-3 border-t border-line/60">
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                  Active Context
                </p>
                <div className="px-3 py-2 rounded-md bg-canvas/80 border border-line text-xs space-y-1">
                  <p className="font-medium text-ink">Workspace Detail</p>
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    className="inline-block text-pine hover:underline text-xs"
                  >
                    ← All workspaces
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Bottom Section ── */}
        <div>
          <div className="px-5 py-3 border-t border-line text-xs text-ink-soft space-y-1.5">
            <div className="flex items-center justify-between">
              <span>Status</span>
              <span className="font-medium text-pine flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-pine inline-block" /> Live
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Environment</span>
              <span className="text-ink font-mono text-[11px]">Production</span>
            </div>
          </div>

          <div className="px-5 py-4 border-t border-line bg-canvas/30">
            <p className="text-sm font-medium text-ink truncate">{session.name}</p>
            <p className="text-xs text-ink-soft truncate">{session.email}</p>
            <button
              onClick={logout}
              className="text-xs text-brick hover:underline mt-2.5 flex items-center gap-1 font-medium"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}
