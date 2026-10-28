"use client";

import Link from "next/link";
import NotificationsBell from "@/components/notifications-bell";

interface TopbarProps {
  tenant: {
    name: string;
    waStatus: string | null;
    repliesUsed: number;
    replyLimit: number | null;
    safetyWarning: boolean;
  };
}

export default function Topbar({ tenant }: TopbarProps) {
  const isConnected = tenant.waStatus === "connected";
  const quotaPercentage = tenant.replyLimit
    ? Math.min(100, Math.round((tenant.repliesUsed / tenant.replyLimit) * 100))
    : null;

  return (
    <header className="hidden lg:flex shrink-0 items-center justify-between px-6 h-14 border-b border-line bg-panel/70 backdrop-blur-md z-20 select-none">
      {/* Left: Workspace indicator & WhatsApp Live status */}
      <div className="flex items-center gap-3">
        <span className="text-xs font-semibold text-ink-soft bg-canvas px-2.5 py-1 rounded-md border border-line/60">
          {tenant.name}
        </span>

        <Link
          href="/whatsapp"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
            isConnected
              ? "bg-pine-wash text-pine-deep hover:bg-pine-wash/80 border border-pine/20"
              : "bg-amber-wash text-amber hover:bg-amber-wash/80 border border-amber/20"
          }`}
          title={isConnected ? "WhatsApp instance is active and connected" : "WhatsApp is disconnected. Click to reconnect."}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              isConnected ? "bg-pine animate-pulse" : "bg-amber"
            }`}
          />
          <span>{isConnected ? "WhatsApp Active" : "Connect WhatsApp"}</span>
        </Link>
      </div>

      {/* Right: Usage Quota, Docs link & Notifications */}
      <div className="flex items-center gap-4">
        {tenant.replyLimit !== null && (
          <div className="hidden xl:flex items-center gap-2.5 px-3 py-1 rounded-lg bg-canvas/60 border border-line/60 text-xs text-ink-soft">
            <span className="text-[11px] font-medium text-ink-faint">AI Replies:</span>
            <span className="font-mono tabular font-semibold text-ink">
              {tenant.repliesUsed}/{tenant.replyLimit}
            </span>
            <div className="w-16 h-1.5 bg-line/80 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  (quotaPercentage ?? 0) > 85 ? "bg-amber" : "bg-pine"
                }`}
                style={{ width: `${quotaPercentage}%` }}
              />
            </div>
          </div>
        )}

        <Link
          href="/integrations"
          className="text-xs font-medium text-ink-soft hover:text-pine px-2 py-1 rounded hover:bg-canvas transition-colors"
        >
          API & Integrations
        </Link>

        <div className="h-4 w-px bg-line" />

        <NotificationsBell />
      </div>
    </header>
  );
}
