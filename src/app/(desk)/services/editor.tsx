"use client";

import { useState } from "react";
import { Button, Field, inputClass, Panel, PageHead, Tag, Toast, useToast } from "@/components/ui";
import { WEEKDAYS } from "@/lib/format";

type Service = {
  id: number;
  name: string;
  description: string;
  duration_min: number;
  price: string | null;
  currency: string;
  active: boolean;
};
type Hour = { weekday: number; open_time: string; close_time: string; is_closed: boolean };

export default function ServicesEditor({
  initialServices,
  initialHours,
  readOnly,
}: {
  initialServices: Service[];
  initialHours: Hour[];
  readOnly: boolean;
}) {
  const [services, setServices] = useState(initialServices);
  const [hours, setHours] = useState<Hour[]>(
    Array.from({ length: 7 }, (_, d) =>
      initialHours.find((h) => h.weekday === d) ?? {
        weekday: d,
        open_time: "09:00",
        close_time: "18:00",
        is_closed: false,
      }
    )
  );

  const [draft, setDraft] = useState({ name: "", duration_min: 30, price: "", description: "" });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    duration_min: 30,
    price: "",
    description: "",
    active: true,
  });
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingHours, setSavingHours] = useState(false);
  const { message, show } = useToast();

  async function refresh() {
    const res = await fetch("/api/services");
    const data = await res.json();
    if (data.ok) setServices(data.services);
  }

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/services", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await res.json();
    if (!data.ok) return show("Could not save that service.");
    setDraft({ name: "", duration_min: 30, price: "", description: "" });
    await refresh();
    show("Service added successfully.");
  }

  function startEdit(s: Service) {
    setEditingId(s.id);
    setEditForm({
      name: s.name,
      duration_min: s.duration_min,
      price: s.price ?? "",
      description: s.description ?? "",
      active: s.active,
    });
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: number) {
    if (!editForm.name.trim()) return show("Service name is required.");
    setSavingEdit(true);
    const res = await fetch(`/api/services/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setSavingEdit(false);
    const data = await res.json();
    if (!data.ok) return show("Could not update service.");
    setEditingId(null);
    await refresh();
    show("Service updated successfully.");
  }

  async function deleteService(s: Service) {
    if (!confirm(`Are you sure you want to permanently delete "${s.name}"? This action cannot be undone.`)) {
      return;
    }
    const res = await fetch(`/api/services/${s.id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.ok) return show("Could not delete service.");
    await refresh();
    show("Service deleted successfully.");
  }

  async function toggleActive(s: Service) {
    const res = await fetch(`/api/services/${s.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !s.active }),
    });
    const data = await res.json();
    if (!data.ok) return show("Could not update service status.");
    await refresh();
    show(s.active ? "Service disabled." : "Service enabled and active.");
  }

  async function saveHours() {
    setSavingHours(true);
    const res = await fetch("/api/hours", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ hours }),
    });
    const data = await res.json();
    setSavingHours(false);
    show(data.ok ? "Opening hours saved." : "Could not save the hours.");
  }

  function applyPresetHours(preset: "standard" | "all_week") {
    if (readOnly) return;
    if (preset === "standard") {
      // Mon-Fri (1-5) 09:00-18:00, Sat-Sun (6, 0) closed
      setHours(
        hours.map((h) => ({
          ...h,
          open_time: "09:00",
          close_time: "18:00",
          is_closed: h.weekday === 0 || h.weekday === 6,
        }))
      );
    } else {
      // All days 09:00-21:00
      setHours(
        hours.map((h) => ({
          ...h,
          open_time: "09:00",
          close_time: "21:00",
          is_closed: false,
        }))
      );
    }
    show("Preset applied. Click 'Save opening hours' to persist.");
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <PageHead
        title="Services & hours"
        lead="The assistant only offers what is listed here, and only inside these hours."
      />

      <Panel className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-lg">Services</h2>
          <span className="text-xs text-ink-soft">
            {services.length} {services.length === 1 ? "service" : "services"} listed
          </span>
        </div>

        {services.length === 0 ? (
          <p className="text-sm text-ink-soft mb-4">
            Nothing listed yet. Add your first service below so customers can book.
          </p>
        ) : (
          <ul className="divide-y divide-line mb-5 -mx-5">
            {services.map((s) => (
              <li key={s.id} className="px-5 py-3.5">
                {editingId === s.id ? (
                  /* ── Inline Edit Mode ── */
                  <div className="bg-canvas border border-line rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-ink">Edit service</p>
                      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editForm.active}
                          onChange={(e) => setEditForm({ ...editForm, active: e.target.checked })}
                          className="rounded border-line"
                        />
                        <span>{editForm.active ? "Active" : "Disabled"}</span>
                      </label>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                      <Field label="Service name">
                        <input
                          className={inputClass}
                          required
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      </Field>
                      <Field label="Length in minutes">
                        <input
                          className={`${inputClass} tabular`}
                          type="number"
                          min={5}
                          step={5}
                          value={editForm.duration_min}
                          onChange={(e) =>
                            setEditForm({ ...editForm, duration_min: Number(e.target.value) })
                          }
                        />
                      </Field>
                      <Field label="Price" hint="Leave empty if quoted per request.">
                        <input
                          className={`${inputClass} tabular`}
                          placeholder="e.g. 150"
                          value={editForm.price}
                          onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                        />
                      </Field>
                      <Field label="Short description">
                        <input
                          className={inputClass}
                          placeholder="Brief description for customer"
                          value={editForm.description}
                          onChange={(e) =>
                            setEditForm({ ...editForm, description: e.target.value })
                          }
                        />
                      </Field>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-line/60">
                      <Button variant="quiet" className="text-xs" onClick={cancelEdit}>
                        Cancel
                      </Button>
                      <Button
                        className="text-xs"
                        disabled={savingEdit}
                        onClick={() => saveEdit(s.id)}
                      >
                        {savingEdit ? "Saving…" : "Save changes"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* ── Normal View Mode ── */
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-ink">{s.name}</p>
                        <Tag tone={s.active ? "good" : "neutral"}>
                          {s.active ? "Active" : "Disabled"}
                        </Tag>
                      </div>
                      <p className="text-sm text-ink-soft mt-0.5">
                        <span className="tabular">{s.duration_min}</span> min
                        {s.price ? ` · ${s.currency} ${s.price}` : " · quoted per request"}
                      </p>
                      {s.description && (
                        <p className="text-xs text-ink-soft mt-1 line-clamp-2">{s.description}</p>
                      )}
                    </div>

                    {!readOnly && (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <Button
                          variant="quiet"
                          className="text-xs px-2.5 py-1"
                          onClick={() => startEdit(s)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="quiet"
                          className={`text-xs px-2.5 py-1 ${
                            s.active
                              ? "text-ink-soft hover:text-ink"
                              : "text-emerald-500 hover:text-emerald-600 font-medium"
                          }`}
                          onClick={() => toggleActive(s)}
                        >
                          {s.active ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          variant="quiet"
                          className="text-xs px-2.5 py-1 text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 font-medium"
                          onClick={() => deleteService(s)}
                        >
                          Delete
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        {!readOnly && (
          <form onSubmit={addService} className="grid sm:grid-cols-2 gap-4 border-t border-line pt-5">
            <h3 className="sm:col-span-2 text-sm font-semibold text-ink">Add a new service</h3>
            <Field label="Service name">
              <input
                className={inputClass}
                required
                placeholder="e.g. VIP Consultation"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field label="Length in minutes">
              <input
                className={`${inputClass} tabular`}
                type="number"
                min={5}
                step={5}
                value={draft.duration_min}
                onChange={(e) => setDraft({ ...draft, duration_min: Number(e.target.value) })}
              />
            </Field>
            <Field label="Price" hint="Leave empty if you quote per request.">
              <input
                className={`${inputClass} tabular`}
                placeholder="e.g. 200"
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
            </Field>
            <Field label="Short description">
              <input
                className={inputClass}
                placeholder="Brief summary shown in WhatsApp"
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit">Save service</Button>
            </div>
          </form>
        )}
      </Panel>

      <Panel>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-semibold text-lg">Opening hours</h2>
          {!readOnly && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => applyPresetHours("standard")}
                className="text-xs text-pine hover:underline"
              >
                Mon–Fri standard
              </button>
              <span className="text-ink-faint text-xs">·</span>
              <button
                type="button"
                onClick={() => applyPresetHours("all_week")}
                className="text-xs text-pine hover:underline"
              >
                All week open
              </button>
            </div>
          )}
        </div>

        <div className="space-y-2.5">
          {hours.map((h, i) => (
            <div
              key={h.weekday}
              className={`flex items-center gap-3 flex-wrap p-2 rounded-md transition ${
                h.is_closed ? "bg-canvas/40 opacity-70" : "bg-panel"
              }`}
            >
              <span className="w-24 text-sm font-medium">{WEEKDAYS[h.weekday]}</span>
              <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={h.is_closed}
                  onChange={(e) => {
                    const next = [...hours];
                    next[i] = { ...h, is_closed: e.target.checked };
                    setHours(next);
                  }}
                  className="rounded border-line"
                />
                Closed
              </label>
              {!h.is_closed && (
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    disabled={readOnly}
                    value={h.open_time}
                    onChange={(e) => {
                      const next = [...hours];
                      next[i] = { ...h, open_time: e.target.value };
                      setHours(next);
                    }}
                    className="rounded-md border border-line bg-canvas px-2.5 py-1 text-sm tabular focus:border-pine focus:outline-none"
                  />
                  <span className="text-ink-faint text-xs">to</span>
                  <input
                    type="time"
                    disabled={readOnly}
                    value={h.close_time}
                    onChange={(e) => {
                      const next = [...hours];
                      next[i] = { ...h, close_time: e.target.value };
                      setHours(next);
                    }}
                    className="rounded-md border border-line bg-canvas px-2.5 py-1 text-sm tabular focus:border-pine focus:outline-none"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {!readOnly && (
          <Button onClick={saveHours} disabled={savingHours} className="mt-5">
            {savingHours ? "Saving…" : "Save opening hours"}
          </Button>
        )}
      </Panel>

      <Toast message={message} />
    </div>
  );
}
