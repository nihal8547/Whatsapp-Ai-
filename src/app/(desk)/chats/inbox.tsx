"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Empty, Tag, Toast, useToast } from "@/components/ui";
import { clock, dayStamp, timeAgo } from "@/lib/format";

type Thread = {
  phone: string;
  name: string;
  last_text: string;
  last_message_at: string;
  bot_enabled: boolean;
  needs_human: boolean;
};

type Message = {
  id: number;
  direction: "in" | "out";
  sender: "customer" | "bot" | "staff" | "system";
  content: string;
  created_at: string;
};

type Detail = {
  contact: { phone: string; name: string; bot_enabled: boolean; needs_human: boolean; handoff_reason: string };
  memory: { summary: string; facts: string[] } | null;
  appointments: { id: number; service: string; start_time: string; status: string }[];
  messages: Message[];
};

export default function Inbox({ initialPhone, tz }: { initialPhone: string | null; tz: string }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [active, setActive] = useState<string | null>(initialPhone);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [filter, setFilter] = useState<"all" | "waiting">("all");
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const { message: toast, show } = useToast();
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadThreads = useCallback(async () => {
    const res = await fetch(`/api/chats?filter=${filter}&search=${encodeURIComponent(search)}`);
    const data = await res.json();
    if (data.ok) {
      setThreads(data.threads);
      setLoaded(true);
      setActive((cur) => cur ?? data.threads[0]?.phone ?? null);
    }
  }, [filter, search]);

  const loadDetail = useCallback(async (phone: string, scroll: boolean) => {
    const res = await fetch(`/api/chats/${phone}`);
    const data = await res.json();
    if (data.ok) {
      setDetail(data);
      if (scroll) setTimeout(() => bottomRef.current?.scrollIntoView({ block: "end" }), 40);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (active) loadDetail(active, true);
  }, [active, loadDetail]);

  // Poll so new customer messages appear without a refresh.
  useEffect(() => {
    const t = setInterval(() => {
      loadThreads();
      if (active) loadDetail(active, false);
    }, 7000);
    return () => clearInterval(t);
  }, [active, loadThreads, loadDetail]);

  async function send() {
    const text = draft.trim();
    if (!text || !active) return;
    setSending(true);
    const res = await fetch(`/api/chats/${active}/send`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    setSending(false);
    if (!data.ok) {
      show(
        data.error === "whatsapp_not_connected"
          ? "Connect your WhatsApp number first."
          : "Message didn't send. Try again."
      );
      return;
    }
    setDraft("");
    loadDetail(active, true);
    loadThreads();
  }

  async function toggleBot(next: boolean) {
    if (!active) return;
    await fetch(`/api/chats/${active}/bot`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: next }),
    });
    show(next ? "Assistant is handling this chat again" : "You have taken over this chat");
    loadDetail(active, false);
    loadThreads();
  }

  return (
    <div className="lg:grid lg:grid-cols-[300px_1fr_280px] lg:h-screen">
      {/* Threads */}
      <aside className="border-r border-line bg-panel flex flex-col lg:h-screen">
        <div className="p-4 border-b border-line space-y-3">
          <input
            placeholder="Search name or number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-line px-3 py-2 text-sm placeholder:text-ink-faint focus:border-pine focus:outline-none"
          />
          <div className="flex gap-1">
            {(["all", "waiting"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-2.5 py-1 rounded text-xs font-medium ${
                  filter === f ? "bg-pine-wash text-pine-deep" : "text-ink-soft hover:bg-canvas"
                }`}
              >
                {f === "all" ? "All chats" : "Waiting for a person"}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-y-auto flex-1 max-h-[40vh] lg:max-h-none">
          {!loaded ? (
            <p className="text-sm text-ink-soft p-4">Loading chats…</p>
          ) : threads.length === 0 ? (
            <p className="text-sm text-ink-soft p-4">
              {filter === "waiting" ? "Nobody is waiting on your team." : "No chats yet."}
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {threads.map((t) => (
                <li key={t.phone}>
                  <button
                    onClick={() => setActive(t.phone)}
                    className={`w-full text-left px-4 py-3 hover:bg-canvas ${
                      active === t.phone ? "bg-pine-wash" : ""
                    }`}
                  >
                    <div className="flex justify-between gap-2">
                      <span className="font-medium text-sm truncate">{t.name || t.phone}</span>
                      <span className="text-xs text-ink-faint tabular shrink-0">
                        {timeAgo(t.last_message_at)}
                      </span>
                    </div>
                    <p className="text-sm text-ink-soft truncate mt-0.5">{t.last_text}</p>
                    {t.needs_human && (
                      <span className="inline-block mt-1.5">
                        <Tag tone="warn">Wants a person</Tag>
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {/* Conversation */}
      <section className="flex flex-col lg:h-screen min-w-0">
        {!detail ? (
          <Empty title="Pick a chat">Choose a conversation on the left to read it.</Empty>
        ) : (
          <>
            <header className="px-5 py-3 border-b border-line bg-panel flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium truncate">{detail.contact.name || detail.contact.phone}</p>
                <p className="text-xs text-ink-soft tabular">+{detail.contact.phone}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {detail.contact.bot_enabled ? (
                  <>
                    <Tag tone="good">Assistant on</Tag>
                    <Button variant="quiet" onClick={() => toggleBot(false)}>
                      Take over
                    </Button>
                  </>
                ) : (
                  <>
                    <Tag tone="warn">You are replying</Tag>
                    <Button variant="quiet" onClick={() => toggleBot(true)}>
                      Give back to assistant
                    </Button>
                  </>
                )}
              </div>
            </header>

            <div className="flex-1 overflow-y-auto p-5 space-y-2 max-h-[50vh] lg:max-h-none">
              {detail.messages.map((m, i) => {
                const prev = detail.messages[i - 1];
                const newDay =
                  !prev || dayStamp(prev.created_at, tz) !== dayStamp(m.created_at, tz);
                return (
                  <div key={m.id}>
                    {newDay && (
                      <p className="text-center text-xs text-ink-faint my-4">
                        {dayStamp(m.created_at, tz)}
                      </p>
                    )}
                    <div className={`flex ${m.direction === "in" ? "justify-start" : "justify-end"}`}>
                      <div
                        className={`max-w-[75%] rounded-lg px-3.5 py-2 ${
                          m.direction === "in"
                            ? "bg-panel border border-line"
                            : m.sender === "staff"
                            ? "bg-ink text-white"
                            : "bg-pine text-white"
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                        <p
                          className={`text-[11px] mt-1 tabular ${
                            m.direction === "in" ? "text-ink-faint" : "text-white/60"
                          }`}
                        >
                          {m.sender === "staff" ? "You · " : m.sender === "bot" ? "Assistant · " : ""}
                          {clock(m.created_at, tz)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            <div className="border-t border-line bg-panel p-4">
              {detail.contact.bot_enabled && (
                <p className="text-xs text-amber mb-2">
                  The assistant is replying to this chat. Your message goes out as well.
                </p>
              )}
              <div className="flex gap-2">
                <textarea
                  rows={2}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send();
                    }
                  }}
                  placeholder="Write a reply…"
                  className="flex-1 resize-none rounded-md border border-line px-3 py-2 text-sm focus:border-pine focus:outline-none"
                />
                <Button onClick={send} disabled={sending || !draft.trim()}>
                  {sending ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
          </>
        )}
      </section>

      {/* Context */}
      <aside className="border-l border-line bg-panel p-5 overflow-y-auto lg:h-screen">
        {detail ? (
          <div className="space-y-6">
            {detail.contact.needs_human && detail.contact.handoff_reason && (
              <div className="bg-amber-wash rounded-md p-3">
                <p className="text-sm font-medium text-amber">Asked for a person</p>
                <p className="text-sm text-ink mt-1">{detail.contact.handoff_reason}</p>
              </div>
            )}

            <div>
              <h3 className="font-semibold text-sm mb-2">What we know</h3>
              {detail.memory?.summary ? (
                <p className="text-sm text-ink-soft leading-relaxed">{detail.memory.summary}</p>
              ) : (
                <p className="text-sm text-ink-faint">Nothing yet — this is a new customer.</p>
              )}
              {detail.memory?.facts?.length ? (
                <ul className="mt-3 space-y-1">
                  {detail.memory.facts.map((f, i) => (
                    <li key={i} className="text-sm text-ink-soft">
                      {f}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <div>
              <h3 className="font-semibold text-sm mb-2">Appointments</h3>
              {detail.appointments.length === 0 ? (
                <p className="text-sm text-ink-faint">None booked.</p>
              ) : (
                <ul className="space-y-2">
                  {detail.appointments.map((a) => (
                    <li key={a.id} className="text-sm">
                      <p className="font-medium">{a.service}</p>
                      <p className="text-ink-soft tabular">{dayStamp(a.start_time, tz)} {clock(a.start_time, tz)}</p>
                      {a.status !== "confirmed" && <Tag tone="neutral">{a.status}</Tag>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </aside>

      <Toast message={toast} />
    </div>
  );
}
