"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, inputClass, Panel, PageHead, Tag, Toast, useToast } from "@/components/ui";
import WhatsAppConnect from "../whatsapp/connect";
import { WEEKDAYS } from "@/lib/format";

type Props = {
  tenantId: number;
  isOwner: boolean;
  initialOnboarding: { step: number; completed: boolean; finished_at?: string | null };
  tenant: {
    name: string;
    business_info: string;
    admin_phone: string;
    wa_status: string;
    bot_enabled: boolean;
  };
  initialHours: Array<{ weekday: number; open_time: string; close_time: string; is_closed: boolean }>;
  initialServices: Array<{ id: number; name: string; duration_min: number; price: string | null; active: boolean }>;
  initialFaqs: Array<{ id: number; question: string; answer: string; active: boolean }>;
  labels: Record<string, string>;
  pack: { code: string; name: string };
};

const STEPS = [
  { num: 1, title: "Business Profile", skippable: false },
  { num: 2, title: "Services", skippable: true },
  { num: 3, title: "FAQs", skippable: true },
  { num: 4, title: "Connect WhatsApp", skippable: true },
  { num: 5, title: "Ready to Go Live", skippable: false },
];

export default function OnboardingWizard({
  isOwner,
  initialOnboarding,
  tenant,
  initialHours,
  initialServices,
  initialFaqs,
  labels,
  pack,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<number>(Math.max(1, Math.min(5, initialOnboarding.step || 1)));
  const [busy, setBusy] = useState(false);
  const { message, show } = useToast();

  // Step 1 state
  const [profile, setProfile] = useState({
    business_info: tenant.business_info || "",
    admin_phone: tenant.admin_phone || "",
  });
  const [hours, setHours] = useState(
    Array.from({ length: 7 }, (_, d) =>
      initialHours.find((h) => h.weekday === d) ?? {
        weekday: d,
        open_time: "09:00",
        close_time: "18:00",
        is_closed: d === 5 || d === 6,
      }
    )
  );

  // Step 2 state: services
  const [services, setServices] = useState(initialServices);
  const [newSvc, setNewSvc] = useState({ name: "", duration_min: 30, price: "" });

  // Step 3 state: faqs
  const [faqs, setFaqs] = useState(initialFaqs);

  // Step 5 state: bot toggle
  const [botEnabled, setBotEnabled] = useState(tenant.bot_enabled ?? true);

  async function saveProgress(newStep: number, completed = false) {
    try {
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          step: newStep,
          completed,
          profile: newStep > 1 ? profile : undefined,
        }),
      });
    } catch {
      // ignore non-critical sync errors
    }
  }

  async function saveStep1(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      // 1. Save profile
      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step: 2, profile }),
      });

      // 2. Save hours
      await fetch("/api/hours", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hours }),
      });

      show("Business profile saved");
      setStep(2);
      await saveProgress(2);
    } catch {
      show("Failed to save profile");
    } finally {
      setBusy(false);
    }
  }

  async function addServiceRow() {
    if (!newSvc.name.trim()) return;
    setBusy(true);
    try {
      const res = await fetch("/api/services", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newSvc.name.trim(),
          duration_min: Number(newSvc.duration_min) || 30,
          price: newSvc.price ? Number(newSvc.price) : null,
          currency: "QAR",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setServices((prev) => [
          ...prev,
          {
            id: data.id,
            name: newSvc.name.trim(),
            duration_min: Number(newSvc.duration_min) || 30,
            price: newSvc.price || null,
            active: true,
          },
        ]);
        setNewSvc({ name: "", duration_min: 30, price: "" });
        show("Service added");
      }
    } catch {
      show("Failed to add service");
    } finally {
      setBusy(false);
    }
  }

  async function updateServicePrice(svcId: number, priceStr: string) {
    const val = priceStr === "" ? null : Number(priceStr);
    setServices((prev) => prev.map((s) => (s.id === svcId ? { ...s, price: priceStr } : s)));
    try {
      await fetch(`/api/services/${svcId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ price: val }),
      });
    } catch {
      // ignore
    }
  }

  async function toggleFaqActive(faqId: number, current: boolean) {
    const next = !current;
    setFaqs((prev) => prev.map((f) => (f.id === faqId ? { ...f, active: next } : f)));
    try {
      await fetch(`/api/faqs/${faqId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: next }),
      });
      show(next ? "FAQ activated" : "FAQ set to draft");
    } catch {
      show("Failed to toggle FAQ");
    }
  }

  async function toggleBot(enabled: boolean) {
    setBotEnabled(enabled);
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ bot_enabled: enabled }),
      });
      show(enabled ? "Assistant enabled" : "Assistant paused");
    } catch {
      show("Failed to update bot status");
    }
  }

  async function finishOnboarding() {
    setBusy(true);
    try {
      await saveProgress(5, true);
      show("Workspace onboarding completed! 🎉");
      router.push("/desk");
      router.refresh();
    } catch {
      show("Failed to complete onboarding");
    } finally {
      setBusy(false);
    }
  }

  const activeServicesCount = services.filter((s) => s.active).length;
  const activeFaqCount = faqs.filter((f) => f.active).length;
  const isWaConnected = tenant.wa_status === "connected";

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-8">
      <Toast message={message} />

      {/* Header and Step Progress Bar */}
      <div>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">Welcome to your Workspace</h1>
            <p className="text-sm text-ink-soft mt-1">
              Pack: <strong className="text-ink">{pack.name}</strong> · Let's get your WhatsApp AI live in a few quick steps.
            </p>
          </div>
          <Tag tone="good">Step {step} of 5</Tag>
        </div>

        {/* Progress Tracker */}
        <div className="mt-6 flex items-center justify-between relative">
          <div className="absolute top-1/2 left-0 right-0 h-1 bg-line -translate-y-1/2 z-0" />
          <div
            className="absolute top-1/2 left-0 h-1 bg-pine -translate-y-1/2 transition-all duration-300 z-0"
            style={{ width: `${((step - 1) / (STEPS.length - 1)) * 100}%` }}
          />

          {STEPS.map((s) => {
            const isCompleted = step > s.num;
            const isCurrent = step === s.num;

            return (
              <button
                key={s.num}
                type="button"
                onClick={() => (s.num < step || s.skippable ? setStep(s.num) : null)}
                className={`relative z-10 flex flex-col items-center group cursor-pointer`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                    isCompleted
                      ? "bg-pine text-white"
                      : isCurrent
                      ? "bg-pine text-white ring-4 ring-pine-wash"
                      : "bg-panel border border-line text-ink-soft"
                  }`}
                >
                  {isCompleted ? "✓" : s.num}
                </div>
                <span
                  className={`text-[11px] mt-1.5 hidden sm:inline whitespace-nowrap ${
                    isCurrent ? "font-semibold text-pine" : "text-ink-soft"
                  }`}
                >
                  {s.title}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 1: Business Profile */}
      {step === 1 && (
        <Panel>
          <form onSubmit={saveStep1} className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-ink">Step 1: Business Profile & Hours</h2>
              <p className="text-xs text-ink-soft mt-1">
                Tell your assistant about your location, services, and operating hours.
              </p>
            </div>

            <Field label="Business name">
              <input className={inputClass} value={tenant.name} disabled />
            </Field>

            <Field
              label="Business description & location details"
              hint="Address, landmark, website, or policies the AI should know."
            >
              <textarea
                className={`${inputClass} min-h-[90px]`}
                placeholder="e.g. Located on Al Sadd St, Doha. We offer clinical consultations and routine health checkups. Valet parking available."
                value={profile.business_info}
                onChange={(e) => setProfile({ ...profile, business_info: e.target.value })}
              />
            </Field>

            <Field
              label="Alerts phone number"
              hint="Country code + digits. Staff handovers and urgent alerts go here."
            >
              <input
                className={`${inputClass} tabular`}
                placeholder="97430000000"
                value={profile.admin_phone}
                onChange={(e) => setProfile({ ...profile, admin_phone: e.target.value })}
              />
            </Field>

            {/* Operating Hours prefilled */}
            <div>
              <h3 className="text-sm font-semibold text-ink mb-3">Operating Hours (prefilled from pack)</h3>
              <div className="space-y-2 border border-line rounded-lg p-3 bg-canvas/30">
                {hours.map((h, i) => (
                  <div key={h.weekday} className="flex items-center justify-between text-xs py-1">
                    <span className="w-24 font-medium text-ink">{WEEKDAYS[h.weekday]}</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 cursor-pointer text-ink-soft">
                        <input
                          type="checkbox"
                          checked={h.is_closed}
                          onChange={(e) => {
                            const nh = [...hours];
                            nh[i].is_closed = e.target.checked;
                            setHours(nh);
                          }}
                          className="rounded border-line"
                        />
                        Closed
                      </label>
                      {!h.is_closed && (
                        <div className="flex items-center gap-1">
                          <input
                            type="time"
                            className="border border-line rounded px-1.5 py-0.5 bg-panel text-xs"
                            value={h.open_time}
                            onChange={(e) => {
                              const nh = [...hours];
                              nh[i].open_time = e.target.value;
                              setHours(nh);
                            }}
                          />
                          <span>–</span>
                          <input
                            type="time"
                            className="border border-line rounded px-1.5 py-0.5 bg-panel text-xs"
                            value={h.close_time}
                            onChange={(e) => {
                              const nh = [...hours];
                              nh[i].close_time = e.target.value;
                              setHours(nh);
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={busy}>
                {busy ? "Saving..." : "Save & Continue to Services →"}
              </Button>
            </div>
          </form>
        </Panel>
      )}

      {/* Step 2: Services */}
      {step === 2 && (
        <Panel className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-ink">
                Step 2: Review {labels.services || "Services"}
              </h2>
              <p className="text-xs text-ink-soft mt-1">
                Starter services seeded for your business type. Set durations and prices (QAR).
              </p>
            </div>
            <Button
              variant="quiet"
              className="py-1 px-2.5 text-xs"
              onClick={() => {
                setStep(3);
                saveProgress(3);
              }}
            >
              Skip for now →
            </Button>
          </div>

          <div className="space-y-2.5">
            {services.map((svc) => (
              <div
                key={svc.id}
                className="p-3.5 rounded-lg border border-line bg-panel flex items-center justify-between gap-4 flex-wrap"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-ink">{svc.name}</p>
                  <p className="text-xs text-ink-soft">{svc.duration_min} minutes</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-ink-soft">Price (QAR):</span>
                  <input
                    type="number"
                    placeholder="e.g. 150"
                    defaultValue={svc.price || ""}
                    onBlur={(e) => updateServicePrice(svc.id, e.target.value)}
                    className="w-24 px-2 py-1 text-xs border border-line rounded bg-canvas focus:bg-panel text-right font-mono"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Quick add service */}
          <div className="p-3 border border-dashed border-line rounded-lg bg-canvas/30 space-y-3">
            <h4 className="text-xs font-semibold text-ink">+ Add custom {labels.service?.toLowerCase() || "service"}</h4>
            <div className="grid sm:grid-cols-3 gap-2">
              <input
                className={`${inputClass} text-xs`}
                placeholder="Service name"
                value={newSvc.name}
                onChange={(e) => setNewSvc({ ...newSvc, name: e.target.value })}
              />
              <input
                type="number"
                className={`${inputClass} text-xs`}
                placeholder="Duration (minutes)"
                value={newSvc.duration_min}
                onChange={(e) => setNewSvc({ ...newSvc, duration_min: Number(e.target.value) })}
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  className={`${inputClass} text-xs`}
                  placeholder="Price QAR"
                  value={newSvc.price}
                  onChange={(e) => setNewSvc({ ...newSvc, price: e.target.value })}
                />
                <Button className="py-1 px-2.5 text-xs" type="button" onClick={addServiceRow} disabled={busy || !newSvc.name.trim()}>
                  Add
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button variant="quiet" onClick={() => setStep(1)}>
              ← Back
            </Button>
            <Button
              onClick={() => {
                setStep(3);
                saveProgress(3);
              }}
            >
              Continue to FAQs →
            </Button>
          </div>
        </Panel>
      )}

      {/* Step 3: FAQs */}
      {step === 3 && (
        <Panel className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-ink">Step 3: Review FAQs</h2>
              <p className="text-xs text-ink-soft mt-1">
                Starter draft questions seeded for your pack. Turn on the ones you want active.
              </p>
            </div>
            <Button
              variant="quiet"
              className="py-1 px-2.5 text-xs"
              onClick={() => {
                setStep(4);
                saveProgress(4);
              }}
            >
              Skip for now →
            </Button>
          </div>

          <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
            {faqs.map((faq) => {
              const hasPlaceholder = faq.answer.includes("[ADD ") || faq.question.includes("[ADD ");
              return (
                <div
                  key={faq.id}
                  className="p-3.5 rounded-lg border border-line bg-panel flex items-start justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-ink">{faq.question}</p>
                      {!faq.active ? (
                        <Tag tone="warn">{hasPlaceholder ? "Needs details" : "Draft (off)"}</Tag>
                      ) : (
                        <Tag tone="good">Active</Tag>
                      )}
                    </div>
                    <p className="text-xs text-ink-soft mt-1 leading-relaxed">{faq.answer}</p>
                  </div>
                  <Button
                    className="py-1 px-2.5 text-xs"
                    variant={faq.active ? "quiet" : "primary"}
                    onClick={() => toggleFaqActive(faq.id, faq.active)}
                  >
                    {faq.active ? "Turn Off" : "Turn On"}
                  </Button>
                </div>
              );
            })}
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button variant="quiet" onClick={() => setStep(2)}>
              ← Back
            </Button>
            <Button
              onClick={() => {
                setStep(4);
                saveProgress(4);
              }}
            >
              Continue to Connect WhatsApp →
            </Button>
          </div>
        </Panel>
      )}

      {/* Step 4: Connect WhatsApp */}
      {step === 4 && (
        <Panel className="space-y-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-semibold text-ink">Step 4: Connect WhatsApp Number</h2>
              <p className="text-xs text-ink-soft mt-1">
                Link your WhatsApp account so your AI assistant can start answering incoming messages.
              </p>
            </div>
            <Button
              variant="quiet"
              className="py-1 px-2.5 text-xs"
              onClick={() => {
                setStep(5);
                saveProgress(5);
              }}
            >
              Skip for now →
            </Button>
          </div>

          <div className="border border-line rounded-lg p-5 bg-canvas/30">
            <WhatsAppConnect readOnly={!isOwner} />
          </div>

          <div className="flex justify-between items-center pt-2">
            <Button variant="quiet" onClick={() => setStep(3)}>
              ← Back
            </Button>
            <Button
              onClick={() => {
                setStep(5);
                saveProgress(5);
              }}
            >
              Continue to Go-Live Checklist →
            </Button>
          </div>
        </Panel>
      )}

      {/* Step 5: Checklist "Ready to go live" */}
      {step === 5 && (
        <Panel className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold text-ink">Step 5: Ready to Go Live Checklist</h2>
            <p className="text-xs text-ink-soft mt-1">
              Verify your setup items before turning your assistant on for real customers.
            </p>
          </div>

          <div className="space-y-3">
            {/* 1. WhatsApp connected */}
            <div className="p-4 rounded-lg border border-line bg-panel flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  isWaConnected ? "bg-pine text-white" : "bg-amber-500 text-white"
                }`}>
                  {isWaConnected ? "✓" : "!"}
                </span>
                <div>
                  <h4 className="font-semibold text-sm text-ink">WhatsApp Number Connected</h4>
                  <p className="text-xs text-ink-soft">
                    {isWaConnected
                      ? "Phone is connected and listening for messages."
                      : "Scan QR code to link your business phone number."}
                  </p>
                </div>
              </div>
              {!isWaConnected && (
                <Button className="py-1 px-2.5 text-xs" variant="quiet" onClick={() => setStep(4)}>
                  Connect Now
                </Button>
              )}
            </div>

            {/* 2. At least 1 service */}
            <div className="p-4 rounded-lg border border-line bg-panel flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  activeServicesCount >= 1 ? "bg-pine text-white" : "bg-amber-500 text-white"
                }`}>
                  {activeServicesCount >= 1 ? "✓" : "!"}
                </span>
                <div>
                  <h4 className="font-semibold text-sm text-ink">At least 1 Service Configured</h4>
                  <p className="text-xs text-ink-soft">
                    {activeServicesCount} {labels.services?.toLowerCase() || "services"} available for booking.
                  </p>
                </div>
              </div>
              {activeServicesCount < 1 && (
                <Button className="py-1 px-2.5 text-xs" variant="quiet" onClick={() => setStep(2)}>
                  Add Service
                </Button>
              )}
            </div>

            {/* 3. At least 3 active FAQs */}
            <div className="p-4 rounded-lg border border-line bg-panel flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  activeFaqCount >= 3 ? "bg-pine text-white" : "bg-amber-500 text-white"
                }`}>
                  {activeFaqCount >= 3 ? "✓" : "!"}
                </span>
                <div>
                  <h4 className="font-semibold text-sm text-ink">At least 3 Active FAQs</h4>
                  <p className="text-xs text-ink-soft">
                    {activeFaqCount >= 3
                      ? `${activeFaqCount} active FAQs ready to answer customer queries.`
                      : `${activeFaqCount} of 3 active FAQs — review and turn on 3 questions.`}
                  </p>
                </div>
              </div>
              {activeFaqCount < 3 && (
                <Button className="py-1 px-2.5 text-xs" variant="quiet" onClick={() => setStep(3)}>
                  Review FAQs
                </Button>
              )}
            </div>

            {/* 4. Bot on toggle */}
            <div className="p-4 rounded-lg border border-line bg-panel flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  botEnabled ? "bg-pine text-white" : "bg-line text-ink-soft"
                }`}>
                  {botEnabled ? "✓" : "○"}
                </span>
                <div>
                  <h4 className="font-semibold text-sm text-ink">AI Assistant Bot Active</h4>
                  <p className="text-xs text-ink-soft">
                    {botEnabled
                      ? "The bot is enabled and will automatically reply to incoming chats."
                      : "The bot is currently paused — incoming chats will wait for staff."}
                  </p>
                </div>
              </div>
              <Button
                className="py-1 px-2.5 text-xs"
                variant={botEnabled ? "quiet" : "primary"}
                onClick={() => toggleBot(!botEnabled)}
              >
                {botEnabled ? "Pause Bot" : "Turn On Bot"}
              </Button>
            </div>
          </div>

          <div className="pt-4 flex justify-between items-center">
            <Button variant="quiet" onClick={() => setStep(4)}>
              ← Back
            </Button>
            <Button
              className="bg-pine text-white font-semibold px-6 py-2"
              onClick={finishOnboarding}
              disabled={busy}
            >
              {busy ? "Finishing..." : "Complete Setup & Launch Dashboard →"}
            </Button>
          </div>
        </Panel>
      )}
    </div>
  );
}
