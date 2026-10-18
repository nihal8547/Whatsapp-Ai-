"use client";

import React, { useMemo } from "react";

export interface MemoryData {
  summary?: string;
  facts?: string[];
}

interface FactItem {
  raw: string;
  key: string;
  value: string;
  isKv: boolean;
}

type CategoryId = "profile" | "interests" | "status" | "commercial" | "notes";

interface CategoryMeta {
  id: CategoryId;
  title: string;
  icon: React.ReactNode;
  headerBg: string;
  headerBorder: string;
  headerText: string;
  badgeBg: string;
  badgeText: string;
  cardBg: string;
  cardBorder: string;
  keyText: string;
  valText: string;
}

const CATEGORIES: Record<CategoryId, CategoryMeta> = {
  profile: {
    id: "profile",
    title: "Customer & Business Profile",
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
    headerBg: "bg-blue-50/90",
    headerBorder: "border-blue-200/80",
    headerText: "text-blue-900",
    badgeBg: "bg-blue-100 text-blue-700",
    badgeText: "text-blue-700",
    cardBg: "bg-blue-50/30 hover:bg-blue-50/60",
    cardBorder: "border-blue-100 hover:border-blue-200",
    keyText: "text-blue-700",
    valText: "text-slate-800",
  },
  interests: {
    id: "interests",
    title: "Interests & Requirements",
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="m4.93 4.93 4.24 4.24" />
        <path d="m14.83 9.17 4.24-4.24" />
        <path d="m14.83 14.83 4.24 4.24" />
        <path d="m9.17 14.83-4.24 4.24" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
    headerBg: "bg-emerald-50/90",
    headerBorder: "border-emerald-200/80",
    headerText: "text-emerald-900",
    badgeBg: "bg-emerald-100 text-emerald-700",
    badgeText: "text-emerald-700",
    cardBg: "bg-emerald-50/30 hover:bg-emerald-50/60",
    cardBorder: "border-emerald-100 hover:border-emerald-200",
    keyText: "text-emerald-700",
    valText: "text-slate-800",
  },
  status: {
    id: "status",
    title: "Status & Schedule",
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    headerBg: "bg-amber-50/90",
    headerBorder: "border-amber-200/80",
    headerText: "text-amber-900",
    badgeBg: "bg-amber-100 text-amber-800",
    badgeText: "text-amber-800",
    cardBg: "bg-amber-50/30 hover:bg-amber-50/60",
    cardBorder: "border-amber-100 hover:border-amber-200",
    keyText: "text-amber-800",
    valText: "text-slate-800",
  },
  commercial: {
    id: "commercial",
    title: "Pricing & Commercials",
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </svg>
    ),
    headerBg: "bg-purple-50/90",
    headerBorder: "border-purple-200/80",
    headerText: "text-purple-900",
    badgeBg: "bg-purple-100 text-purple-700",
    badgeText: "text-purple-700",
    cardBg: "bg-purple-50/30 hover:bg-purple-50/60",
    cardBorder: "border-purple-100 hover:border-purple-200",
    keyText: "text-purple-700",
    valText: "text-slate-800",
  },
  notes: {
    id: "notes",
    title: "Additional Notes",
    icon: (
      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    headerBg: "bg-slate-100/90",
    headerBorder: "border-slate-200/80",
    headerText: "text-slate-800",
    badgeBg: "bg-slate-200 text-slate-700",
    badgeText: "text-slate-700",
    cardBg: "bg-slate-50/40 hover:bg-slate-50/80",
    cardBorder: "border-slate-200 hover:border-slate-300",
    keyText: "text-slate-700",
    valText: "text-slate-800",
  },
};

function parseFact(raw: string): FactItem {
  const colonIndex = raw.indexOf(":");
  if (colonIndex > 0) {
    const key = raw.slice(0, colonIndex).trim();
    const value = raw.slice(colonIndex + 1).trim();
    return { raw, key, value, isKv: true };
  }
  return { raw, key: "Detail", value: raw.trim(), isKv: false };
}

function classifyFact(key: string, value: string): CategoryId {
  const k = key.toLowerCase();
  const v = value.toLowerCase();

  // 1. Pricing / Commercial
  if (
    k.includes("price") ||
    k.includes("quote") ||
    k.includes("budget") ||
    k.includes("cost") ||
    k.includes("payment") ||
    k.includes("package") ||
    k.includes("fee") ||
    k.includes("qar") ||
    v.includes("qar")
  ) {
    return "commercial";
  }

  // 2. Status & Schedule
  if (
    k.includes("status") ||
    k.includes("meeting") ||
    k.includes("time") ||
    k.includes("schedule") ||
    k.includes("action") ||
    k.includes("appointment") ||
    k.includes("date") ||
    k.includes("stage") ||
    k.includes("follow")
  ) {
    return "status";
  }

  // 3. Profile & Identity
  if (
    k.includes("name") ||
    k.includes("customer") ||
    k.includes("business") ||
    k.includes("company") ||
    k.includes("location") ||
    k.includes("language") ||
    k.includes("city") ||
    k.includes("phone") ||
    k.includes("email") ||
    k.includes("contact")
  ) {
    return "profile";
  }

  // 4. Interests & Requirements
  if (
    k.includes("interest") ||
    k.includes("requirement") ||
    k.includes("inquiry") ||
    k.includes("enquiry") ||
    k.includes("service") ||
    k.includes("looking for") ||
    k.includes("project") ||
    k.includes("preference") ||
    k.includes("feature")
  ) {
    return "interests";
  }

  return "notes";
}

export function WhatWeKnow({ memory }: { memory: MemoryData | null | undefined }) {
  const summary = memory?.summary?.trim();
  const factsList = memory?.facts || [];

  const groupedFacts = useMemo(() => {
    const groups: Record<CategoryId, FactItem[]> = {
      profile: [],
      interests: [],
      status: [],
      commercial: [],
      notes: [],
    };

    factsList.forEach((raw) => {
      if (!raw || typeof raw !== "string") return;
      const item = parseFact(raw);
      const cat = classifyFact(item.key, item.value);
      groups[cat].push(item);
    });

    return groups;
  }, [factsList]);

  const hasAnyData = Boolean(summary || factsList.length > 0);

  if (!hasAnyData) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-pine-wash text-pine text-xs">
            💡
          </span>
          <h3 className="font-semibold text-sm text-ink">What we know</h3>
        </div>
        <div className="rounded-lg border border-dashed border-line bg-canvas/40 p-4 text-center">
          <p className="text-xs font-medium text-ink-soft">Nothing recorded yet</p>
          <p className="text-[11px] text-ink-faint mt-0.5">
            Key details & summary will automatically appear here as the conversation unfolds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main Section Header */}
      <div className="flex items-center justify-between pb-1 border-b border-line/60">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-pine-wash text-pine shadow-2xs">
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4" />
              <path d="m4.93 4.93 2.83 2.83" />
              <path d="M2 12h4" />
              <path d="m4.93 19.07 2.83-2.83" />
              <path d="M12 22v-4" />
              <path d="m19.07 19.07-2.83-2.83" />
              <path d="M22 12h-4" />
              <path d="m19.07 4.93-2.83 2.83" />
            </svg>
          </span>
          <div>
            <h3 className="font-semibold text-sm text-ink leading-none">What We Know</h3>
            <span className="text-[10px] text-ink-faint">AI Extracted Memory</span>
          </div>
        </div>
        <span className="text-[10px] font-semibold tracking-wider uppercase text-pine bg-pine-wash border border-pine/20 px-2 py-0.5 rounded-full">
          Live Context
        </span>
      </div>

      {/* 1. Conversation Summary Section */}
      {summary && (
        <div className="rounded-xl border border-pine/20 bg-gradient-to-br from-pine-wash/60 via-panel to-panel p-3.5 shadow-2xs">
          <div className="flex items-center gap-1.5 mb-1.5 text-pine-deep">
            <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-pine">
              Conversation Summary
            </h4>
          </div>
          <p className="text-xs text-ink-soft leading-relaxed font-normal">
            {summary}
          </p>
        </div>
      )}

      {/* 2. Structured Categorized Fact Sections */}
      {(Object.keys(CATEGORIES) as CategoryId[]).map((catId) => {
        const cat = CATEGORIES[catId];
        const items = groupedFacts[catId];
        if (!items || items.length === 0) return null;

        return (
          <div
            key={catId}
            className="rounded-xl border border-line bg-panel overflow-hidden shadow-2xs transition-all"
          >
            {/* Category Header */}
            <div
              className={`flex items-center justify-between px-3 py-2 border-b ${cat.headerBg} ${cat.headerBorder}`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`p-1 rounded-md bg-white/80 shadow-2xs ${cat.headerText}`}>
                  {cat.icon}
                </span>
                <h4 className={`text-xs font-semibold tracking-wide ${cat.headerText}`}>
                  {cat.title}
                </h4>
              </div>
              <span
                className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cat.badgeBg}`}
              >
                {items.length}
              </span>
            </div>

            {/* Fact Cards */}
            <div className="p-2 space-y-1.5">
              {items.map((item, idx) => {
                if (item.isKv) {
                  return (
                    <div
                      key={idx}
                      className={`rounded-lg border px-2.5 py-1.5 transition-colors ${cat.cardBg} ${cat.cardBorder}`}
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={`text-[10px] font-bold tracking-wider uppercase ${cat.keyText}`}>
                          {item.key}
                        </span>
                      </div>
                      <p className={`text-xs font-medium mt-0.5 ${cat.valText}`}>
                        {item.value}
                      </p>
                    </div>
                  );
                }

                return (
                  <div
                    key={idx}
                    className={`rounded-lg border px-2.5 py-1.5 ${cat.cardBg} ${cat.cardBorder}`}
                  >
                    <p className={`text-xs ${cat.valText}`}>
                      {item.value}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
