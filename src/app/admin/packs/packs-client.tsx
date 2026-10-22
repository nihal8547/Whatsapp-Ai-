"use client";

import { useState } from "react";
import { Button, Panel, PageHead, Tag, Toast, useToast } from "@/components/ui";

type Pack = {
  code: string;
  name: string;
  modules: string[];
  labels: Record<string, string>;
  active: boolean;
  tenant_count: number;
};

const AVAILABLE_MODULES = [
  { code: "orders", name: "Orders & Cart", icon: "🛒" },
  { code: "catalog", name: "Catalog / Products / Menu", icon: "📋" },
  { code: "appointments", name: "Appointments & Services", icon: "📅" },
  { code: "leads", name: "Leads & Enquiries", icon: "🎯" },
  { code: "ads", name: "Ad Playbooks", icon: "📣" },
  { code: "faq", name: "FAQ Knowledge Base", icon: "❓" },
  { code: "media", name: "Media Library", icon: "🖼️" },
  { code: "stays", name: "Stays & Hospitality", icon: "🏨" },
  { code: "resources", name: "Staff / Rooms / Tables", icon: "👥" },
  { code: "quotes", name: "Price Quotes", icon: "📑" },
  { code: "table_booking", name: "Table Booking", icon: "🍽️" },
];

export default function BusinessPacksManager({ initialPacks }: { initialPacks: Pack[] }) {
  const { message, show } = useToast();
  const [packs, setPacks] = useState<Pack[]>(initialPacks);
  const [selectedCode, setSelectedCode] = useState<string>(initialPacks[0]?.code ?? "clinic");
  const [savingCode, setSavingCode] = useState<string | null>(null);

  const currentPack = packs.find(p => p.code === selectedCode) || packs[0];

  async function toggleModule(packCode: string, modCode: string) {
    const target = packs.find(p => p.code === packCode);
    if (!target) return;

    const currentMods = Array.isArray(target.modules) ? target.modules : [];
    const nextMods = currentMods.includes(modCode)
      ? currentMods.filter(m => m !== modCode)
      : [...currentMods, modCode];

    setSavingCode(packCode);
    const res = await fetch("/api/admin/packs", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: packCode, modules: nextMods }),
    });
    setSavingCode(null);
    const d = await res.json();
    if (!d.ok) return show("Could not update business pack modules.");

    setPacks(prev => prev.map(p => p.code === packCode ? { ...p, modules: nextMods } : p));
    show(`Updated modules for ${target.name}`);
  }

  return (
    <div className="p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      <div>
        <PageHead
          title="Business Types & Sidebar Packs"
          lead="Configure default modules and sidebar items shown for each business category selected during registration."
        />

        <div className="grid lg:grid-cols-3 gap-6">
          {/* ── Left: List of Business Types ── */}
          <div className="lg:col-span-1 space-y-2">
            <h2 className="text-xs font-semibold text-ink-soft uppercase tracking-wider px-1 mb-2">
              Business Categories ({packs.length})
            </h2>
            <div className="space-y-1">
              {packs.map(p => {
                const isSelected = p.code === selectedCode;
                const modCount = Array.isArray(p.modules) ? p.modules.length : 0;

                return (
                  <button
                    key={p.code}
                    onClick={() => setSelectedCode(p.code)}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all flex items-center justify-between ${
                      isSelected
                        ? "bg-pine-wash/40 border-pine/40 shadow-xs"
                        : "bg-panel border-line hover:bg-canvas"
                    }`}
                  >
                    <div>
                      <p className={`font-semibold text-sm ${isSelected ? "text-pine-deep" : "text-ink"}`}>
                        {p.name}
                      </p>
                      <p className="text-xs text-ink-soft mt-0.5">
                        <span className="font-mono text-[11px] text-ink-faint mr-1.5">{p.code}</span>
                        · {p.tenant_count} workspace{p.tenant_count === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-canvas border border-line text-ink-soft">
                      {modCount} modules
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Right: Module Configuration for Selected Category ── */}
          <div className="lg:col-span-2 space-y-6">
            {currentPack ? (
              <Panel>
                <div className="border-b border-line pb-4 mb-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-bold text-ink">{currentPack.name}</h2>
                      <Tag tone="neutral">{currentPack.code}</Tag>
                    </div>
                    <p className="text-xs text-ink-soft mt-1">
                      New signups selecting &ldquo;{currentPack.name}&rdquo; will automatically see these modules in their sidebar by default.
                    </p>
                  </div>
                  {savingCode === currentPack.code && (
                    <span className="text-xs font-medium text-pine flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-pine animate-pulse" /> Saving changes…
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-soft">
                    Default Modules & Navigation Links
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {AVAILABLE_MODULES.map(mod => {
                      const active = Array.isArray(currentPack.modules) && currentPack.modules.includes(mod.code);

                      return (
                        <div
                          key={mod.code}
                          className={`p-3.5 rounded-lg border transition-all ${
                            active
                              ? "bg-pine-wash/20 border-pine/30 shadow-xs"
                              : "bg-canvas/40 border-line opacity-75"
                          }`}
                        >
                          <label className="flex items-start gap-3 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              className="mt-0.5 rounded text-pine focus:ring-pine"
                              checked={active}
                              disabled={savingCode === currentPack.code}
                              onChange={() => toggleModule(currentPack.code, mod.code)}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-ink flex items-center gap-1.5">
                                <span>{mod.icon}</span>
                                <span>{mod.name}</span>
                              </p>
                              <p className="text-[11px] text-ink-soft mt-0.5">
                                {active ? "Visible in sidebar by default" : "Hidden for this business type"}
                              </p>
                            </div>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ── Active Terminology / Labels info ── */}
                <div className="mt-6 pt-5 border-t border-line">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-ink-soft mb-2">
                    Custom Terminology for this Category
                  </h3>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {currentPack.labels && Object.keys(currentPack.labels).length > 0 ? (
                      Object.entries(currentPack.labels).map(([key, val]) => (
                        <span key={key} className="px-2.5 py-1 rounded bg-canvas border border-line text-ink">
                          <strong className="text-ink-soft font-normal">{key}:</strong> {val}
                        </span>
                      ))
                    ) : (
                      <span className="text-ink-soft text-xs italic">Default platform terminology used.</span>
                    )}
                  </div>
                </div>
              </Panel>
            ) : null}
          </div>
        </div>
      </div>
      <Toast message={message} />
    </div>
  );
}
