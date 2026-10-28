"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import NotificationsBell from "@/components/notifications-bell";

export type NavItem = {
  href: string;
  labelKey?: string;
  defaultLabel: string;
  module?: string;
  pageExists: boolean;
  icon?: (props: { className?: string }) => React.ReactNode;
};

export type NavCategory = {
  id: string;
  name: string;
  icon: (props: { className?: string }) => React.ReactNode;
  items: NavItem[];
};

export const NAV_CATEGORIES: NavCategory[] = [
  {
    id: "inbox",
    name: "Overview & Inbox",
    icon: ({ className = "w-4 h-4" }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 12h-6l-2 3h-4l-2-3H2v7a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-7z" />
        <path d="M5.45 5.11L2 12v0a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v0l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
    ),
    items: [
      {
        href: "/desk",
        defaultLabel: "Today",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ),
      },
      {
        href: "/chats",
        defaultLabel: "Chats",
        labelKey: "chats",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ),
      },
    ],
  },
  {
    id: "operations",
    name: "Operations & Sales",
    icon: ({ className = "w-4 h-4" }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="9" cy="21" r="1" />
        <circle cx="20" cy="21" r="1" />
        <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
      </svg>
    ),
    items: [
      {
        href: "/orders",
        defaultLabel: "Orders",
        labelKey: "orders",
        module: "orders",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
        ),
      },
      {
        href: "/catalog",
        defaultLabel: "Catalog",
        labelKey: "catalog",
        module: "catalog",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        ),
      },
      {
        href: "/appointments",
        defaultLabel: "Appointments",
        labelKey: "appointments",
        module: "appointments",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        ),
      },
      {
        href: "/services",
        defaultLabel: "Services & hours",
        labelKey: "services",
        module: "appointments",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        ),
      },
      // Modules not built yet:
      { href: "/stays", defaultLabel: "Stays", module: "stays", pageExists: false },
      { href: "/resources", defaultLabel: "Resources", labelKey: "resources", module: "resources", pageExists: false },
    ],
  },
  {
    id: "marketing",
    name: "Marketing & CRM",
    icon: ({ className = "w-4 h-4" }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    items: [
      {
        href: "/leads",
        defaultLabel: "Leads",
        labelKey: "leads",
        module: "leads",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
        ),
      },
      {
        href: "/contacts",
        defaultLabel: "Contacts",
        labelKey: "customers",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        ),
      },
      {
        href: "/followups",
        defaultLabel: "Next Follow-ups",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        ),
      },
      {
        href: "/broadcasts",
        defaultLabel: "Broadcasts",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9" />
            <path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5" />
            <circle cx="12" cy="12" r="2" />
            <path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5" />
            <path d="M19.1 4.9C23 8.8 23 15.1 19.1 19" />
          </svg>
        ),
      },
      {
        href: "/ads",
        defaultLabel: "Ad Playbooks",
        module: "ads",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        ),
      },
    ],
  },
  {
    id: "ai",
    name: "AI & Knowledge",
    icon: ({ className = "w-4 h-4" }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
    items: [
      {
        href: "/assistant",
        defaultLabel: "AI Assistant",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="2" />
            <path d="M12 7v4" />
            <line x1="8" y1="16" x2="8" y2="16" />
            <line x1="16" y1="16" x2="16" y2="16" />
          </svg>
        ),
      },
      {
        href: "/faqs",
        defaultLabel: "FAQ Knowledge",
        labelKey: "faqs",
        module: "faq",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        ),
      },
      {
        href: "/media",
        defaultLabel: "Media Library",
        module: "media",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        ),
      },
      {
        href: "/data",
        defaultLabel: "Data Files",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
          </svg>
        ),
      },
      {
        href: "/analytics",
        defaultLabel: "Analytics",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
        ),
      },
    ],
  },
  {
    id: "settings",
    name: "Settings & System",
    icon: ({ className = "w-4 h-4" }) => (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
    items: [
      {
        href: "/whatsapp",
        defaultLabel: "WhatsApp Number",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        ),
      },
      {
        href: "/safety",
        defaultLabel: "Safety & Limits",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        ),
      },
      {
        href: "/integrations",
        defaultLabel: "Integrations & API",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        ),
      },
      {
        href: "/team",
        defaultLabel: "Team Members",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
        ),
      },
      {
        href: "/settings",
        defaultLabel: "General Settings",
        pageExists: true,
        icon: ({ className = "w-4 h-4" }) => (
          <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
        ),
      },
    ],
  },
];

// Flat export maintained for backward compatibility
export const NAV_REGISTRY: NavItem[] = NAV_CATEGORIES.flatMap((c) => c.items);

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
    safetyWarning?: boolean;
  };
  modules?: string[];
  labels?: Record<string, string>;
};

export default function Sidebar({ session, tenant, modules = [], labels = {} }: Props) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // Collapsed categories state (keyed by category ID)
  // false = open (expanded), true = closed (collapsed)
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("wa_sidebar_collapsed_categories");
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return {};
  });

  const connected = tenant.waStatus === "connected";
  const trialDays = tenant.trialEndsAt
    ? Math.ceil((new Date(tenant.trialEndsAt).getTime() - Date.now()) / 86400000)
    : null;

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const isItemVisible = (item: NavItem) => {
    if (!item.pageExists) return false;
    if (item.href === "/broadcasts" && session.role === "staff" && !session.superAdmin) return false;
    if (item.href === "/data" && session.role !== "owner" && !session.superAdmin) return false;
    if (item.href === "/integrations" && session.role !== "owner" && !session.superAdmin) return false;
    if (!item.module) return true;
    return modules.includes(item.module);
  };

  const isItemActive = (href: string) => {
    return path === href || path.startsWith(href + "/");
  };

  const toggleCategory = (id: string) => {
    setCollapsedCategories((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      try {
        localStorage.setItem("wa_sidebar_collapsed_categories", JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Build visible categories
  const categoriesWithVisibleItems = NAV_CATEGORIES.map((cat) => {
    const visibleItems = cat.items.filter(isItemVisible);
    const hasActive = visibleItems.some((item) => isItemActive(item.href));
    return {
      ...cat,
      visibleItems,
      hasActive,
    };
  }).filter((cat) => cat.visibleItems.length > 0);

  // Auto-expand any category containing the current active path if user hasn't explicitly collapsed it
  useEffect(() => {
    const activeCat = categoriesWithVisibleItems.find((cat) => cat.hasActive);
    if (activeCat && collapsedCategories[activeCat.id] === true) {
      setCollapsedCategories((prev) => {
        const next = { ...prev, [activeCat.id]: false };
        try {
          localStorage.setItem("wa_sidebar_collapsed_categories", JSON.stringify(next));
        } catch {}
        return next;
      });
    }
  }, [path]);

  const toggleAll = (collapseAll: boolean) => {
    const next: Record<string, boolean> = {};
    categoriesWithVisibleItems.forEach((c) => {
      next[c.id] = collapseAll;
    });
    setCollapsedCategories(next);
    try {
      localStorage.setItem("wa_sidebar_collapsed_categories", JSON.stringify(next));
    } catch {}
  };

  const allCollapsed = categoriesWithVisibleItems.every((c) => collapsedCategories[c.id]);

  return (
    <>
      {/* Mobile Top Header */}
      <div className="lg:hidden flex items-center justify-between px-4 h-14 border-b border-line bg-panel sticky top-0 z-30 shadow-2xs">
        <span className="font-semibold text-ink truncate text-sm">{tenant.name}</span>
        <div className="flex items-center gap-2">
          <NotificationsBell />
          <button
            onClick={() => setOpen(!open)}
            className="text-xs font-medium text-ink bg-canvas px-2.5 py-1.5 rounded border border-line"
          >
            {open ? "Close" : "Menu ☰"}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs z-30 lg:hidden animate-in fade-in duration-150"
        />
      )}

      {/* Main Sidebar */}
      <nav
        className={`${
          open ? "fixed inset-y-0 left-0 z-40 w-64 shadow-xl" : "hidden"
        } lg:flex lg:static lg:z-auto lg:w-auto lg:shadow-none flex flex-col h-full lg:h-screen lg:max-h-screen border-r border-line bg-panel select-none overflow-hidden`}
      >
        {/* Tenant Brand Header (Fixed Top) */}
        <div className="shrink-0 p-4 border-b border-line/60 bg-canvas/30">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1 pr-2">
              <p className="font-semibold text-sm leading-tight text-ink truncate">{tenant.name}</p>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-pine" />
                <p className="text-[11px] font-medium text-ink-soft truncate">{tenant.plan}</p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => toggleAll(!allCollapsed)}
                className="text-[10px] text-ink-faint hover:text-pine px-1.5 py-0.5 rounded border border-line/70 hover:border-pine/40 transition-colors"
                title={allCollapsed ? "Expand all categories" : "Collapse all categories"}
              >
                {allCollapsed ? "Expand" : "Collapse"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="lg:hidden text-ink-faint hover:text-ink p-1 text-xs"
                title="Close navigation"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable Category Dropdown Accordion List (Scrolls independently in the middle) */}
        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2">
          {categoriesWithVisibleItems.map((cat) => {
            const isCollapsed = collapsedCategories[cat.id] === true;
            const CategoryIcon = cat.icon;

            return (
              <div key={cat.id} className="space-y-1">
                {/* Category Header Button (Dropdown trigger) */}
                <button
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  className={`w-full group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-colors ${
                    cat.hasActive
                      ? "text-pine font-bold bg-pine-wash/40"
                      : "text-ink-soft hover:text-ink hover:bg-canvas/70"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`transition-colors shrink-0 ${
                        cat.hasActive ? "text-pine" : "text-ink-faint group-hover:text-ink-soft"
                      }`}
                    >
                      <CategoryIcon className="w-3.5 h-3.5" />
                    </span>
                    <span className="truncate uppercase text-[11px] tracking-wider">{cat.name}</span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-1">
                    {/* Sub-item count badge */}
                    <span
                      className={`text-[10px] font-mono px-1 py-0.2 rounded ${
                        cat.hasActive
                          ? "bg-pine/15 text-pine font-bold"
                          : "bg-canvas text-ink-faint border border-line/60"
                      }`}
                    >
                      {cat.visibleItems.length}
                    </span>

                    {/* Dropdown chevron */}
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`text-ink-faint group-hover:text-ink transition-transform duration-200 ${
                        isCollapsed ? "-rotate-90" : "rotate-0"
                      }`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                </button>

                {/* Category Sub-items Dropdown Menu */}
                {!isCollapsed && (
                  <div className="space-y-0.5 ml-2 pl-2 border-l border-line/60 animate-in fade-in slide-in-from-top-1 duration-150">
                    {cat.visibleItems.map((l) => {
                      const active = isItemActive(l.href);
                      const ItemIcon = l.icon;

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
                          className={`group flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-all ${
                            active
                              ? "bg-pine-wash text-pine-deep font-semibold shadow-2xs border-l-2 border-pine pl-2"
                              : "text-ink-soft hover:text-ink hover:bg-canvas"
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {ItemIcon && (
                              <span
                                className={`shrink-0 transition-colors ${
                                  active ? "text-pine" : "text-ink-faint group-hover:text-ink-soft"
                                }`}
                              >
                                <ItemIcon className="w-3.5 h-3.5" />
                              </span>
                            )}
                            <span className="truncate">{labelText}</span>
                          </div>

                          {/* Safety warning indicator */}
                          {l.href === "/safety" && tenant.safetyWarning && (
                            <span
                              className="w-2 h-2 rounded-full bg-amber shrink-0 animate-pulse ml-1"
                              title="Safety warning: WhatsApp disconnected or automatic messages paused"
                            />
                          )}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer (Permanently Fixed and Anchored at Bottom) */}
        <div className="shrink-0 border-t border-line bg-panel">
          {/* Status and Usage indicators */}
          <div className="px-4 py-3 space-y-2.5 bg-canvas/20">
            <Link href="/whatsapp" className="flex items-center gap-2 text-xs hover:text-pine transition-colors">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${connected ? "bg-pine animate-pulse" : "bg-amber"}`}
                aria-hidden
              />
              <span className={connected ? "text-ink font-medium" : "text-amber font-medium"}>
                {connected ? "WhatsApp connected" : "Connect WhatsApp"}
              </span>
            </Link>

            {tenant.replyLimit !== null && (
              <div>
                <div className="flex justify-between text-[11px] text-ink-soft mb-1">
                  <span>AI replies</span>
                  <span className="tabular font-mono">
                    {tenant.repliesUsed}/{tenant.replyLimit}
                  </span>
                </div>
                <div className="h-1 bg-line/80 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-pine transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (tenant.repliesUsed / tenant.replyLimit) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {tenant.status === "trial" && trialDays !== null && (
              <p className="text-[11px] text-amber font-medium">
                {trialDays > 0 ? `Trial ends in ${trialDays} days` : "Trial has ended"}
              </p>
            )}
          </div>

          {/* User Profile & Sign Out */}
          <div className="px-4 py-3 border-t border-line flex items-center justify-between gap-2 bg-panel">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-ink truncate leading-tight">{session.name}</p>
              <p className="text-[11px] text-ink-faint truncate">{session.email}</p>
            </div>
            <button
              onClick={logout}
              className="text-xs font-medium text-ink-soft hover:text-brick px-2 py-1 rounded hover:bg-canvas transition-colors shrink-0"
              title="Sign out of workspace"
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}

