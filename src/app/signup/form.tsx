"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, inputClass, Panel } from "@/components/ui";
import { CheckIcon, ArrowRightIcon } from "@/components/icons";
import type { PlanItem } from "./page";

const ZONES = [
  "Asia/Qatar",
  "Asia/Dubai",
  "Asia/Riyadh",
  "Asia/Kuwait",
  "Asia/Kolkata",
  "Europe/London",
];

const BUSINESS_TYPES = [
  { id: "clinic", label: "Clinic / Hospital" },
  { id: "travels", label: "Travels & Tours" },
  { id: "hostel", label: "Hostel / Hotel" },
  { id: "realestate", label: "Real Estate" },
  { id: "grocery", label: "Grocery / Supermarket" },
  { id: "tech", label: "Technical Company / IT Agency" },
  { id: "restaurant", label: "Restaurant / Cafe" },
  { id: "education", label: "Education / Coaching" },
  { id: "retail", label: "Retail / E-commerce" },
  { id: "salon", label: "Salons / Spas" },
  { id: "other", label: "Other" },
];

export default function SignupForm({ initialPlans = [] }: { initialPlans?: PlanItem[] }) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);
  const [form, setForm] = useState({
    business: "",
    fullName: "",
    email: "",
    password: "",
    adminPhone: "",
    timezone: "Asia/Qatar",
    businessType: "other",
    planId: 1, // Default to Plan 1 (14-Day Free Trial)
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value });

  function validateStep1() {
    setError(null);
    if (form.business.trim().length < 2) {
      setError("Please enter a valid business name.");
      return false;
    }
    if (form.fullName.trim().length < 2) {
      setError("Please enter your name.");
      return false;
    }
    if (!form.email.includes("@")) {
      setError("Please enter a valid email address.");
      return false;
    }
    if (form.password.length < 8) {
      setError("Password must be at least 8 characters.");
      return false;
    }
    if (!form.adminPhone || form.adminPhone.replace(/[^0-9]/g, "").length < 7) {
      setError("Please enter a valid WhatsApp phone number with country code.");
      return false;
    }
    return true;
  }

  function handleNextStep(e: React.FormEvent) {
    e.preventDefault();
    if (validateStep1()) {
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function handleCompleteSignup(planIdToSubmit?: number) {
    const finalPlanId = planIdToSubmit !== undefined ? planIdToSubmit : form.planId;
    setBusy(true);
    setError(null);

    const payload = {
      ...form,
      planId: finalPlanId,
    };

    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
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
      router.push("/onboarding");
      router.refresh();
    } catch {
      setBusy(false);
      setError("Network error while creating workspace. Please try again.");
    }
  }

  // Selected plan metadata helper
  const selectedPlanObj = initialPlans.find((p) => p.id === form.planId) || initialPlans[0];

  return (
    <div className="w-full">
      {/* Progress Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Create your workspace</h1>
        <p className="text-ink-soft text-sm mt-1">
          {step === 1
            ? "Step 1 of 2: Business & Contact Information"
            : "Step 2 of 2: Select a Subscription Plan"}
        </p>
        <div className="flex items-center justify-center gap-2 mt-4 max-w-xs mx-auto">
          <div className="h-1.5 flex-1 rounded-full bg-pine" />
          <div className={`h-1.5 flex-1 rounded-full transition-colors ${step === 2 ? "bg-pine" : "bg-line"}`} />
        </div>
      </div>

      {step === 1 ? (
        /* STEP 1: BUSINESS & USER DETAILS */
        <Panel className="max-w-xl mx-auto p-6 sm:p-8">
          <form onSubmit={handleNextStep} className="space-y-4">
            <Field label="Business name">
              <input
                className={inputClass}
                required
                placeholder="e.g. Al Aziziya Trading"
                value={form.business}
                onChange={set("business")}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Your name">
                <input
                  className={inputClass}
                  required
                  placeholder="Full name"
                  value={form.fullName}
                  onChange={set("fullName")}
                />
              </Field>
              <Field label="Email">
                <input
                  className={inputClass}
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={form.email}
                  onChange={set("email")}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                label="WhatsApp number"
                hint="Country code + number (e.g. 97430000000)"
              >
                <input
                  className={`${inputClass} tabular`}
                  required
                  placeholder="97430000000"
                  value={form.adminPhone}
                  onChange={set("adminPhone")}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Business Type">
                <select className={inputClass} value={form.businessType} onChange={set("businessType")}>
                  {BUSINESS_TYPES.map((bt) => (
                    <option key={bt.id} value={bt.id}>
                      {bt.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Time zone">
                <select className={inputClass} value={form.timezone} onChange={set("timezone")}>
                  {ZONES.map((z) => (
                    <option key={z}>{z}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="flex items-start gap-2 pt-2">
              <input
                type="checkbox"
                id="terms"
                required
                className="mt-1 h-4 w-4 rounded border-line text-pine focus:ring-pine"
              />
              <label htmlFor="terms" className="text-xs text-ink-soft leading-relaxed">
                I have read and agree to the{" "}
                <a href="/terms" target="_blank" className="text-pine font-medium hover:underline">
                  Terms and Conditions
                </a>{" "}
                and Privacy Policy.
              </label>
            </div>

            {error && <p className="text-sm text-brick bg-brick/10 p-3 rounded-lg border border-brick/20">{error}</p>}

            <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
              <Button type="submit" variant="primary" className="w-full sm:flex-1 justify-center py-2.5">
                <span>Next: Choose Plan</span>
                <ArrowRightIcon className="w-4 h-4 ml-1.5" />
              </Button>
              <Button
                type="button"
                variant="quiet"
                disabled={busy}
                onClick={() => {
                  if (validateStep1()) {
                    handleCompleteSignup(1); // 1 is Free Trial
                  }
                }}
                className="w-full sm:w-auto text-xs whitespace-nowrap justify-center"
              >
                {busy ? "Creating…" : "Skip to 14-Day Free Trial →"}
              </Button>
            </div>

            <p className="text-xs text-center text-ink-soft pt-1">
              🎉 14-Day Free Trial included automatically. No credit card required.
            </p>
          </form>
        </Panel>
      ) : (
        /* STEP 2: CHOOSE PLAN OR SKIP */
        <div className="space-y-6">
          {/* Highlight Top Banner */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl bg-pine/10 border border-pine/20">
            <div>
              <p className="text-sm font-semibold text-pine">
                ✨ 14-Day Free Trial is included for all new registrations!
              </p>
              <p className="text-xs text-ink-soft mt-0.5">
                You can select a plan now or skip. You won&apos;t be billed until your 14-day trial period finishes.
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              disabled={busy}
              onClick={() => handleCompleteSignup(1)}
              className="w-full sm:w-auto text-xs whitespace-nowrap py-2 px-4 shadow-sm"
            >
              {busy ? "Setting up…" : "Skip & Start Free Trial (0 QAR) →"}
            </Button>
          </div>

          {error && <p className="text-sm text-brick bg-brick/10 p-3 rounded-lg border border-brick/20">{error}</p>}

          {/* Plan Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {initialPlans.map((plan) => {
              const isSelected = form.planId === plan.id;
              const features = Array.isArray(plan.features) ? plan.features : [];

              return (
                <div
                  key={plan.id}
                  onClick={() => setForm({ ...form, planId: plan.id })}
                  className={`cursor-pointer rounded-2xl border p-5 flex flex-col justify-between transition-all duration-200 relative ${
                    isSelected
                      ? "border-pine bg-pine/[0.04] shadow-md ring-2 ring-pine/20 scale-[1.02]"
                      : "border-line bg-surface hover:border-ink-soft/40 hover:shadow-sm"
                  }`}
                >
                  {plan.is_popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-pine text-white text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full shadow-sm">
                      Most Popular
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="font-bold text-base text-ink">{plan.name}</h3>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                          isSelected ? "border-pine bg-pine text-white" : "border-line"
                        }`}
                      >
                        {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>

                    <div className="mt-3">
                      <div className="flex items-baseline gap-1">
                        <span className="text-2xl font-black text-ink">
                          {Number(plan.price_qar) === 0 ? "0" : Number(plan.price_qar).toLocaleString()}
                        </span>
                        <span className="text-xs font-semibold text-ink-soft">QAR</span>
                        <span className="text-xs text-ink-soft">
                          {Number(plan.price_qar) === 0 ? " / 14 days" : " / mo"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-line/60 space-y-1.5 text-xs text-ink-soft">
                      <div className="font-medium text-ink flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-pine"></span>
                        {plan.monthly_reply_limit
                          ? `${plan.monthly_reply_limit.toLocaleString()} AI Bot Replies / mo`
                          : "Unlimited Bot Replies"}
                      </div>
                      <div className="font-medium text-ink flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-pine"></span>
                        {plan.broadcast_limit.toLocaleString()} Daily Broadcast Cap
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-line/60">
                      <p className="text-[11px] font-semibold text-ink-soft uppercase tracking-wider mb-2">
                        Included Features:
                      </p>
                      <ul className="space-y-2">
                        {features.slice(0, 6).map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-xs text-ink/80 leading-snug">
                            <CheckIcon className="w-3.5 h-3.5 text-pine flex-shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-line/60">
                    <button
                      type="button"
                      className={`w-full py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                        isSelected
                          ? "bg-pine text-white shadow-sm"
                          : "bg-surface-subtle text-ink-soft hover:text-ink hover:bg-line/40 border border-line"
                      }`}
                    >
                      {isSelected ? "Selected Plan" : "Choose " + plan.name}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Actions */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-line">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-ink-soft hover:text-ink font-medium"
            >
              ← Back to Workspace Details
            </button>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                type="button"
                variant="quiet"
                disabled={busy}
                onClick={() => handleCompleteSignup(1)}
                className="w-full sm:w-auto text-xs justify-center"
              >
                Skip (14-Day Free Trial)
              </Button>
              <Button
                type="button"
                variant="primary"
                disabled={busy}
                onClick={() => handleCompleteSignup(form.planId)}
                className="w-full sm:w-auto text-xs justify-center font-bold"
              >
                {busy
                  ? "Creating workspace…"
                  : `Continue with ${selectedPlanObj ? selectedPlanObj.name : "Plan"} →`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
