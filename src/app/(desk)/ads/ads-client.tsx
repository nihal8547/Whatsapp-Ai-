"use client";

import { useState, useCallback } from "react";
import { Panel, PageHead, Button, Field, inputClass, Tag, Empty, Toast, useToast } from "@/components/ui";

// ─── Types ────────────────────────────────────────────────────────────────────

type AdRow = {
  group_key: string;
  source_id: string | null;
  ad_title: string | null;
  ad_body: string | null;
  clicks: number;
  people: number;
  last_seen: string;
  bookings: number;
  completed: number;
  playbook_id: number | null;
  playbook_name: string | null;
};

type Playbook = {
  id: number;
  name: string;
  match_type: "source_id" | "title_contains" | "any";
  match_value: string | null;
  instructions: string;
  media_id: number | null;
  active: boolean;
  sort_order: number;
  media_title?: string | null;
  media_token?: string | null;
};

type MediaItem = {
  id: number;
  title: string;
  category: string;
  public_token: string;
  mime_type: string;
};

type FormState = {
  id: number | null;
  name: string;
  match_type: "source_id" | "title_contains" | "any";
  match_value: string;
  instructions: string;
  media_id: number | null;
  active: boolean;
  sort_order: number;
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdsClient({
  initialAds,
  initialPlaybooks,
  mediaItems,
  isOwner,
  role,
}: {
  initialAds: AdRow[];
  initialPlaybooks: Playbook[];
  mediaItems: MediaItem[];
  isOwner: boolean;
  role: string;
}) {
  const [ads] = useState<AdRow[]>(initialAds);
  const [playbooks, setPlaybooks] = useState<Playbook[]>(initialPlaybooks);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm([]));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Playbook | null>(null);
  const { message: toastMsg, show: showToast } = useToast();

  function blankForm(pbs: Playbook[], prefill?: Partial<FormState>): FormState {
    return {
      id: null,
      name: "",
      match_type: "source_id",
      match_value: "",
      instructions: "",
      media_id: null,
      active: true,
      sort_order: (pbs.length + 1) * 10,
      ...prefill,
    };
  }

  function openNew(prefill?: Partial<FormState>) {
    setForm(blankForm(playbooks, prefill));
    setFormOpen(true);
  }

  function openEdit(pb: Playbook) {
    setForm({
      id: pb.id,
      name: pb.name,
      match_type: pb.match_type,
      match_value: pb.match_value ?? "",
      instructions: pb.instructions,
      media_id: pb.media_id,
      active: pb.active,
      sort_order: pb.sort_order,
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setForm(blankForm(playbooks));
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────

  const savePlaybook = useCallback(async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        match_type: form.match_type,
        match_value: form.match_type === "any" ? null : form.match_value.trim(),
        instructions: form.instructions.trim(),
        media_id: form.media_id,
        active: form.active,
        sort_order: form.sort_order,
      };
      const isEdit = form.id !== null;
      const url = isEdit ? `/api/ads/playbooks/${form.id}` : "/api/ads/playbooks";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showToast(data.message || data.error || "Save failed");
        return;
      }
      if (isEdit) {
        setPlaybooks((prev) => prev.map((p) => (p.id === form.id ? { ...p, ...data.playbook } : p)));
        showToast("Playbook updated");
      } else {
        setPlaybooks((prev) => [...prev, data.playbook]);
        showToast("Playbook created");
      }
      closeForm();
    } finally {
      setSaving(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, showToast]);

  const toggleActive = useCallback(async (pb: Playbook) => {
    const res = await fetch(`/api/ads/playbooks/${pb.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !pb.active }),
    });
    if (res.ok) {
      setPlaybooks((prev) => prev.map((p) => (p.id === pb.id ? { ...p, active: !pb.active } : p)));
    }
  }, []);

  const movePriority = useCallback(
    async (pb: Playbook, dir: -1 | 1) => {
      const idx = playbooks.findIndex((p) => p.id === pb.id);
      const sibling = playbooks[idx + dir];
      if (!sibling) return;
      await Promise.all([
        fetch(`/api/ads/playbooks/${pb.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sort_order: sibling.sort_order }),
        }),
        fetch(`/api/ads/playbooks/${sibling.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sort_order: pb.sort_order }),
        }),
      ]);
      setPlaybooks((prev) => {
        const next = [...prev];
        const a = { ...next[idx] };
        const b = { ...next[idx + dir] };
        [a.sort_order, b.sort_order] = [b.sort_order, a.sort_order];
        next[idx] = a;
        next[idx + dir] = b;
        return next.sort((x, y) => x.sort_order - y.sort_order);
      });
    },
    [playbooks]
  );

  const deletePlaybook = useCallback(
    async (pb: Playbook) => {
      setDeleting(pb.id);
      try {
        const res = await fetch(`/api/ads/playbooks/${pb.id}`, { method: "DELETE" });
        if (res.ok) {
          setPlaybooks((prev) => prev.filter((p) => p.id !== pb.id));
          showToast("Playbook deleted");
        } else {
          showToast("Delete failed");
        }
      } finally {
        setDeleting(null);
        setConfirmDelete(null);
      }
    },
    [showToast]
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <PageHead
        title="Ad Playbooks"
        lead="Teach the assistant what to say when a customer arrives from an ad."
        action={
          isOwner ? (
            <Button onClick={() => openNew()}>+ New playbook</Button>
          ) : undefined
        }
      />

      {/* ── Ads seen ──────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold mb-3">Ads we have seen</h2>
        {ads.length === 0 ? (
          <Empty title="No ad traffic yet">
            When customers click a WhatsApp ad and message you, they appear here.
          </Empty>
        ) : (
          <div className="rounded-lg border border-line overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-ink-soft text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left px-4 py-2.5">Ad</th>
                  <th className="text-right px-4 py-2.5">Clicks</th>
                  <th className="text-right px-4 py-2.5">People</th>
                  <th className="text-right px-4 py-2.5">Booked</th>
                  <th className="text-left px-4 py-2.5">Last seen</th>
                  <th className="text-left px-4 py-2.5">Playbook</th>
                  {isOwner && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-panel">
                {ads.map((ad) => (
                  <tr key={ad.group_key} className="hover:bg-canvas/50 transition-colors">
                    <td className="px-4 py-3 max-w-xs">
                      <p className="font-medium truncate">{ad.ad_title ?? ad.group_key}</p>
                      {ad.ad_body && (
                        <p className="text-xs text-ink-soft truncate mt-0.5">{ad.ad_body}</p>
                      )}
                      {ad.source_id && (
                        <p className="text-xs text-ink-faint font-mono mt-0.5">id: {ad.source_id}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular">{ad.clicks}</td>
                    <td className="px-4 py-3 text-right tabular">{ad.people}</td>
                    <td className="px-4 py-3 text-right tabular">{ad.bookings}</td>
                    <td className="px-4 py-3 text-ink-soft text-xs whitespace-nowrap">
                      {new Date(ad.last_seen).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      {ad.playbook_name ? (
                        <Tag tone="good">Playbook: {ad.playbook_name}</Tag>
                      ) : (
                        <Tag tone="neutral">No playbook</Tag>
                      )}
                    </td>
                    {isOwner && (
                      <td className="px-4 py-3 text-right">
                        <button
                          className="text-xs text-pine hover:underline"
                          onClick={() =>
                            openNew({
                              match_type: ad.source_id ? "source_id" : "title_contains",
                              match_value: ad.source_id ?? ad.ad_title ?? "",
                              name: ad.ad_title ?? ad.group_key,
                            })
                          }
                        >
                          Create playbook
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── Playbooks list ─────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-base font-semibold mb-3">Playbooks</h2>
        {playbooks.length === 0 ? (
          <Empty title="No playbooks yet">
            {isOwner
              ? "Create one above to customise what the assistant says for each ad."
              : "No playbooks have been created for this workspace yet."}
          </Empty>
        ) : (
          <div className="space-y-2">
            {playbooks.map((pb, idx) => (
              <div
                key={pb.id}
                className="bg-panel border border-line rounded-lg px-4 py-3 flex items-start gap-3"
              >
                {isOwner && (
                  <div className="flex flex-col gap-0.5 mt-0.5 shrink-0">
                    <button
                      disabled={idx === 0}
                      onClick={() => movePriority(pb, -1)}
                      className="text-ink-faint hover:text-ink disabled:opacity-30 text-xs leading-none"
                      title="Move up"
                    >
                      ▲
                    </button>
                    <button
                      disabled={idx === playbooks.length - 1}
                      onClick={() => movePriority(pb, 1)}
                      className="text-ink-faint hover:text-ink disabled:opacity-30 text-xs leading-none"
                      title="Move down"
                    >
                      ▼
                    </button>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{pb.name}</span>
                    <MatchBadge pb={pb} />
                    {pb.media_title && <Tag tone="neutral">📎 {pb.media_title}</Tag>}
                  </div>
                  <p className="text-xs text-ink-soft mt-1 line-clamp-2">{pb.instructions}</p>
                </div>
                {isOwner && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => toggleActive(pb)}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                        pb.active ? "bg-pine" : "bg-line"
                      }`}
                      role="switch"
                      aria-checked={pb.active}
                      title={pb.active ? "Active — click to pause" : "Paused — click to activate"}
                    >
                      <span
                        className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                          pb.active ? "translate-x-4" : "translate-x-0"
                        }`}
                      />
                    </button>
                    <button onClick={() => openEdit(pb)} className="text-xs text-ink-soft hover:text-ink">
                      Edit
                    </button>
                    <button
                      onClick={() => setConfirmDelete(pb)}
                      className="text-xs text-brick hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Form modal ─────────────────────────────────────────────────────── */}
      {formOpen && (
        <PlaybookForm
          form={form}
          setForm={setForm}
          mediaItems={mediaItems}
          saving={saving}
          onSave={savePlaybook}
          onClose={closeForm}
        />
      )}

      {/* ── Delete confirm ─────────────────────────────────────────────────── */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-ink/40 z-50 flex items-center justify-center p-4">
          <div className="bg-panel rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="font-semibold text-lg mb-2">Delete playbook?</h3>
            <p className="text-sm text-ink-soft mb-5">
              &ldquo;<strong>{confirmDelete.name}</strong>&rdquo; will be permanently removed.
              The assistant will no longer have custom instructions for this ad.
            </p>
            <div className="flex gap-2 justify-end">
              <Button variant="quiet" onClick={() => setConfirmDelete(null)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={deleting === confirmDelete.id}
                onClick={() => deletePlaybook(confirmDelete)}
              >
                {deleting === confirmDelete.id ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toastMsg} />
    </div>
  );
}

// ─── Match badge ──────────────────────────────────────────────────────────────

function MatchBadge({ pb }: { pb: Playbook }) {
  if (pb.match_type === "any") return <Tag tone="warn">Any ad</Tag>;
  if (pb.match_type === "source_id")
    return (
      <Tag tone="neutral">
        ID: <span className="font-mono">{pb.match_value}</span>
      </Tag>
    );
  return <Tag tone="neutral">Title contains: &ldquo;{pb.match_value}&rdquo;</Tag>;
}

// ─── Playbook form ────────────────────────────────────────────────────────────

function PlaybookForm({
  form,
  setForm,
  mediaItems,
  saving,
  onSave,
  onClose,
}: {
  form: FormState;
  setForm: (f: FormState) => void;
  mediaItems: MediaItem[];
  saving: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  const MAX = 2000;
  const remaining = MAX - form.instructions.length;

  const selectedMedia = mediaItems.find((m) => m.id === form.media_id);

  // Preview — exactly what the assistant will see
  const previewLines = [
    form.match_type !== "any" && form.match_value ? `Ad: ${form.match_value}` : "Ad: (any)",
    "",
    "Owner instructions:",
    form.instructions || "(empty)",
    selectedMedia ? `\nImage: /media/${selectedMedia.public_token}` : "",
  ]
    .join("\n")
    .trim();

  const canSave =
    !!form.name.trim() &&
    !!form.instructions.trim() &&
    form.instructions.length <= MAX &&
    (form.match_type === "any" || !!form.match_value.trim());

  const hintText =
    form.match_type === "source_id"
      ? "Exact source_id from the ad click (e.g. 23856842399160)"
      : "Case-insensitive substring — e.g. Summer matches any title containing that word";

  return (
    <div className="fixed inset-0 bg-ink/40 z-50 flex items-start justify-center p-4 overflow-y-auto">
      <div className="bg-panel rounded-xl shadow-xl w-full max-w-2xl my-8">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <h2 className="font-semibold text-lg">
            {form.id ? "Edit playbook" : "New playbook"}
          </h2>
          <button onClick={onClose} className="text-ink-soft hover:text-ink text-lg leading-none">
            ✕
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <div className="bg-amber-wash text-amber rounded-lg px-4 py-3 text-sm">
            ⚠ Do not include passwords, API keys, or personal customer data in instructions.
          </div>

          <Field label="Playbook name">
            <input
              className={inputClass}
              value={form.name}
              maxLength={100}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Summer offer — Doha"
            />
          </Field>

          <Field label="Match type">
            <select
              className={inputClass}
              value={form.match_type}
              onChange={(e) =>
                setForm({
                  ...form,
                  match_type: e.target.value as FormState["match_type"],
                  match_value: e.target.value === "any" ? "" : form.match_value,
                })
              }
            >
              <option value="source_id">This exact ad (by source_id)</option>
              <option value="title_contains">Ad title contains…</option>
              <option value="any">Any ad (catch-all)</option>
            </select>
          </Field>

          {form.match_type !== "any" && (
            <Field
              label={form.match_type === "source_id" ? "Source ID" : "Title keyword"}
              hint={hintText}
            >
              <input
                className={inputClass}
                value={form.match_value}
                onChange={(e) => setForm({ ...form, match_value: e.target.value })}
                placeholder={form.match_type === "source_id" ? "23856842399160" : "Summer"}
              />
            </Field>
          )}

          <Field
            label="Instructions for the assistant"
            hint="Hint: what is the offer, what to ask first, what never to promise, what is the next step."
          >
            <textarea
              className={`${inputClass} resize-y min-h-[140px]`}
              value={form.instructions}
              maxLength={MAX}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              placeholder={[
                "Example:",
                "- Offer: Free consultation for summer AC service",
                "- Ask first: When would you like us to visit?",
                "- Never promise: Same-day guarantee",
                "- Next step: Book a slot via the calendar link",
              ].join("\n")}
            />
            <p className={`text-xs mt-1 ${remaining < 0 ? "text-brick" : "text-ink-faint"}`}>
              {remaining} characters remaining
            </p>
          </Field>

          <Field label="Optional image (from Media library)">
            <select
              className={inputClass}
              value={form.media_id ?? ""}
              onChange={(e) =>
                setForm({ ...form, media_id: e.target.value ? Number(e.target.value) : null })
              }
            >
              <option value="">— No image —</option>
              {mediaItems.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({m.category})
                </option>
              ))}
            </select>
          </Field>

          <Field label="Active">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setForm({ ...form, active: !form.active })}
                className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${
                  form.active ? "bg-pine" : "bg-line"
                }`}
                role="switch"
                aria-checked={form.active}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                    form.active ? "translate-x-4" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-sm text-ink-soft">
                {form.active ? "Active — assistant will use this playbook" : "Paused"}
              </span>
            </div>
          </Field>

          <div>
            <p className="text-sm font-medium mb-1.5">What the assistant will see</p>
            <pre className="bg-canvas rounded-lg p-4 text-xs font-mono whitespace-pre-wrap text-ink-soft leading-relaxed border border-line">
              {previewLines}
            </pre>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-line">
          <Button variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!canSave || saving} onClick={onSave}>
            {saving ? "Saving…" : form.id ? "Save changes" : "Create playbook"}
          </Button>
        </div>
      </div>
    </div>
  );
}
