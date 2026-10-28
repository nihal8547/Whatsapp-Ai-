"use client";

import { useState } from "react";
import { PageHead, Panel, Button, Field, inputClass, Tag, useToast, Toast } from "@/components/ui";
import { fullStamp } from "@/lib/format";
import ApiDocs from "./api-docs";

export type ApiKey = {
  id: number;
  tenant_id: number;
  name: string;
  key_prefix: string;
  scopes: string[];
  rate_limit_per_min: number;
  last_used_at: string | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
};

export type ApiLog = {
  id: number;
  tenant_id: number;
  key_id: number | null;
  method: string;
  path: string;
  status: number;
  ip: string | null;
  created_at: string;
  key_name: string;
  key_prefix: string | null;
};

export type Webhook = {
  id: number;
  tenant_id: number;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  last_triggered_at: string | null;
  fail_count: number;
  created_at: string;
};

type Props = {
  initialKeys: ApiKey[];
  initialLogs: ApiLog[];
  initialWebhooks: Webhook[];
  initialTab?: "keys" | "docs";
};

export default function IntegrationsView({
  initialKeys,
  initialLogs,
  initialWebhooks,
  initialTab = "keys",
}: Props) {
  const { message, show } = useToast();

  const [keys, setKeys] = useState<ApiKey[]>(initialKeys);
  const [logs, setLogs] = useState<ApiLog[]>(initialLogs);
  const [webhooks, setWebhooks] = useState<Webhook[]>(initialWebhooks);

  // Main view tab: "keys" (API Keys & Webhooks) | "docs" (Interactive Documentation)
  const [mainTab, setMainTab] = useState<"keys" | "docs">(initialTab);

  // Key creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["read", "write"]);
  const [newKeyRateLimit, setNewKeyRateLimit] = useState(60);
  const [newKeyExpiry, setNewKeyExpiry] = useState("");

  // Revealed new key modal
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // Webhooks management state
  const [showWebhookForm, setShowWebhookForm] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvents, setWebhookEvents] = useState<string[]>(["all"]);
  const [savingWebhook, setSavingWebhook] = useState(false);
  const [testingWebhookId, setTestingWebhookId] = useState<number | null>(null);

  // Logs clearing state
  const [clearingLogs, setClearingLogs] = useState(false);
  const [refreshingLogs, setRefreshingLogs] = useState(false);

  // ── Key Actions ─────────────────────────────────────────────────────────────

  async function handleCreateKey(e: React.FormEvent) {
    e.preventDefault();
    if (!newKeyName.trim()) {
      show("Please enter a key name.");
      return;
    }
    setCreating(true);

    try {
      const res = await fetch("/api/integrations/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newKeyName.trim(),
          scopes: newKeyScopes,
          rate_limit_per_min: newKeyRateLimit,
          expires_at: newKeyExpiry ? new Date(newKeyExpiry).toISOString() : null,
        }),
      });

      const data = await res.json();
      setCreating(false);

      if (!res.ok || !data.ok) {
        show(data.error || "Failed to create API key.");
        return;
      }

      setKeys((prev) => [data.key, ...prev]);
      setShowCreateModal(false);
      setRevealedKey(data.apiKey);
      setNewKeyName("");
      setNewKeyScopes(["read", "write"]);
      setNewKeyRateLimit(60);
      setNewKeyExpiry("");
      show("API key created successfully.");
    } catch {
      setCreating(false);
      show("Network error while creating API key.");
    }
  }

  async function toggleKeyActive(key: ApiKey) {
    const nextActive = !key.active;
    try {
      const res = await fetch(`/api/integrations/keys/${key.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        show(data.error || "Failed to update key status.");
        return;
      }
      setKeys((prev) => prev.map((k) => (k.id === key.id ? data.key : k)));
      show(`Key ${nextActive ? "activated" : "deactivated"}.`);
    } catch {
      show("Error updating key status.");
    }
  }

  async function deleteKey(key: ApiKey) {
    if (!confirm(`Are you sure you want to delete the API key "${key.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/integrations/keys/${key.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        show(data.error || "Failed to delete key.");
        return;
      }
      setKeys((prev) => prev.filter((k) => k.id !== key.id));
      show(`Key "${key.name}" deleted.`);
    } catch {
      show("Error deleting key.");
    }
  }

  // ── Webhook Actions ─────────────────────────────────────────────────────────

  async function handleCreateWebhook(e: React.FormEvent) {
    e.preventDefault();
    if (!webhookUrl.trim()) {
      show("Please enter a webhook endpoint URL.");
      return;
    }
    setSavingWebhook(true);

    try {
      const res = await fetch("/api/integrations/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl.trim(),
          events: webhookEvents,
        }),
      });
      const data = await res.json();
      setSavingWebhook(false);

      if (!res.ok || !data.ok) {
        show(data.error || "Failed to create webhook.");
        return;
      }

      setWebhooks((prev) => [data.webhook, ...prev]);
      setShowWebhookForm(false);
      setWebhookUrl("");
      setWebhookEvents(["all"]);
      show("Webhook registered.");
    } catch {
      setSavingWebhook(false);
      show("Network error saving webhook.");
    }
  }

  async function toggleWebhookActive(hook: Webhook) {
    const nextActive = !hook.active;
    try {
      const res = await fetch(`/api/integrations/webhooks/${hook.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: nextActive }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        show(data.error || "Failed to update webhook.");
        return;
      }
      setWebhooks((prev) => prev.map((w) => (w.id === hook.id ? data.webhook : w)));
      show(`Webhook ${nextActive ? "activated" : "deactivated"}.`);
    } catch {
      show("Error updating webhook.");
    }
  }

  async function deleteWebhook(hook: Webhook) {
    if (!confirm("Are you sure you want to delete this webhook?")) return;
    try {
      const res = await fetch(`/api/integrations/webhooks/${hook.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        show(data.error || "Failed to delete webhook.");
        return;
      }
      setWebhooks((prev) => prev.filter((w) => w.id !== hook.id));
      show("Webhook removed.");
    } catch {
      show("Error removing webhook.");
    }
  }

  async function testWebhook(hook: Webhook) {
    setTestingWebhookId(hook.id);
    try {
      const res = await fetch(`/api/integrations/webhooks/${hook.id}/test`, {
        method: "POST",
      });
      const data = await res.json();
      setTestingWebhookId(null);

      if (!data.ok) {
        show(data.error || "Webhook test request failed.");
        return;
      }

      if (data.delivered) {
        show(`Test payload delivered successfully! (HTTP ${data.statusCode})`);
      } else {
        show(`Delivery failed: ${data.error || `HTTP ${data.statusCode}`}`);
      }

      // Refresh webhooks list
      const updated = await fetch("/api/integrations/webhooks").then((r) => r.json());
      if (updated.ok) setWebhooks(updated.webhooks);
    } catch {
      setTestingWebhookId(null);
      show("Could not send test webhook.");
    }
  }

  // ── Logs Actions ────────────────────────────────────────────────────────────

  async function refreshLogs() {
    setRefreshingLogs(true);
    try {
      const res = await fetch("/api/integrations/logs");
      const data = await res.json();
      setRefreshingLogs(false);
      if (data.ok) {
        setLogs(data.logs);
        show("API logs refreshed.");
      }
    } catch {
      setRefreshingLogs(false);
      show("Could not refresh logs.");
    }
  }

  async function clearLogs() {
    if (!confirm("Are you sure you want to clear all integration API logs for this workspace?")) return;
    setClearingLogs(true);
    try {
      const res = await fetch("/api/integrations/logs", { method: "DELETE" });
      const data = await res.json();
      setClearingLogs(false);
      if (!res.ok || !data.ok) {
        show("Could not clear logs.");
        return;
      }
      setLogs([]);
      show("API logs cleared.");
    } catch {
      setClearingLogs(false);
      show("Error clearing logs.");
    }
  }

  // ── Copy helpers ────────────────────────────────────────────────────────────

  function copyKeyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
    show("API key copied to clipboard.");
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-8">
      {/* ── Page Header ── */}
      <PageHead
        title="Integrations & API"
        lead="Manage API keys, configure automated webhooks, and inspect real-time execution logs for your workspace."
        action={
          <Button
            variant="primary"
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 shadow-sm font-medium"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span>Create API Key</span>
          </Button>
        }
      />

      {/* ── Tab Switcher ── */}
      <div className="flex items-center gap-2 border-b border-line -mt-2">
        <button
          type="button"
          onClick={() => setMainTab("keys")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            mainTab === "keys"
              ? "border-pine text-pine font-semibold"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 2l-2 2m-1-1l-3 3m2-2l-3 3m1-1l-3 3" />
            <circle cx="7.5" cy="15.5" r="5.5" />
            <path d="m11.5 11.5 6-6" />
          </svg>
          <span>API Keys</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-canvas border border-line text-ink-soft font-mono">
            {keys.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setMainTab("docs")}
          className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
            mainTab === "docs"
              ? "border-pine text-pine font-semibold"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <span>Documentation</span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-pine-wash text-pine border border-pine/30">
            Interactive
          </span>
        </button>
      </div>

      {mainTab === "docs" ? (
        <ApiDocs keys={keys} onGoToKeysTab={() => setMainTab("keys")} />
      ) : (
        <div className="space-y-8">
          {/* ── SECTION 1: API KEYS ── */}
          <Panel>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">API Keys</h2>
            <p className="text-xs text-ink-soft mt-0.5">
              Secure tokens to authenticate requests against the Webbea n8n automation engine.
            </p>
          </div>
          <span className="text-xs tabular text-ink-faint">
            {keys.length} key{keys.length === 1 ? "" : "s"} generated
          </span>
        </div>

        {keys.length === 0 ? (
          <div className="text-center py-12 px-4 border border-dashed border-line rounded-lg bg-canvas/40">
            <div className="w-10 h-10 rounded-full bg-pine-wash text-pine mx-auto flex items-center justify-center mb-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 2l-2 2m-1-1l-3 3m2-2l-3 3m1-1l-3 3" />
                <circle cx="7.5" cy="15.5" r="5.5" />
                <path d="m11.5 11.5 6-6" />
              </svg>
            </div>
            <h3 className="font-semibold text-sm text-ink">No API keys yet</h3>
            <p className="text-xs text-ink-soft mt-1 max-w-sm mx-auto">
              Create an API key to allow external scripts, n8n automations, or CRMs to query your business services and contacts.
            </p>
            <Button
              variant="primary"
              onClick={() => setShowCreateModal(true)}
              className="mt-4 text-xs py-1.5 px-3"
            >
              Generate your first key
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="pb-3 font-semibold">Key Name</th>
                  <th className="pb-3 font-semibold">Prefix</th>
                  <th className="pb-3 font-semibold">Scopes</th>
                  <th className="pb-3 font-semibold">Rate Limit</th>
                  <th className="pb-3 font-semibold">Last Used</th>
                  <th className="pb-3 font-semibold">Expires</th>
                  <th className="pb-3 font-semibold text-center">Active</th>
                  <th className="pb-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {keys.map((k) => {
                  const isExpired = k.expires_at && new Date(k.expires_at).getTime() < Date.now();
                  return (
                    <tr key={k.id} className="hover:bg-canvas/50 transition-colors">
                      <td className="py-3 font-medium text-ink">
                        <span>{k.name}</span>
                        {isExpired && (
                          <span className="ml-2 text-[10px] uppercase font-bold text-brick bg-[#f8ebe9] px-1.5 py-0.5 rounded">
                            Expired
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        <code className="text-xs font-mono bg-canvas px-2 py-0.5 rounded text-ink border border-line">
                          {k.key_prefix}...
                        </code>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-1">
                          {k.scopes.map((s) => (
                            <Tag key={s} tone={s === "write" ? "warn" : "neutral"}>
                              {s}
                            </Tag>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 text-xs tabular text-ink-soft">
                        {k.rate_limit_per_min} req/min
                      </td>
                      <td className="py-3 text-xs tabular text-ink-soft">
                        {k.last_used_at ? fullStamp(k.last_used_at) : <span className="text-ink-faint">Never</span>}
                      </td>
                      <td className="py-3 text-xs tabular text-ink-soft">
                        {k.expires_at ? (
                          <span className={isExpired ? "text-brick font-medium" : ""}>
                            {new Date(k.expires_at).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-ink-faint">Never</span>
                        )}
                      </td>
                      <td className="py-3 text-center">
                        <button
                          type="button"
                          onClick={() => toggleKeyActive(k)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            k.active ? "bg-pine" : "bg-line"
                          }`}
                          title={k.active ? "Click to deactivate" : "Click to activate"}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                              k.active ? "translate-x-4" : "translate-x-0"
                            }`}
                          />
                        </button>
                      </td>
                      <td className="py-3 text-right">
                        <Button
                          variant="danger"
                          onClick={() => deleteKey(k)}
                          className="text-xs py-1 px-2.5 hover:bg-brick/10"
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── SECTION 2: WEBHOOKS (PLACEHOLDER + CONFIG) ── */}
      <Panel>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-semibold text-ink">Webhooks</h2>
            <Tag tone="warn">Coming soon</Tag>
          </div>
          <Button
            variant="quiet"
            onClick={() => setShowWebhookForm(!showWebhookForm)}
            className="text-xs py-1 px-3 self-start sm:self-auto"
          >
            {showWebhookForm ? "Hide Configuration" : "Configure Webhook Endpoint"}
          </Button>
        </div>

        {/* Feature highlight banner */}
        <div className="p-4 rounded-lg bg-pine-wash/40 border border-pine/20 mb-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-pine/10 text-pine flex items-center justify-center shrink-0 mt-0.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">
                Coming soon: get notified when a customer messages, books an appointment, or opts out
              </p>
              <p className="text-xs text-ink-soft mt-1 leading-relaxed">
                Connect your external webhooks to receive signed real-time HTTP POST events whenever incoming activity happens.
              </p>
              <div className="flex flex-wrap gap-2 mt-2.5">
                <span className="text-[11px] font-mono bg-panel border border-line px-2 py-0.5 rounded text-ink">
                  message.received
                </span>
                <span className="text-[11px] font-mono bg-panel border border-line px-2 py-0.5 rounded text-ink">
                  appointment.created
                </span>
                <span className="text-[11px] font-mono bg-panel border border-line px-2 py-0.5 rounded text-ink">
                  contact.opted_out
                </span>
                <span className="text-[11px] font-mono bg-panel border border-line px-2 py-0.5 rounded text-ink">
                  all
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Webhook Form */}
        {showWebhookForm && (
          <form onSubmit={handleCreateWebhook} className="p-4 mb-4 bg-canvas/40 border border-line rounded-lg space-y-4">
            <h3 className="font-semibold text-sm text-ink">Register Webhook URL</h3>
            <Field label="Payload URL" hint="Must be a publicly reachable HTTPS endpoint">
              <input
                type="url"
                required
                placeholder="https://your-domain.com/api/whatsapp-webhook"
                className={inputClass}
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
              />
            </Field>

            <Field label="Subscribed Events">
              <div className="grid sm:grid-cols-2 gap-2 mt-1">
                {[
                  { id: "all", label: "All events (*)" },
                  { id: "message.received", label: "Customer message received" },
                  { id: "appointment.created", label: "Appointment booked" },
                  { id: "contact.opted_out", label: "Contact opted out" },
                ].map((ev) => (
                  <label key={ev.id} className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={webhookEvents.includes(ev.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setWebhookEvents((prev) => [...prev, ev.id]);
                        } else {
                          setWebhookEvents((prev) => prev.filter((x) => x !== ev.id));
                        }
                      }}
                      className="rounded text-pine focus:ring-pine"
                    />
                    <span>{ev.label}</span>
                  </label>
                ))}
              </div>
            </Field>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <Button type="button" variant="quiet" onClick={() => setShowWebhookForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={savingWebhook}>
                {savingWebhook ? "Saving…" : "Save Webhook"}
              </Button>
            </div>
          </form>
        )}

        {/* Webhooks List */}
        {webhooks.length > 0 && (
          <div className="overflow-x-auto -mx-5 px-5 pt-2">
            <table className="w-full text-sm">
              <thead className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="pb-2 font-semibold">Endpoint URL</th>
                  <th className="pb-2 font-semibold">Secret</th>
                  <th className="pb-2 font-semibold">Events</th>
                  <th className="pb-2 font-semibold">Last Triggered</th>
                  <th className="pb-2 font-semibold">Fail Count</th>
                  <th className="pb-2 font-semibold text-center">Active</th>
                  <th className="pb-2 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {webhooks.map((w) => (
                  <tr key={w.id} className="hover:bg-canvas/50">
                    <td className="py-2.5 font-mono text-xs max-w-xs truncate">{w.url}</td>
                    <td className="py-2.5 font-mono text-xs text-ink-faint">
                      {w.secret ? `${w.secret.slice(0, 8)}...` : "—"}
                    </td>
                    <td className="py-2.5">
                      <div className="flex flex-wrap gap-1">
                        {w.events.map((e) => (
                          <Tag key={e} tone="neutral">{e}</Tag>
                        ))}
                      </div>
                    </td>
                    <td className="py-2.5 text-xs tabular text-ink-soft">
                      {w.last_triggered_at ? fullStamp(w.last_triggered_at) : "Never"}
                    </td>
                    <td className="py-2.5 text-xs tabular">
                      {w.fail_count > 0 ? (
                        <span className="text-brick font-semibold">{w.fail_count}</span>
                      ) : (
                        <span className="text-ink-faint">0</span>
                      )}
                    </td>
                    <td className="py-2.5 text-center">
                      <button
                        type="button"
                        onClick={() => toggleWebhookActive(w)}
                        className={`relative inline-flex h-4 w-7 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          w.active ? "bg-pine" : "bg-line"
                        }`}
                      >
                        <span
                          className={`inline-block h-3 w-3 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                            w.active ? "translate-x-3" : "translate-x-0"
                          }`}
                        />
                      </button>
                    </td>
                    <td className="py-2.5 text-right space-x-1">
                      <Button
                        variant="quiet"
                        disabled={testingWebhookId === w.id}
                        onClick={() => testWebhook(w)}
                        className="text-xs py-0.5 px-2"
                      >
                        {testingWebhookId === w.id ? "Testing…" : "Test"}
                      </Button>
                      <Button
                        variant="danger"
                        onClick={() => deleteWebhook(w)}
                        className="text-xs py-0.5 px-2"
                      >
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* ── SECTION 3: API LOGS ── */}
      <Panel>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">API Request Logs</h2>
            <p className="text-xs text-ink-soft mt-0.5">
              Inspecting the last 100 API calls made using your workspace keys.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="quiet"
              disabled={refreshingLogs}
              onClick={refreshLogs}
              className="text-xs py-1.5 px-3 flex items-center gap-1.5"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={refreshingLogs ? "animate-spin" : ""}
              >
                <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2" />
              </svg>
              <span>Refresh</span>
            </Button>
            <Button
              variant="danger"
              disabled={clearingLogs || logs.length === 0}
              onClick={clearLogs}
              className="text-xs py-1.5 px-3"
            >
              {clearingLogs ? "Clearing…" : "Clear logs"}
            </Button>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="text-center py-10 text-ink-soft text-sm border border-dashed border-line rounded-lg bg-canvas/30">
            No API calls recorded yet. Once your API keys are used, requests will show here.
          </div>
        ) : (
          <div className="overflow-x-auto -mx-5 px-5">
            <table className="w-full text-xs">
              <thead className="border-b border-line text-left text-ink-soft">
                <tr>
                  <th className="pb-2.5 font-semibold">Time</th>
                  <th className="pb-2.5 font-semibold">Method</th>
                  <th className="pb-2.5 font-semibold">Endpoint</th>
                  <th className="pb-2.5 font-semibold">Status</th>
                  <th className="pb-2.5 font-semibold">Key Name</th>
                  <th className="pb-2.5 font-semibold">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {logs.map((l) => {
                  let tone: "good" | "warn" | "bad" | "neutral" = "good";
                  if (l.status >= 500) tone = "bad";
                  else if (l.status >= 400) tone = "warn";

                  return (
                    <tr key={l.id} className="hover:bg-canvas/50 transition-colors">
                      <td className="py-2.5 tabular text-ink-soft">{fullStamp(l.created_at)}</td>
                      <td className="py-2.5 font-mono font-medium text-ink">{l.method || "GET"}</td>
                      <td className="py-2.5 font-mono text-ink font-medium">{l.path}</td>
                      <td className="py-2.5">
                        <Tag tone={tone}>{l.status}</Tag>
                      </td>
                      <td className="py-2.5 font-medium text-ink">
                        <span>{l.key_name}</span>
                        {l.key_prefix && (
                          <span className="text-[11px] font-mono text-ink-faint ml-1">
                            ({l.key_prefix}...)
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 font-mono text-ink-faint">{l.ip || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
        </div>
      )}

      {/* ── CREATE KEY MODAL ── */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-panel border border-line rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-line mb-4">
              <h3 className="font-semibold text-lg text-ink">Create New API Key</h3>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-ink-soft hover:text-ink text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateKey} className="space-y-4">
              <Field label="Key Name" hint="A descriptive label for where this key is used">
                <input
                  type="text"
                  required
                  placeholder="e.g. n8n Production Automation, Website CRM Sync"
                  className={inputClass}
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </Field>

              <Field label="Permissions & Scopes">
                <div className="space-y-2 mt-1">
                  <label className="flex items-start gap-2.5 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={newKeyScopes.includes("read")}
                      onChange={(e) => {
                        if (e.target.checked) setNewKeyScopes((prev) => [...prev, "read"]);
                        else setNewKeyScopes((prev) => prev.filter((s) => s !== "read"));
                      }}
                      className="mt-0.5 rounded text-pine focus:ring-pine"
                    />
                    <div>
                      <span className="font-medium text-ink">read</span>
                      <p className="text-xs text-ink-soft">Query services, business hours, contacts, and appointments</p>
                    </div>
                  </label>
                  <label className="flex items-start gap-2.5 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={newKeyScopes.includes("write")}
                      onChange={(e) => {
                        if (e.target.checked) setNewKeyScopes((prev) => [...prev, "write"]);
                        else setNewKeyScopes((prev) => prev.filter((s) => s !== "write"));
                      }}
                      className="mt-0.5 rounded text-pine focus:ring-pine"
                    />
                    <div>
                      <span className="font-medium text-ink">write</span>
                      <p className="text-xs text-ink-soft">Validate and send WhatsApp outbound messages</p>
                    </div>
                  </label>
                </div>
              </Field>

              <Field label="Rate Limit (Requests per minute)" hint="Default: 60 (Range: 10 to 300)">
                <input
                  type="number"
                  min={10}
                  max={300}
                  className={inputClass}
                  value={newKeyRateLimit}
                  onChange={(e) => setNewKeyRateLimit(Number(e.target.value))}
                />
              </Field>

              <Field label="Expiry Date (Optional)" hint="Leave empty for keys that never expire">
                <input
                  type="date"
                  className={inputClass}
                  value={newKeyExpiry}
                  min={new Date(Date.now() + 86400000).toISOString().slice(0, 10)}
                  onChange={(e) => setNewKeyExpiry(e.target.value)}
                />
              </Field>

              <div className="flex justify-end gap-2 pt-4 border-t border-line">
                <Button type="button" variant="quiet" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" disabled={creating}>
                  {creating ? "Generating…" : "Generate API Key"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── REVEAL KEY MODAL (SHOWN ONCE) ── */}
      {revealedKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-panel border border-line rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-pine-wash text-pine flex items-center justify-center shrink-0">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-ink">API Key Generated</h3>
                <p className="text-xs text-ink-soft">Save this key now. It will not be shown again.</p>
              </div>
            </div>

            <div className="p-3 bg-amber-wash border border-amber/30 text-amber rounded-lg text-xs leading-relaxed font-medium">
              ⚠️ <strong>Warning:</strong> This key will not be shown again. Store only the hash server-side. Copy this key now and store it in your environment variables or password manager.
            </div>

            <div className="relative">
              <input
                type="text"
                readOnly
                value={revealedKey}
                className="w-full font-mono text-xs p-3 pr-20 bg-canvas border border-line rounded-md text-ink select-all focus:outline-none"
              />
              <button
                type="button"
                onClick={() => copyKeyToClipboard(revealedKey)}
                className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-pine text-white text-xs rounded hover:bg-pine-deep transition-colors font-medium flex items-center gap-1"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                <span>{copiedKey ? "Copied!" : "Copy"}</span>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                onClick={() => setRevealedKey(null)}
                className="px-6 py-2"
              >
                I have copied my key
              </Button>
            </div>
          </div>
        </div>
      )}

      <Toast message={message} />
    </div>
  );
}
