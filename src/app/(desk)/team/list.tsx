"use client";

import { useState } from "react";
import { Button, Field, inputClass, Panel, PageHead, Tag, Toast, useToast } from "@/components/ui";

type Member = { id: number; email: string; full_name: string; role: string };

export default function TeamList({
  initial,
  meId,
  readOnly,
}: {
  initial: Member[];
  meId: number;
  readOnly: boolean;
}) {
  const [members, setMembers] = useState(initial);
  const [draft, setDraft] = useState({ full_name: "", email: "", password: "", role: "staff" });
  const [busy, setBusy] = useState(false);
  const { message, show } = useToast();

  async function refresh() {
    const res = await fetch("/api/team");
    const data = await res.json();
    if (data.ok) setMembers(data.members);
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/team", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      show(data.error === "email_taken" ? "That email is already in use." : "Could not add them.");
      return;
    }
    setDraft({ full_name: "", email: "", password: "", role: "staff" });
    refresh();
    show("Team member added");
  }

  async function remove(id: number) {
    if (!confirm("Remove this person's access?")) return;
    const res = await fetch(`/api/team/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.ok) return show("Could not remove them.");
    refresh();
    show("Access removed");
  }

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <PageHead title="Team" lead="Who can read chats and reply from this workspace." />

      <Panel pad={false} className="mb-5">
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium">{m.full_name || m.email}</p>
                  <Tag tone={m.role === "owner" ? "good" : "neutral"}>{m.role}</Tag>
                  {m.id === meId && <Tag tone="neutral">you</Tag>}
                </div>
                <p className="text-sm text-ink-soft truncate">{m.email}</p>
              </div>
              {!readOnly && m.role !== "owner" && m.id !== meId && (
                <Button variant="danger" onClick={() => remove(m.id)}>
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      {!readOnly && (
        <Panel>
          <h2 className="font-semibold mb-4">Add someone</h2>
          <form onSubmit={add} className="grid sm:grid-cols-2 gap-4">
            <Field label="Name">
              <input
                className={inputClass}
                value={draft.full_name}
                onChange={(e) => setDraft({ ...draft, full_name: e.target.value })}
              />
            </Field>
            <Field label="Email">
              <input
                className={inputClass}
                type="email"
                required
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              />
            </Field>
            <Field label="Temporary password" hint="At least 8 characters. They can change it later.">
              <input
                className={inputClass}
                type="text"
                required
                minLength={8}
                value={draft.password}
                onChange={(e) => setDraft({ ...draft, password: e.target.value })}
              />
            </Field>
            <Field label="Access level" hint="Staff can reply; admins can also change settings.">
              <select
                className={inputClass}
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Adding…" : "Add to team"}
              </Button>
            </div>
          </form>
        </Panel>
      )}
      <Toast message={message} />
    </div>
  );
}
