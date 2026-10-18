"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Panel, PageHead, Button, Tag, Toast, useToast } from "@/components/ui";
import { fullStamp } from "@/lib/format";

type Recipient = {
  id: number;
  phone: string;
  status: "queued" | "sending" | "sent" | "failed" | "skipped";
  skip_reason: string | null;
  error: string | null;
  sent_at: string | null;
  created_at: string;
  contact_name: string;
  has_replied: boolean;
};

type Props = {
  broadcast: any;
  counts: {
    total: number;
    queued: number;
    sending: number;
    sent: number;
    failed: number;
    skipped: number;
    replied: number;
    optOuts: number;
  };
  initialRecipients: Recipient[];
  whatsappConnected: boolean;
  timezone: string;
};

export default function BroadcastDetailClient({
  broadcast: initBroadcast,
  counts: initCounts,
  initialRecipients,
  whatsappConnected,
  timezone,
}: Props) {
  const router = useRouter();
  const { message: toastMsg, show: showToast } = useToast();

  const [broadcast, setBroadcast] = useState(initBroadcast);
  const [counts, setCounts] = useState(initCounts);
  const [recipients, setRecipients] = useState<Recipient[]>(initialRecipients);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [actionLoading, setActionLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  async function handleAction(action: "pause" | "resume" | "cancel") {
    if (action === "cancel" && !confirm("Are you sure you want to cancel this broadcast? All queued recipients will be marked as skipped.")) {
      return;
    }

    setActionLoading(true);
    try {
      const res = await fetch(`/api/broadcasts/${broadcast.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!data.ok) {
        showToast(data.message || data.error || `Could not ${action} broadcast.`);
      } else {
        showToast(`Broadcast ${action}d successfully.`);
        router.refresh();
        // Refresh details
        const refreshRes = await fetch(`/api/broadcasts/${broadcast.id}`);
        const refreshData = await refreshRes.json();
        if (refreshData.ok) {
          setBroadcast(refreshData.broadcast);
          setCounts(refreshData.counts);
          setRecipients(refreshData.recipients);
        }
      }
    } catch {
      showToast("Network error.");
    } finally {
      setActionLoading(false);
    }
  }

  async function filterRecipients(status: string, query: string) {
    setStatusFilter(status);
    setSearch(query);
    setSearching(true);
    try {
      const sp = new URLSearchParams();
      if (status) sp.set("status", status);
      if (query) sp.set("search", query);
      const res = await fetch(`/api/broadcasts/${broadcast.id}?${sp.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setRecipients(data.recipients);
      }
    } catch {
    } finally {
      setSearching(false);
    }
  }

  const statusTones: Record<string, "good" | "warn" | "neutral" | "bad"> = {
    running: "good",
    paused: "warn",
    scheduled: "neutral",
    completed: "good",
    cancelled: "neutral",
    draft: "neutral",
  };

  const recipientStatusTones: Record<string, "good" | "warn" | "neutral" | "bad"> = {
    sent: "good",
    sending: "warn",
    queued: "neutral",
    failed: "bad",
    skipped: "neutral",
  };

  const sentPercent = counts.total > 0 ? Math.round((counts.sent / counts.total) * 100) : 0;
  const replyRate = counts.sent > 0 ? Math.round((counts.replied / counts.sent) * 100) : 0;
  const optOutRate = counts.sent > 0 ? Math.round((counts.optOuts / counts.sent) * 100) : 0;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2 text-xs text-ink-soft">
        <Link href="/broadcasts" className="hover:text-ink">Broadcasts</Link>
        <span>/</span>
        <span>Campaign #{broadcast.id}</span>
      </div>

      <PageHead
        title={broadcast.name}
        lead={broadcast.message}
        action={
          <div className="flex items-center gap-2">
            <a href={`/api/broadcasts/${broadcast.id}/export`} download>
              <Button variant="quiet">Export CSV</Button>
            </a>
            {broadcast.status === "running" && (
              <Button
                variant="quiet"
                onClick={() => handleAction("pause")}
                disabled={actionLoading}
              >
                Pause Campaign
              </Button>
            )}
            {broadcast.status === "paused" && (
              <Button
                variant="primary"
                onClick={() => handleAction("resume")}
                disabled={actionLoading || !whatsappConnected}
              >
                Resume Campaign
              </Button>
            )}
            {(broadcast.status === "running" || broadcast.status === "paused" || broadcast.status === "scheduled") && (
              <Button
                variant="danger"
                onClick={() => handleAction("cancel")}
                disabled={actionLoading}
              >
                Cancel Campaign
              </Button>
            )}
          </div>
        }
      />

      {/* Pause banner */}
      {broadcast.status === "paused" && (
        <div className="p-4 bg-amber-wash border border-amber/30 rounded-lg flex items-center justify-between text-xs text-ink">
          <div className="flex items-center gap-2">
            <span className="text-amber text-base font-bold">⏸️</span>
            <div>
              <p className="font-semibold text-amber">
                Campaign is Paused
              </p>
              <p className="text-ink-soft mt-0.5">
                Reason: {broadcast.pause_reason || "Paused by user"}. n8n will not process queued messages until resumed.
              </p>
            </div>
          </div>
          <Button
            variant="quiet"
            className="text-xs bg-panel"
            onClick={() => handleAction("resume")}
            disabled={actionLoading || !whatsappConnected}
          >
            Resume
          </Button>
        </div>
      )}

      {/* Campaign Meta & KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-panel border border-line rounded-lg p-3">
          <p className="text-xs text-ink-soft">Status</p>
          <div className="mt-1">
            <Tag tone={statusTones[broadcast.status] || "neutral"}>
              {broadcast.status.toUpperCase()}
            </Tag>
          </div>
        </div>
        <div className="bg-panel border border-line rounded-lg p-3">
          <p className="text-xs text-ink-soft">Total Audience</p>
          <p className="text-2xl font-semibold tabular mt-0.5 text-ink">{counts.total}</p>
        </div>
        <div className="bg-panel border border-line rounded-lg p-3">
          <p className="text-xs text-ink-soft">Sent</p>
          <p className="text-2xl font-semibold tabular mt-0.5 text-pine-deep">
            {counts.sent} <span className="text-xs font-normal text-ink-soft">({sentPercent}%)</span>
          </p>
        </div>
        <div className="bg-panel border border-line rounded-lg p-3">
          <p className="text-xs text-ink-soft">Queued</p>
          <p className="text-2xl font-semibold tabular mt-0.5 text-ink-soft">{counts.queued}</p>
        </div>
        <div className="bg-panel border border-line rounded-lg p-3">
          <p className="text-xs text-ink-soft">Replied (48h)</p>
          <p className="text-2xl font-semibold tabular mt-0.5 text-pine">
            {counts.replied} <span className="text-xs font-normal text-ink-soft">({replyRate}%)</span>
          </p>
        </div>
        <div className="bg-panel border border-line rounded-lg p-3">
          <p className="text-xs text-ink-soft">Opt-outs After</p>
          <p className="text-2xl font-semibold tabular mt-0.5 text-brick">
            {counts.optOuts} <span className="text-xs font-normal text-ink-soft">({optOutRate}%)</span>
          </p>
        </div>
      </div>

      {/* Progress details */}
      <Panel className="space-y-3">
        <div className="flex justify-between items-center text-xs text-ink-soft">
          <span className="font-medium text-ink">Progress Overview</span>
          <span>{sentPercent}% ({counts.sent} of {counts.total} messages sent)</span>
        </div>
        <div className="h-2 bg-canvas border border-line rounded-full overflow-hidden">
          <div
            className="h-full bg-pine transition-all duration-300"
            style={{ width: `${Math.min(100, sentPercent)}%` }}
          />
        </div>
        <div className="flex items-center gap-6 text-xs text-ink-soft pt-1 flex-wrap">
          <span>Created: <strong>{fullStamp(broadcast.created_at, timezone)}</strong></span>
          {broadcast.scheduled_at && (
            <span>Scheduled: <strong>{fullStamp(broadcast.scheduled_at, timezone)}</strong></span>
          )}
          {broadcast.started_at && (
            <span>Started: <strong>{fullStamp(broadcast.started_at, timezone)}</strong></span>
          )}
          {broadcast.finished_at && (
            <span>Finished: <strong>{fullStamp(broadcast.finished_at, timezone)}</strong></span>
          )}
          {broadcast.import_filename && (
            <span>Audience Batch: <strong>{broadcast.import_filename}</strong></span>
          )}
        </div>
      </Panel>

      {/* Recipients Table */}
      <Panel pad={false}>
        <div className="p-4 border-b border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-ink">Recipients</h3>
            <p className="text-xs text-ink-soft mt-0.5">
              Audience members queued or sent via n8n integration.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              placeholder="Filter name or phone..."
              value={search}
              onChange={(e) => filterRecipients(statusFilter, e.target.value)}
              className="text-xs px-2.5 py-1.5 rounded border border-line bg-panel focus:outline-none focus:border-pine w-full sm:w-48"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="px-4 py-2 bg-canvas/40 border-b border-line flex items-center gap-1.5 text-xs overflow-x-auto">
          {[
            { label: "All", value: "" },
            { label: `Queued (${counts.queued})`, value: "queued" },
            { label: `Sent (${counts.sent})`, value: "sent" },
            { label: `Failed (${counts.failed})`, value: "failed" },
            { label: `Skipped (${counts.skipped})`, value: "skipped" },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => filterRecipients(tab.value, search)}
              className={`px-2.5 py-1 rounded transition-colors whitespace-nowrap ${
                statusFilter === tab.value
                  ? "bg-pine text-white font-medium"
                  : "text-ink-soft hover:text-ink hover:bg-canvas"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        {searching ? (
          <div className="p-8 text-center text-xs text-ink-soft animate-pulse">
            Filtering recipients...
          </div>
        ) : recipients.length === 0 ? (
          <div className="p-8 text-center text-xs text-ink-soft">
            No recipients found matching current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs divide-y divide-line">
              <thead className="bg-canvas/50 text-ink-soft uppercase tracking-wider font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Recipient</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Skip Reason / Error</th>
                  <th className="py-2.5 px-4">Sent At</th>
                  <th className="py-2.5 px-4 text-right">Replied (48h)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line bg-panel">
                {recipients.map((r) => (
                  <tr key={r.id} className="hover:bg-canvas/40 transition-colors">
                    <td className="py-2.5 px-4">
                      <p className="font-medium text-ink">{r.contact_name || "Unknown"}</p>
                      <p className="text-ink-soft font-mono text-[11px]">+{r.phone}</p>
                    </td>
                    <td className="py-2.5 px-4">
                      <Tag tone={recipientStatusTones[r.status] || "neutral"}>
                        {r.status}
                      </Tag>
                    </td>
                    <td className="py-2.5 px-4 text-ink-soft">
                      {r.skip_reason ? (
                        <span className="text-ink-soft">Skipped: {r.skip_reason}</span>
                      ) : r.error ? (
                        <span className="text-brick font-medium">{r.error}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-ink-soft">
                      {r.sent_at ? fullStamp(r.sent_at, timezone) : "—"}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {r.has_replied ? (
                        <Tag tone="good">Replied 💬</Tag>
                      ) : r.status === "sent" ? (
                        <span className="text-ink-faint">No reply</span>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Toast message={toastMsg} />
    </div>
  );
}
