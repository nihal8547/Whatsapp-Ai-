"use client";

import { useState, useCallback } from "react";

export function Panel({
  children,
  className = "",
  pad = true,
}: {
  children: React.ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section
      className={`bg-panel border border-line/80 shadow-2xs hover:shadow-xs rounded-xl transition-all duration-150 ${
        pad ? "p-5 sm:p-6" : ""
      } ${className}`}
    >
      {children}
    </section>
  );
}

export function PageHead({
  title,
  lead,
  action,
}: {
  title: string;
  lead?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-7">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-ink">{title}</h1>
        {lead && <p className="text-sm text-ink-soft mt-1 max-w-prose leading-relaxed">{lead}</p>}
      </div>
      {action && <div className="shrink-0 flex items-center gap-2">{action}</div>}
    </div>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "quiet" | "danger";
}) {
  const styles = {
    primary:
      "bg-pine text-white hover:bg-pine-deep shadow-2xs hover:shadow-xs active:scale-[0.98] disabled:opacity-50 disabled:hover:bg-pine",
    quiet:
      "bg-panel text-ink border border-line hover:border-slate-300 hover:bg-canvas/80 active:scale-[0.98] shadow-2xs",
    danger:
      "bg-brick/10 text-brick border border-brick/20 hover:bg-brick hover:text-white active:scale-[0.98] shadow-2xs",
  }[variant];

  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed select-none ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs sm:text-sm font-semibold text-ink">{label}</span>
      </div>
      {children}
      {hint && <span className="block text-xs text-ink-faint leading-normal">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full rounded-lg border border-line bg-panel px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-pine focus:ring-2 focus:ring-pine/15 focus:outline-none transition-all shadow-2xs";

export function Tag({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warn" | "bad";
  children: React.ReactNode;
}) {
  const styles = {
    neutral: "bg-canvas text-ink-soft border border-line/60",
    good: "bg-pine-wash text-pine-deep border border-pine/20",
    warn: "bg-amber-wash text-amber border border-amber/20",
    bad: "bg-brick-wash text-brick border border-brick/20",
  }[tone];

  const dotStyles = {
    neutral: "bg-ink-faint",
    good: "bg-pine",
    warn: "bg-amber",
    bad: "bg-brick",
  }[tone];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide ${styles}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotStyles}`} aria-hidden />
      <span>{children}</span>
    </span>
  );
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
}: {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  trend?: { label: string; tone?: "good" | "warn" | "neutral" };
}) {
  return (
    <div className="bg-panel border border-line/80 rounded-xl p-5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between">
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-soft">{title}</span>
        {icon && (
          <span className="w-8 h-8 rounded-lg bg-canvas flex items-center justify-center text-ink-soft shrink-0 border border-line/60">
            {icon}
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl sm:text-3xl font-bold tracking-tight text-ink tabular">{value}</div>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {subtitle && <p className="text-xs text-ink-faint">{subtitle}</p>}
          {trend && (
            <span
              className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${
                trend.tone === "good"
                  ? "bg-pine-wash text-pine-deep"
                  : trend.tone === "warn"
                  ? "bg-amber-wash text-amber"
                  : "bg-canvas text-ink-soft"
              }`}
            >
              {trend.label}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function Avatar({
  name,
  size = "md",
}: {
  name?: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const initials = (name || "U")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const sizeClasses = {
    sm: "w-6 h-6 text-[10px]",
    md: "w-8 h-8 text-xs font-semibold",
    lg: "w-10 h-10 text-sm font-bold",
  }[size];

  return (
    <div
      className={`${sizeClasses} rounded-full bg-pine-wash text-pine-deep border border-pine/20 flex items-center justify-center shrink-0 select-none font-mono`}
    >
      {initials}
    </div>
  );
}

export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="text-center py-16 px-6 max-w-md mx-auto">
      <div className="w-12 h-12 rounded-2xl bg-canvas border border-line flex items-center justify-center mx-auto mb-3.5 text-ink-faint">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="10" />
          <line x1="8" y1="12" x2="16" y2="12" />
        </svg>
      </div>
      <p className="font-semibold text-base text-ink">{title}</p>
      {children && <div className="text-xs sm:text-sm text-ink-soft mt-1.5 leading-relaxed">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink text-white text-xs sm:text-sm font-medium px-4 py-2.5 rounded-lg shadow-xl border border-white/10 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150">
      {message}
    </div>
  );
}

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const show = useCallback((text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(null), 3200);
  }, []);
  return { message, show };
}

