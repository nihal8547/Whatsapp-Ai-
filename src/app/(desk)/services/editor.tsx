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
    refresh();
    show("Service saved");
  }

  async function retire(id: number) {
    await fetch(`/api/services/${id}`, { method: "DELETE" });
    refresh();
    show("Service hidden from the assistant");
  }

  async function restore(id: number) {
    await fetch(`/api/services/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: true }),
    });
    refresh();
    show("Service is live again");
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
    show(data.ok ? "Opening hours saved" : "Could not save the hours.");
  }

  return (
    <div className="p-6 lg:p-8 max-w-3xl">
      <PageHead
        title="Services & hours"
        lead="The assistant only offers what is listed here, and only inside these hours."
      />

      <Panel className="mb-5">
        <h2 className="font-semibold mb-4">Services</h2>
        {services.length === 0 ? (
          <p className="text-sm text-ink-soft mb-4">
            Nothing listed yet. Add your first service below so customers can book.
          </p>
        ) : (
          <ul className="divide-y divide-line mb-5 -mx-5">
            {services.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium">{s.name}</p>
                    {!s.active && <Tag tone="neutral">hidden</Tag>}
                  </div>
                  <p className="text-sm text-ink-soft">
                    <span className="tabular">{s.duration_min}</span> min
                    {s.price ? ` · ${s.currency} ${s.price}` : " · quoted per request"}
                  </p>
                  {s.description && <p className="text-sm text-ink-soft">{s.description}</p>}
                </div>
                {!readOnly &&
                  (s.active ? (
                    <Button variant="quiet" onClick={() => retire(s.id)}>
                      Hide
                    </Button>
                  ) : (
                    <Button variant="quiet" onClick={() => restore(s.id)}>
                      Show
                    </Button>
                  ))}
              </li>
            ))}
          </ul>
        )}

        {!readOnly && (
          <form onSubmit={addService} className="grid sm:grid-cols-2 gap-4 border-t border-line pt-5">
            <Field label="Service name">
              <input
                className={inputClass}
                required
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
                value={draft.price}
                onChange={(e) => setDraft({ ...draft, price: e.target.value })}
              />
            </Field>
            <Field label="Short description">
              <input
                className={inputClass}
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
        <h2 className="font-semibold mb-4">Opening hours</h2>
        <div className="space-y-2">
          {hours.map((h, i) => (
            <div key={h.weekday} className="flex items-center gap-3 flex-wrap">
              <span className="w-24 text-sm">{WEEKDAYS[h.weekday]}</span>
              <label className="flex items-center gap-2 text-sm text-ink-soft">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={h.is_closed}
                  onChange={(e) => {
                    const next = [...hours];
                    next[i] = { ...h, is_closed: e.target.checked };
                    setHours(next);
                  }}
                />
                Closed
              </label>
              {!h.is_closed && (
                <>
                  <input
                    type="time"
                    disabled={readOnly}
                    value={h.open_time}
                    onChange={(e) => {
                      const next = [...hours];
                      next[i] = { ...h, open_time: e.target.value };
                      setHours(next);
                    }}
                    className="rounded-md border border-line px-2 py-1 text-sm tabular"
                  />
                  <span className="text-ink-faint text-sm">to</span>
                  <input
                    type="time"
                    disabled={readOnly}
                    value={h.close_time}
                    onChange={(e) => {
                      const next = [...hours];
                      next[i] = { ...h, close_time: e.target.value };
                      setHours(next);
                    }}
                    className="rounded-md border border-line px-2 py-1 text-sm tabular"
                  />
                </>
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
