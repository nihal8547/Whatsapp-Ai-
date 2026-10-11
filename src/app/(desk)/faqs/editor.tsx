"use client";

import { useState } from "react";
import { Button, Field, inputClass, Panel, PageHead, Tag, Toast, useToast, Empty } from "@/components/ui";

export type FaqItem = {
  id: number;
  question: string;
  answer: string;
  keywords: string[];
  sort_order: number;
  active: boolean;
  created_at?: string;
};

type Suggestion = {
  id: string;
  question: string;
  answer: string;
  count: number | null;
};

export default function FaqsEditor({
  initialFaqs,
  readOnly,
  labels,
}: {
  initialFaqs: FaqItem[];
  readOnly: boolean;
  labels: Record<string, string>;
}) {
  const [faqs, setFaqs] = useState<FaqItem[]>(initialFaqs);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    question: "",
    answer: "",
    keywordsStr: "",
    active: true,
  });
  const [draft, setDraft] = useState({
    question: "",
    answer: "",
    keywordsStr: "",
    active: false,
  });
  const [showAdd, setShowAdd] = useState(false);
  const [showSuggest, setShowSuggest] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [busy, setBusy] = useState(false);
  const { message, show } = useToast();

  async function reloadFaqs() {
    const res = await fetch("/api/faqs");
    const data = await res.json();
    if (data.ok) setFaqs(data.faqs);
  }

  async function openSuggestions() {
    setShowSuggest(true);
    setLoadingSuggestions(true);
    try {
      const res = await fetch("/api/faqs/suggest");
      const data = await res.json();
      if (data.ok) {
        setSuggestions(data.suggestions || []);
      }
    } catch {
      show("Could not load top questions");
    } finally {
      setLoadingSuggestions(false);
    }
  }

  async function addSuggestedFaq(s: Suggestion) {
    setBusy(true);
    try {
      const res = await fetch("/api/faqs/suggest", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: s.question, answer: s.answer }),
      });
      const data = await res.json();
      if (data.ok) {
        show("Draft FAQ added — review and turn on");
        await reloadFaqs();
        // remove from local suggestions list
        setSuggestions((prev) => prev.filter((item) => item.id !== s.id));
      } else {
        show("Failed to add FAQ");
      }
    } catch {
      show("Error saving suggestion");
    } finally {
      setBusy(false);
    }
  }

  async function createFaq(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.question.trim() || !draft.answer.trim()) return;
    setBusy(true);

    const kw = draft.keywordsStr
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    try {
      const res = await fetch("/api/faqs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: draft.question,
          answer: draft.answer,
          keywords: kw,
          active: draft.active,
          sort_order: (faqs.length + 1) * 10,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        show("FAQ saved");
        setDraft({ question: "", answer: "", keywordsStr: "", active: false });
        setShowAdd(false);
        await reloadFaqs();
      } else {
        show(data.error || "Failed to save");
      }
    } catch {
      show("Failed to create FAQ");
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(faq: FaqItem) {
    const nextState = !faq.active;
    // optimistic update
    setFaqs((prev) => prev.map((f) => (f.id === faq.id ? { ...f, active: nextState } : f)));
    try {
      const res = await fetch(`/api/faqs/${faq.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: nextState }),
      });
      const data = await res.json();
      if (!data.ok) {
        show("Failed to update status");
        await reloadFaqs();
      } else {
        show(nextState ? "FAQ is now active" : "FAQ set to draft");
      }
    } catch {
      show("Failed to update status");
      await reloadFaqs();
    }
  }

  function startEdit(faq: FaqItem) {
    setEditingId(faq.id);
    setEditForm({
      question: faq.question,
      answer: faq.answer,
      keywordsStr: (faq.keywords || []).join(", "),
      active: faq.active,
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setBusy(true);

    const kw = editForm.keywordsStr
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`/api/faqs/${editingId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question: editForm.question,
          answer: editForm.answer,
          keywords: kw,
          active: editForm.active,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        show("FAQ updated");
        setEditingId(null);
        await reloadFaqs();
      } else {
        show(data.error || "Failed to update");
      }
    } catch {
      show("Failed to update FAQ");
    } finally {
      setBusy(false);
    }
  }

  async function deleteFaq(id: number) {
    if (!confirm("Are you sure you want to delete this FAQ?")) return;
    try {
      const res = await fetch(`/api/faqs/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        show("FAQ deleted");
        setFaqs((prev) => prev.filter((f) => f.id !== id));
      } else {
        show("Failed to delete");
      }
    } catch {
      show("Failed to delete FAQ");
    }
  }

  async function moveFaq(index: number, direction: "up" | "down") {
    const targetIdx = direction === "up" ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= faqs.length) return;

    const list = [...faqs];
    const item = list[index];
    const other = list[targetIdx];

    // swap
    list[index] = other;
    list[targetIdx] = item;
    setFaqs(list);

    // Save orders
    try {
      await Promise.all([
        fetch(`/api/faqs/${item.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sort_order: (targetIdx + 1) * 10 }),
        }),
        fetch(`/api/faqs/${other.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sort_order: (index + 1) * 10 }),
        }),
      ]);
      show("Order updated");
    } catch {
      show("Failed to save order");
      await reloadFaqs();
    }
  }

  const activeCount = faqs.filter((f) => f.active).length;
  const draftCount = faqs.length - activeCount;

  return (
    <div className="p-6 lg:p-8 max-w-5xl space-y-6">
      <Toast message={message} />

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <PageHead
          title="Frequently Asked Questions"
          lead={`Knowledge base used by the AI assistant to answer ${labels.customers?.toLowerCase() || "customer"} questions.`}
        />
        {!readOnly && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="quiet" onClick={openSuggestions}>
              💡 Suggest from my top questions
            </Button>
            <Button onClick={() => setShowAdd(!showAdd)}>
              {showAdd ? "Cancel" : "+ Add FAQ"}
            </Button>
          </div>
        )}
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-pine inline-block" />
          <strong className="text-ink">{activeCount}</strong> active
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />
          <strong className="text-ink">{draftCount}</strong> drafts to review
        </span>
      </div>

      {/* Suggest Modal */}
      {showSuggest && (
        <Panel className="border-pine-wash bg-pine-wash/20">
          <div className="flex items-center justify-between pb-3 border-b border-line">
            <div>
              <h3 className="font-semibold text-sm">Top Questions from Customer Conversations</h3>
              <p className="text-xs text-ink-soft mt-0.5">
                Topics gathered from recent chats. Add them as draft FAQs with a single click.
              </p>
            </div>
            <button
              onClick={() => setShowSuggest(false)}
              className="text-xs text-ink-soft hover:text-ink px-2 py-1"
            >
              ✕ Close
            </button>
          </div>

          <div className="pt-4">
            {loadingSuggestions ? (
              <p className="text-sm text-ink-soft py-4">Analyzing customer chats...</p>
            ) : suggestions.length === 0 ? (
              <div className="py-4 text-center">
                <p className="text-sm font-medium">No top questions available yet</p>
                <p className="text-xs text-ink-soft mt-1">
                  Once your WhatsApp assistant receives more conversations, frequent topics and recurring queries will automatically appear here.
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {suggestions.map((s) => (
                  <div
                    key={s.id}
                    className="p-3.5 rounded-lg border border-line bg-panel flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-ink">{s.question}</p>
                        {s.count && (
                          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-canvas text-ink-soft whitespace-nowrap">
                            {s.count} asks
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-ink-soft mt-1.5 line-clamp-2">{s.answer}</p>
                    </div>
                    <div className="pt-3 flex justify-end">
                      <Button
                        className="py-1 px-2.5 text-xs"
                        disabled={busy}
                        onClick={() => addSuggestedFaq(s)}
                      >
                        + Add as draft
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Panel>
      )}

      {/* Add form */}
      {showAdd && !readOnly && (
        <Panel>
          <form onSubmit={createFaq} className="space-y-4">
            <h3 className="font-semibold text-sm">Add New FAQ</h3>
            <Field label="Question" hint="What customers frequently ask">
              <input
                className={inputClass}
                required
                placeholder="e.g. What are your consultation timings?"
                value={draft.question}
                onChange={(e) => setDraft({ ...draft, question: e.target.value })}
              />
            </Field>
            <Field label="Answer" hint="Clear, direct response for the assistant">
              <textarea
                className={`${inputClass} min-h-[90px]`}
                required
                placeholder="e.g. We are open Sunday through Thursday from 9:00 AM to 6:00 PM."
                value={draft.answer}
                onChange={(e) => setDraft({ ...draft, answer: e.target.value })}
              />
            </Field>
            <Field label="Keywords (optional)" hint="Comma-separated synonyms or triggers">
              <input
                className={inputClass}
                placeholder="hours, timings, open, schedule"
                value={draft.keywordsStr}
                onChange={(e) => setDraft({ ...draft, keywordsStr: e.target.value })}
              />
            </Field>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="active_draft"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                className="rounded border-line"
              />
              <label htmlFor="active_draft" className="text-xs text-ink-soft">
                Publish immediately (otherwise saved as draft for review)
              </label>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="quiet" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Saving..." : "Save FAQ"}
              </Button>
            </div>
          </form>
        </Panel>
      )}

      {/* FAQs List */}
      {faqs.length === 0 ? (
        <Panel>
          <Empty title="No FAQs added yet">
            Create frequently asked questions so your WhatsApp assistant can answer clients accurately.
          </Empty>
        </Panel>
      ) : (
        <div className="space-y-3">
          {faqs.map((faq, index) => {
            const isEditing = editingId === faq.id;
            const hasDraftPlaceholder = faq.answer.includes("[ADD ") || faq.question.includes("[ADD ");

            if (isEditing) {
              return (
                <Panel key={faq.id} className="border-pine">
                  <form onSubmit={saveEdit} className="space-y-4">
                    <Field label="Question">
                      <input
                        className={inputClass}
                        required
                        value={editForm.question}
                        onChange={(e) => setEditForm({ ...editForm, question: e.target.value })}
                      />
                    </Field>
                    <Field label="Answer">
                      <textarea
                        className={`${inputClass} min-h-[90px]`}
                        required
                        value={editForm.answer}
                        onChange={(e) => setEditForm({ ...editForm, answer: e.target.value })}
                      />
                    </Field>
                    <Field label="Keywords (comma-separated)">
                      <input
                        className={inputClass}
                        value={editForm.keywordsStr}
                        onChange={(e) => setEditForm({ ...editForm, keywordsStr: e.target.value })}
                      />
                    </Field>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`edit_active_${faq.id}`}
                        checked={editForm.active}
                        onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                      />
                      <label htmlFor={`edit_active_${faq.id}`} className="text-xs text-ink-soft">
                        Active (assistant can use this answer)
                      </label>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="quiet" onClick={() => setEditingId(null)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={busy}>
                        {busy ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  </form>
                </Panel>
              );
            }

            return (
              <Panel key={faq.id} className="p-4 transition-all hover:border-line-deep">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    {/* Ordering controls */}
                    {!readOnly && (
                      <div className="flex flex-col gap-1 pt-0.5">
                        <button
                          type="button"
                          disabled={index === 0}
                          onClick={() => moveFaq(index, "up")}
                          className="text-xs text-ink-soft hover:text-ink disabled:opacity-20 px-1 rounded hover:bg-canvas"
                          title="Move Up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={index === faqs.length - 1}
                          onClick={() => moveFaq(index, "down")}
                          className="text-xs text-ink-soft hover:text-ink disabled:opacity-20 px-1 rounded hover:bg-canvas"
                          title="Move Down"
                        >
                          ▼
                        </button>
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-sm text-ink">{faq.question}</h4>
                        {!faq.active ? (
                          <Tag tone="warn">
                            {hasDraftPlaceholder ? "Review draft & turn on" : "Draft (off)"}
                          </Tag>
                        ) : (
                          <Tag tone="good">Active</Tag>
                        )}
                      </div>

                      <p className="text-sm text-ink-soft mt-1 whitespace-pre-wrap leading-relaxed">
                        {faq.answer}
                      </p>

                      {faq.keywords && faq.keywords.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap mt-2.5">
                          <span className="text-[11px] text-ink-faint">Keywords:</span>
                          {faq.keywords.map((k) => (
                            <span
                              key={k}
                              className="text-[11px] bg-canvas border border-line px-2 py-0.5 rounded text-ink-soft"
                            >
                              {k}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {!readOnly && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        className="py-1 px-2.5 text-xs"
                        variant={faq.active ? "quiet" : "primary"}
                        onClick={() => toggleActive(faq)}
                      >
                        {faq.active ? "Turn Off" : "Turn On"}
                      </Button>
                      <Button className="py-1 px-2.5 text-xs" variant="quiet" onClick={() => startEdit(faq)}>
                        Edit
                      </Button>
                      <Button
                        className="py-1 px-2.5 text-xs"
                        variant="danger"
                        onClick={() => deleteFaq(faq.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}
