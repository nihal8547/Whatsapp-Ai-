"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Panel, PageHead, Button, Field, inputClass, Tag, Toast, useToast } from "@/components/ui";
import { fullStamp } from "@/lib/format";

type BroadcastItem = {
  id: number;
  name: string;
  message: string;
  status: "draft" | "scheduled" | "running" | "paused" | "completed" | "cancelled";
  pause_reason: string | null;
  scheduled_at: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  import_id: number | null;
  import_filename: string;
  creator_name: string;
  total_recipients: number;
  queued_count: number;
  sending_count: number;
  sent_count: number;
  failed_count: number;
  skipped_count: number;
  skipped_cancelled: number;
  skipped_opted_out: number;
  progress?: number;
};

type ImportBatch = {
  id: number;
  filename: string;
  total_rows: number;
  valid_rows: number;
  created_at: string;
};

type Props = {
  initialBroadcasts: BroadcastItem[];
  imports: ImportBatch[];
  caps: {
    effectiveDailyCap: number;
    warmUpCap: number;
    tenantDailyCap: number;
    platformDailyMax: number;
    earlierSendingDays: number;
    hourlyCap: number;
    enabled: boolean;
    windowStart: string;
    windowEnd: string;
  };
  whatsappConnected: boolean;
  businessName: string;
  timezone: string;
};

export default function BroadcastsClient({
  initialBroadcasts,
  imports,
  caps,
  whatsappConnected,
  businessName,
  timezone,
}: Props) {
  const router = useRouter();
  const { message: toastMsg, show: showToast } = useToast();

  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>(initialBroadcasts);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // New broadcast form state
  const [name, setName] = useState("");
  const [messageText, setMessageText] = useState("");
  const [audienceType, setAudienceType] = useState<"all" | "import">("all");
  const [selectedImportId, setSelectedImportId] = useState<string>("");
  const [timingType, setTimingType] = useState<"now" | "schedule">("now");
  const [scheduledDate, setScheduledDate] = useState("");
  const [creating, setCreating] = useState(false);

  // Audience estimate state
  const [estimateData, setEstimateData] = useState<{
    eligible: number;
    optedOut: number;
    unknown: number;
    total: number;
    estimateText: string;
  } | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  // Check if any broadcast is currently running or scheduled
  const activeBroadcast = broadcasts.find((b) => b.status === "running" || b.status === "scheduled");

  // Fetch live audience estimate when audience selection changes
  useEffect(() => {
    if (!showModal) return;
    let cancel = false;
    setLoadingEstimate(true);

    const importParam = audienceType === "import" && selectedImportId ? `?importId=${selectedImportId}` : "";
    fetch(`/api/broadcasts/estimate${importParam}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancel && data.ok) {
          setEstimateData({
            eligible: data.eligible,
            optedOut: data.optedOut,
            unknown: data.unknown,
            total: data.total,
            estimateText: data.estimateText,
          });
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancel) setLoadingEstimate(false);
      });

    return () => {
      cancel = true;
    };
  }, [showModal, audienceType, selectedImportId]);

  function insertVariable(v: string) {
    setMessageText((prev) => prev + v);
  }

  // Handle Pause / Resume / Cancel actions
  async function handleAction(broadcastId: number, action: "pause" | "resume" | "cancel") {
    if (action === "cancel" && !confirm("Are you sure you want to cancel this broadcast? Queued recipients will be skipped.")) {
      return;
    }

    setActionLoading(broadcastId);
    try {
      const res = await fetch(`/api/broadcasts/${broadcastId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!data.ok) {
        showToast(data.message || data.error || `Could not ${action} broadcast.`);
      } else {
        showToast(`Broadcast ${action}d.`);
        router.refresh();
        // Refresh local state
        const refreshRes = await fetch("/api/broadcasts");
        const refreshData = await refreshRes.json();
        if (refreshData.ok) {
          setBroadcasts(refreshData.broadcasts);
        }
      }
    } catch {
      showToast("Network error.");
    } finally {
      setActionLoading(null);
    }
  }

  // Submit new broadcast
  async function handleCreateBroadcast(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return showToast("Please provide a broadcast name.");
    if (!messageText.trim()) return showToast("Please provide a message.");
    if (messageText.length > 1000) return showToast("Message exceeds 1000 characters limit.");

    if (timingType === "schedule" && !scheduledDate) {
      return showToast("Please choose a date and time for scheduled broadcast.");
    }

    setCreating(true);
    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          message: messageText,
          importId: audienceType === "import" ? Number(selectedImportId) : null,
          scheduledAt: timingType === "schedule" ? new Date(scheduledDate).toISOString() : null,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        if (res.status === 409) {
          showToast(data.message || "Another broadcast is already active (409 Conflict).");
        } else {
          showToast(data.message || data.error || "Failed to create broadcast.");
        }
      } else {
        showToast("Broadcast created!");
        setShowModal(false);
        setName("");
        setMessageText("");
        router.refresh();
        const refreshRes = await fetch("/api/broadcasts");
        const refreshData = await refreshRes.json();
        if (refreshData.ok) {
          setBroadcasts(refreshData.broadcasts);
        }
      }
    } catch {
      showToast("Network error.");
    } finally {
      setCreating(false);
    }
  }

  // Preview message text replacement
  const samplePreview = messageText
    ? messageText.replace(/\{name\}/gi, "Sarah").replace(/\{business\}/gi, businessName)
    : "Hi Sarah, we have a special announcement for you!";

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <PageHead
        title="Broadcasts"
        lead="Send targeted outbound announcements to opted-in WhatsApp contacts."
        action={
          <div className="flex items-center gap-3">
            <Link href="/contacts/import" className="text-xs text-ink-soft hover:text-ink font-medium">
              Import Contacts &rarr;
            </Link>
            <Button
              onClick={() => setShowModal(true)}
              disabled={Boolean(activeBroadcast) || !whatsappConnected}
              title={
                !whatsappConnected
                  ? "Connect WhatsApp number first"
                  : activeBroadcast
                  ? "Another broadcast is already active"
                  : "Create a new broadcast"
              }
            >
              + New Broadcast
            </Button>
          </div>
        }
      />

      {/* Disconnection Warning Banner */}
      {!whatsappConnected && (
        <div className="p-4 bg-amber-wash border border-amber/30 rounded-lg flex items-center justify-between text-xs text-ink">
          <div className="flex items-center gap-2">
            <span className="text-amber text-base font-bold">⚠️</span>
            <div>
              <p className="font-semibold text-amber">WhatsApp Not Connected</p>
              <p className="text-ink-soft mt-0.5">
                Your WhatsApp number is disconnected. Connect it in WhatsApp settings before creating or resuming broadcasts.
              </p>
            </div>
          </div>
          <Link href="/whatsapp">
            <Button variant="quiet" className="text-xs">Connect WhatsApp</Button>
          </Link>
        </div>
      )}

      {/* Active Broadcast Warning Banner */}
      {activeBroadcast && (
        <div className="p-4 bg-pine-wash/30 border border-pine/30 rounded-lg flex items-center justify-between text-xs text-ink">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-pine animate-pulse"></span>
            <div>
              <p className="font-semibold text-pine-deep">
                Active Broadcast: &ldquo;{activeBroadcast.name}&rdquo; ({activeBroadcast.status})
              </p>
              <p className="text-ink-soft mt-0.5">
                Only one running or scheduled broadcast is allowed at a time to comply with throughput limits.
              </p>
            </div>
          </div>
          <Link href={`/broadcasts/${activeBroadcast.id}`}>
            <Button variant="quiet" className="text-xs">View Active Broadcast</Button>
          </Link>
        </div>
      )}

      {/* Broadcasts List */}
      {broadcasts.length === 0 ? (
        <Panel>
          <div className="text-center py-16 px-4">
            <div className="w-12 h-12 rounded-full bg-canvas border border-line flex items-center justify-center mx-auto text-xl mb-3">
              📢
            </div>
            <h3 className="text-base font-medium text-ink">No Broadcasts Yet</h3>
            <p className="text-xs text-ink-soft max-w-sm mx-auto mt-1 mb-5">
              Send promotional offers, seasonal reminders, or updates to your opted-in customer base.
            </p>
            <Button onClick={() => setShowModal(true)} disabled={!whatsappConnected}>
              Create First Broadcast
            </Button>
          </div>
        </Panel>
      ) : (
        <div className="space-y-4">
          {broadcasts.map((b) => {
            const statusTones: Record<string, "good" | "warn" | "neutral" | "bad"> = {
              running: "good",
              paused: "warn",
              scheduled: "neutral",
              completed: "good",
              cancelled: "neutral",
              draft: "neutral",
            };

            const total = Number(b.total_recipients);
            const sent = Number(b.sent_count);
            const queued = Number(b.queued_count);
            const failed = Number(b.failed_count);
            const skipped = Number(b.skipped_count);
            const progress = total > 0 ? Math.round((sent / total) * 100) : 0;

            return (
              <Panel key={b.id} className="relative overflow-hidden">
                {/* Pause reason banner if paused */}
                {b.status === "paused" && (
                  <div className="mb-4 -mt-2 -mx-2 px-4 py-2.5 bg-amber-wash border border-amber/30 rounded-md text-xs text-amber font-medium flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>⏸️</span>
                      <span>
                        Paused: {b.pause_reason || "Paused by user"}
                      </span>
                    </div>
                    <Button
                      variant="quiet"
                      className="text-xs py-1 px-2.5 bg-panel hover:bg-canvas"
                      onClick={() => handleAction(b.id, "resume")}
                      disabled={actionLoading === b.id || !whatsappConnected}
                    >
                      Resume Now
                    </Button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link
                        href={`/broadcasts/${b.id}`}
                        className="text-base font-semibold text-ink hover:text-pine transition-colors truncate"
                      >
                        {b.name}
                      </Link>
                      <Tag tone={statusTones[b.status] || "neutral"}>
                        {b.status.toUpperCase()}
                      </Tag>
                      {b.import_filename && (
                        <span className="text-xs text-ink-soft bg-canvas px-2 py-0.5 rounded border border-line truncate max-w-[200px]">
                          Batch: {b.import_filename}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-ink-soft mt-1 line-clamp-2 max-w-2xl">
                      {b.message}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-ink-faint mt-3 flex-wrap">
                      <span>Created {fullStamp(b.created_at, timezone)}</span>
                      {b.scheduled_at && b.status === "scheduled" && (
                        <span className="text-pine-deep font-medium">
                          Scheduled for {fullStamp(b.scheduled_at, timezone)}
                        </span>
                      )}
                      {b.started_at && <span>Started {fullStamp(b.started_at, timezone)}</span>}
                      {b.finished_at && <span>Finished {fullStamp(b.finished_at, timezone)}</span>}
                    </div>
                  </div>

                  {/* Right side action buttons */}
                  <div className="flex items-center gap-2 shrink-0">
                    {b.status === "running" && (
                      <Button
                        variant="quiet"
                        className="text-xs py-1.5"
                        onClick={() => handleAction(b.id, "pause")}
                        disabled={actionLoading === b.id}
                      >
                        Pause
                      </Button>
                    )}
                    {b.status === "paused" && (
                      <Button
                        variant="primary"
                        className="text-xs py-1.5"
                        onClick={() => handleAction(b.id, "resume")}
                        disabled={actionLoading === b.id || !whatsappConnected}
                      >
                        Resume
                      </Button>
                    )}
                    {(b.status === "running" || b.status === "paused" || b.status === "scheduled") && (
                      <Button
                        variant="danger"
                        className="text-xs py-1.5"
                        onClick={() => handleAction(b.id, "cancel")}
                        disabled={actionLoading === b.id}
                      >
                        Cancel
                      </Button>
                    )}
                    <Link href={`/broadcasts/${b.id}`}>
                      <Button variant="quiet" className="text-xs py-1.5">
                        Details &rarr;
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Progress bar & Recipient counts */}
                <div className="mt-4 pt-4 border-t border-line">
                  <div className="flex justify-between items-center text-xs text-ink-soft mb-1.5">
                    <span className="font-medium">
                      {progress}% complete ({sent} / {total} sent)
                    </span>
                    <div className="flex items-center gap-3">
                      <span>Queued: <strong className="text-ink tabular">{queued}</strong></span>
                      {failed > 0 && <span className="text-brick">Failed: <strong className="tabular">{failed}</strong></span>}
                      {skipped > 0 && (
                        <span>Skipped: <strong className="tabular">{skipped}</strong>
                          {b.skipped_cancelled > 0 && ` (${b.skipped_cancelled} cancelled)`}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="h-1.5 bg-canvas border border-line/60 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        b.status === "completed"
                          ? "bg-pine"
                          : b.status === "paused"
                          ? "bg-amber"
                          : b.status === "cancelled"
                          ? "bg-ink-faint"
                          : "bg-pine"
                      }`}
                      style={{ width: `${Math.min(100, progress)}%` }}
                    />
                  </div>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      {/* New Broadcast Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-ink/40 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-panel border border-line rounded-xl shadow-xl w-full max-w-2xl my-8 overflow-hidden">
            <div className="p-5 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink">New Broadcast Campaign</h3>
                <p className="text-xs text-ink-soft mt-0.5">
                  Send to opted-in contacts under warm-up and daily throughput limits.
                </p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-ink-soft hover:text-ink text-sm px-2 py-1"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleCreateBroadcast} className="p-6 space-y-5">
              <Field label="Campaign Name" hint="Internal reference (e.g. November Flash Sale)">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramadan Mubarak Greetings"
                  required
                  className={inputClass}
                />
              </Field>

              {/* Message composer */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm font-medium">Message Body</span>
                  <span
                    className={`text-xs tabular ${
                      messageText.length > 1000 ? "text-brick font-semibold" : "text-ink-soft"
                    }`}
                  >
                    {messageText.length} / 1000
                  </span>
                </div>
                <textarea
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  required
                  placeholder="Type your WhatsApp message here. Use {name} to personalize."
                  className={`${inputClass} font-sans`}
                />

                <div className="flex items-center justify-between mt-2 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-ink-soft">Insert:</span>
                    <button
                      type="button"
                      onClick={() => insertVariable("{name}")}
                      className="px-2 py-0.5 rounded bg-canvas border border-line hover:border-pine text-ink font-mono text-[11px]"
                    >
                      {"{name}"}
                    </button>
                    <button
                      type="button"
                      onClick={() => insertVariable("{business}")}
                      className="px-2 py-0.5 rounded bg-canvas border border-line hover:border-pine text-ink font-mono text-[11px]"
                    >
                      {"{business}"}
                    </button>
                  </div>
                  <span className="text-ink-faint">
                    &ldquo;Reply STOP to unsubscribe.&rdquo; is added automatically.
                  </span>
                </div>
              </div>

              {/* Message Live Preview */}
              <div className="p-3 bg-canvas/60 border border-line rounded-lg text-xs">
                <p className="font-semibold text-ink-soft mb-1">Preview with Sample Data:</p>
                <div className="bg-panel p-3 rounded border border-line text-ink leading-relaxed whitespace-pre-wrap">
                  {samplePreview}
                  <p className="text-[11px] text-ink-faint mt-2 border-t border-line/60 pt-1">
                    Reply STOP to unsubscribe.
                  </p>
                </div>
              </div>

              {/* Audience selection */}
              <div>
                <span className="text-sm font-medium block mb-1">Audience</span>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <label
                    className={`p-3 rounded-lg border cursor-pointer text-xs transition-colors ${
                      audienceType === "all"
                        ? "border-pine bg-pine-wash/20 font-medium"
                        : "border-line bg-canvas hover:bg-canvas/80"
                    }`}
                  >
                    <input
                      type="radio"
                      name="audience"
                      checked={audienceType === "all"}
                      onChange={() => setAudienceType("all")}
                      className="hidden"
                    />
                    <div className="font-medium text-ink">All Opted-in Contacts</div>
                    <div className="text-ink-soft mt-0.5">Every contact with verified consent</div>
                  </label>

                  <label
                    className={`p-3 rounded-lg border cursor-pointer text-xs transition-colors ${
                      audienceType === "import"
                        ? "border-pine bg-pine-wash/20 font-medium"
                        : "border-line bg-canvas hover:bg-canvas/80"
                    }`}
                  >
                    <input
                      type="radio"
                      name="audience"
                      checked={audienceType === "import"}
                      onChange={() => setAudienceType("import")}
                      className="hidden"
                    />
                    <div className="font-medium text-ink">Specific Import Batch</div>
                    <div className="text-ink-soft mt-0.5">Filter by a past CSV import</div>
                  </label>
                </div>

                {audienceType === "import" && (
                  <div className="mb-3">
                    <select
                      value={selectedImportId}
                      onChange={(e) => setSelectedImportId(e.target.value)}
                      className={inputClass}
                      required
                    >
                      <option value="">Select an import batch...</option>
                      {imports.map((imp) => (
                        <option key={imp.id} value={imp.id}>
                          #{imp.id} - {imp.filename || "contacts.csv"} ({imp.valid_rows} contacts, {new Date(imp.created_at).toLocaleDateString()})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Audience breakdown & estimate stats */}
                <div className="bg-canvas border border-line rounded-lg p-3 text-xs">
                  {loadingEstimate ? (
                    <p className="text-ink-soft animate-pulse">Calculating audience numbers and estimate...</p>
                  ) : estimateData ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-pine-deep text-sm">
                          Eligible (Opted-in): {estimateData.eligible}
                        </span>
                        <span className="text-ink-soft">
                          Excluded: {estimateData.optedOut} opted out, {estimateData.unknown} unknown
                        </span>
                      </div>
                      <div className="pt-2 border-t border-line/60 flex items-center justify-between text-ink-soft">
                        <span>
                          Effective Daily Cap: <strong>{caps.effectiveDailyCap} msgs/day</strong>
                          <span className="text-ink-faint ml-1">
                            (Warmup: {caps.warmUpCap}, Earlier days: {caps.earlierSendingDays})
                          </span>
                        </span>
                        <span className="font-medium text-ink">
                          Est. Time: {estimateData.estimateText}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Timing */}
              <div>
                <span className="text-sm font-medium block mb-1">Timing</span>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <label
                    className={`p-3 rounded-lg border cursor-pointer text-xs transition-colors ${
                      timingType === "now"
                        ? "border-pine bg-pine-wash/20 font-medium"
                        : "border-line bg-canvas hover:bg-canvas/80"
                    }`}
                  >
                    <input
                      type="radio"
                      name="timing"
                      checked={timingType === "now"}
                      onChange={() => setTimingType("now")}
                      className="hidden"
                    />
                    <div className="font-medium text-ink">Start Immediately</div>
                    <div className="text-ink-soft mt-0.5">Rows written right now for n8n to send</div>
                  </label>

                  <label
                    className={`p-3 rounded-lg border cursor-pointer text-xs transition-colors ${
                      timingType === "schedule"
                        ? "border-pine bg-pine-wash/20 font-medium"
                        : "border-line bg-canvas hover:bg-canvas/80"
                    }`}
                  >
                    <input
                      type="radio"
                      name="timing"
                      checked={timingType === "schedule"}
                      onChange={() => setTimingType("schedule")}
                      className="hidden"
                    />
                    <div className="font-medium text-ink">Schedule for Later</div>
                    <div className="text-ink-soft mt-0.5">In workspace timezone ({timezone})</div>
                  </label>
                </div>

                {timingType === "schedule" && (
                  <Field label="Send At" hint={`Tenant time zone: ${timezone}`}>
                    <input
                      type="datetime-local"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      required
                      className={inputClass}
                    />
                  </Field>
                )}
              </div>

              <div className="pt-4 border-t border-line flex justify-end gap-3">
                <Button type="button" variant="quiet" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={
                    creating ||
                    Boolean(activeBroadcast) ||
                    !whatsappConnected ||
                    Boolean(estimateData && estimateData.eligible === 0)
                  }
                >
                  {creating ? "Creating Campaign..." : timingType === "schedule" ? "Schedule Broadcast" : "Start Broadcast Now"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Toast message={toastMsg} />
    </div>
  );
}
