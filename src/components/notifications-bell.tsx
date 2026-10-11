"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

export type NotificationItem = {
  id: number;
  kind: string;
  title: string;
  body: string;
  ref_type?: string;
  ref_id?: number;
  created_at: string;
  read_at?: string | null;
};

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const seenIdsRef = useRef<Set<number>>(new Set());
  const initialLoadRef = useRef(true);
  const dropdownRef = useRef<HTMLDivElement>(null);

  function playChime() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch {}
  }

  async function fetchNotifications() {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data = await res.json();
      if (!data.ok) return;

      const newItems: NotificationItem[] = data.notifications || [];
      setUnreadCount(data.unreadCount || 0);
      setItems(newItems);

      // Check for incoming notifications after initial load
      if (!initialLoadRef.current) {
        let hasNewOrder = false;
        let newTitle = "";
        for (const item of newItems) {
          if (!seenIdsRef.current.has(item.id) && !item.read_at) {
            hasNewOrder = true;
            newTitle = item.title;
          }
        }

        if (hasNewOrder) {
          setToastMessage(newTitle || "New order received!");
          setTimeout(() => setToastMessage(null), 6000);
          if (soundEnabled) {
            playChime();
          }
        }
      }

      // Track all loaded IDs
      for (const item of newItems) {
        seenIdsRef.current.add(item.id);
      }
      initialLoadRef.current = false;
    } catch {}
  }

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [soundEnabled]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ all: true }),
    });
    setUnreadCount(0);
    setItems((prev) => prev.map((i) => ({ ...i, read_at: new Date().toISOString() })));
  }

  async function markItemRead(id: number) {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setUnreadCount((c) => Math.max(0, c - 1));
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, read_at: new Date().toISOString() } : i))
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Toast popup */}
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-3 bg-ink text-white px-4 py-3 rounded-lg shadow-xl border border-line/20 animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          <div className="text-sm font-medium">{toastMessage}</div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-white/60 hover:text-white text-xs ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Bell button with badge */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-md hover:bg-canvas text-ink-soft hover:text-ink transition-colors flex items-center justify-center"
        aria-label="Notifications"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] bg-brick text-white text-[10px] font-bold rounded-full px-1 flex items-center justify-center ring-2 ring-panel">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-panel border border-line rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in-50 duration-150">
          <div className="px-4 py-3 border-b border-line flex items-center justify-between bg-canvas/40">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs bg-brick/10 text-brick font-semibold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {/* Sound Alert Toggle */}
              <button
                type="button"
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  if (next) playChime();
                }}
                className={`text-xs px-2 py-1 rounded border transition-colors flex items-center gap-1 ${
                  soundEnabled
                    ? "bg-pine-wash text-pine border-pine/30 font-medium"
                    : "bg-panel text-ink-soft border-line hover:bg-canvas"
                }`}
                title="Toggle order sound alerts"
              >
                <span>{soundEnabled ? "🔔 Sound ON" : "🔕 Sound OFF"}</span>
              </button>

              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs text-ink-soft hover:text-ink font-medium underline"
                >
                  Mark read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-line">
            {items.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-soft">
                No notifications yet.
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => markItemRead(item.id)}
                  className={`p-3.5 hover:bg-canvas/60 transition-colors flex items-start gap-3 cursor-pointer ${
                    !item.read_at ? "bg-pine-wash/20" : ""
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                      !item.read_at ? "bg-pine" : "bg-transparent"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-ink truncate">
                        {item.title}
                      </p>
                      <span className="text-[10px] text-ink-faint shrink-0 tabular">
                        {new Date(item.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    {item.body && (
                      <p className="text-xs text-ink-soft mt-0.5 line-clamp-2">
                        {item.body}
                      </p>
                    )}
                    {item.ref_type === "order" && (
                      <Link
                        href="/orders"
                        className="inline-block text-[11px] text-pine font-medium mt-1 hover:underline"
                        onClick={() => setOpen(false)}
                      >
                        View Orders Board →
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
