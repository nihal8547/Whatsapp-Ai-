"use client";

import { useState } from "react";

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
      className={`bg-panel border border-line rounded-lg ${pad ? "p-5" : ""} ${className}`}
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
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {lead && <p className="text-ink-soft mt-1 max-w-prose">{lead}</p>}
      </div>
      {action}
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
    primary: "bg-pine text-white hover:bg-pine-deep disabled:bg-ink-faint",
    quiet: "bg-transparent text-ink border border-line hover:bg-canvas",
    danger: "bg-transparent text-brick border border-line hover:bg-canvas",
  }[variant];
  return (
    <button
      {...rest}
      className={`px-3.5 py-2 rounded-md text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles} ${className}`}
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
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint && <span className="block text-xs text-ink-soft mt-0.5">{hint}</span>}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export const inputClass =
  "w-full rounded-md border border-line bg-panel px-3 py-2 text-sm placeholder:text-ink-faint focus:border-pine focus:outline-none";

export function Tag({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "good" | "warn" | "bad";
  children: React.ReactNode;
}) {
  const styles = {
    neutral: "bg-canvas text-ink-soft",
    good: "bg-pine-wash text-pine-deep",
    warn: "bg-amber-wash text-amber",
    bad: "bg-[#f8ebe9] text-brick",
  }[tone];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${styles}`}>
      {children}
    </span>
  );
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="text-center py-14 px-6">
      <p className="font-medium">{title}</p>
      {children && <div className="text-sm text-ink-soft mt-1.5">{children}</div>}
    </div>
  );
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-ink text-white text-sm px-4 py-2.5 rounded-md shadow-lg z-50">
      {message}
    </div>
  );
}

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  function show(text: string) {
    setMessage(text);
    setTimeout(() => setMessage(null), 3200);
  }
  return { message, show };
}
