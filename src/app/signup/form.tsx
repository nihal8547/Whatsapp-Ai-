"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, inputClass, Panel } from "@/components/ui";

const ZONES = [
  "Asia/Qatar",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Kuwait",
  "Asia/Kolkata",
  "Europe/London",
];

export default function SignupForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    business: "",
    fullName: "",
    email: "",
    password: "",
    adminPhone: "",
    timezone: "Asia/Qatar",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok) {
      setError(
        data.error === "email_taken"
          ? "That email already has a workspace. Sign in instead."
          : "We couldn't create the workspace. Try again in a moment."
      );
      return;
    }
    router.push("/whatsapp");
    router.refresh();
  }

  return (
    <Panel className="mt-7">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Business name">
          <input className={inputClass} required value={form.business} onChange={set("business")} />
        </Field>
        <Field label="Your name">
          <input className={inputClass} required value={form.fullName} onChange={set("fullName")} />
        </Field>
        <Field label="Email">
          <input className={inputClass} type="email" required value={form.email} onChange={set("email")} />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <input
            className={inputClass}
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={set("password")}
          />
        </Field>
        <Field
          label="Your WhatsApp number"
          hint="Country code, digits only. Handover alerts go here."
        >
          <input
            className={`${inputClass} tabular`}
            required
            placeholder="97430000000"
            value={form.adminPhone}
            onChange={set("adminPhone")}
          />
        </Field>
        <Field label="Time zone">
          <select className={inputClass} value={form.timezone} onChange={set("timezone")}>
            {ZONES.map((z) => (
              <option key={z}>{z}</option>
            ))}
          </select>
        </Field>
        {error && <p className="text-sm text-brick">{error}</p>}
        <Button type="submit" disabled={busy} className="w-full">
          {busy ? "Creating…" : "Create workspace"}
        </Button>
        <p className="text-xs text-ink-soft">Includes a 14 day trial. No card needed.</p>
      </form>
    </Panel>
  );
}
