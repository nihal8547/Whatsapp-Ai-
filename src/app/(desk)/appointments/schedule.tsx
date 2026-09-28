"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Field, inputClass, Panel, PageHead, Tag, Toast, useToast, Empty } from "@/components/ui";
import { clock, dayStamp } from "@/lib/format";

type Appt = {
  id: number;
  phone: string;
  customer_name: string;
  service: string;
  start_time: string;
  status: string;
  notes: string;
  source: string;
};

export default function Schedule({
  tz,
  services,
}: {
  tz: string;
  services: { id: number; name: string; duration_min: number }[];
}) {
  const [scope, setScope] = useState<"upcoming" | "past">("upcoming");
  const [rows, setRows] = useState<Appt[]>([]);
  const [adding, setAdding] = useState(false);
  const { message, show } = useToast();

  const load = useCallback(async () => {
    const res = await fetch(`/api/appointments?scope=${scope}`);
    const data = await res.json();
    if (data.ok) setRows(data.appointments);
  }, [scope]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(id: number, status: string) {
    await fetch(`/api/appointments/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    });
    show(status === "cancelled" ? "Appointment cancelled" : `Marked ${status.replace("_", " ")}`);
    load();
  }

  const grouped = rows.reduce<Record<string, Appt[]>>((acc, r) => {
    const key = dayStamp(r.start_time, tz);
    (acc[key] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div className="p-6 lg:p-8 max-w-5xl">
      <PageHead
        title="Appointments"
        lead="Everything the assistant booked, plus anything you add by hand."
        action={<Button onClick={() => setAdding(!adding)}>{adding ? "Close" : "Add appointment"}</Button>}
      />

      {adding && (
        <AddForm
          services={services}
          onDone={() => {
            setAdding(false);
            setScope("upcoming");
            load();
            show("Appointment added");
          }}
          onError={show}
        />
      )}

      <div className="flex gap-1 mb-4">
        {(["upcoming", "past"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={`px-3 py-1.5 rounded text-sm font-medium ${
              scope === s ? "bg-pine-wash text-pine-deep" : "text-ink-soft hover:bg-canvas"
            }`}
          >
            {s === "upcoming" ? "Upcoming" : "Past"}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Panel>
          <Empty title={scope === "upcoming" ? "Nothing booked yet" : "No past appointments"}>
            {scope === "upcoming"
              ? "When a customer books over WhatsApp, it shows up here."
              : "Completed and cancelled appointments will collect here."}
          </Empty>
        </Panel>
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([day, items]) => (
            <div key={day}>
              <h2 className="text-sm font-semibold text-ink-soft mb-2">{day}</h2>
              <Panel pad={false}>
                <ul className="divide-y divide-line">
                  {items.map((a) => (
                    <li key={a.id} className="px-5 py-4 flex flex-wrap gap-3 items-start">
                      <span className="tabular text-sm w-14 shrink-0 pt-0.5">
                        {clock(a.start_time, tz)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium">{a.customer_name || "Unknown"}</p>
                          {a.status !== "confirmed" && (
                            <Tag tone={a.status === "cancelled" ? "bad" : "neutral"}>{a.status}</Tag>
                          )}
                          {a.source === "dashboard" && <Tag tone="neutral">added by you</Tag>}
                        </div>
                        <p className="text-sm text-ink-soft">{a.service}</p>
                        <Link
                          href={`/chats?phone=${a.phone}`}
                          className="text-sm text-pine hover:underline tabular"
                        >
                          +{a.phone}
                        </Link>
                        {a.notes && <p className="text-sm text-ink-soft mt-1">{a.notes}</p>}
                      </div>
                      {a.status === "confirmed" && (
                        <div className="flex gap-2 shrink-0">
                          <Button variant="quiet" onClick={() => setStatus(a.id, "completed")}>
                            Done
                          </Button>
                          <Button variant="danger" onClick={() => setStatus(a.id, "cancelled")}>
                            Cancel
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          ))}
        </div>
      )}
      <Toast message={message} />
    </div>
  );
}

function AddForm({
  services,
  onDone,
  onError,
}: {
  services: { id: number; name: string }[];
  onDone: () => void;
  onError: (m: string) => void;
}) {
  const [f, setF] = useState({
    phone: "",
    customer_name: "",
    service_id: services[0]?.id ?? 0,
    start_time: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(f),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      onError(
        data.error === "slot_taken"
          ? "That time is already booked. Pick another."
          : "Could not add the appointment."
      );
      return;
    }
    onDone();
  }

  if (services.length === 0) {
    return (
      <Panel className="mb-5">
        <p className="text-sm">
          Add a service first on the Services page — every appointment needs one.
        </p>
      </Panel>
    );
  }

  return (
    <Panel className="mb-5">
      <form onSubmit={submit} className="grid sm:grid-cols-2 gap-4">
        <Field label="WhatsApp number" hint="Country code, digits only.">
          <input
            className={`${inputClass} tabular`}
            required
            value={f.phone}
            onChange={(e) => setF({ ...f, phone: e.target.value })}
          />
        </Field>
        <Field label="Customer name">
          <input
            className={inputClass}
            value={f.customer_name}
            onChange={(e) => setF({ ...f, customer_name: e.target.value })}
          />
        </Field>
        <Field label="Service">
          <select
            className={inputClass}
            value={f.service_id}
            onChange={(e) => setF({ ...f, service_id: Number(e.target.value) })}
          >
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Starts at" hint="Your business time zone.">
          <input
            className={inputClass}
            type="datetime-local"
            required
            value={f.start_time}
            onChange={(e) => setF({ ...f, start_time: e.target.value })}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Note">
            <input
              className={inputClass}
              value={f.notes}
              onChange={(e) => setF({ ...f, notes: e.target.value })}
            />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Adding…" : "Add appointment"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
