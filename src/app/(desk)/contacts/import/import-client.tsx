"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Panel, PageHead, Button, Field, inputClass, Tag, Toast, useToast } from "@/components/ui";
import { CONSENT_SOURCES } from "@/lib/contacts-import";

type PreviewRow = {
  rawPhone: string;
  normalizedPhone: string;
  name: string;
  valid: boolean;
  reason?: string;
  isDuplicate?: boolean;
  isExisting?: boolean;
  isOptedOut?: boolean;
  statusNote?: string;
};

type ImportCounts = {
  totalRows: number;
  validCount: number;
  invalidCount: number;
  duplicateCount: number;
  alreadyExisting: number;
  alreadyOptedOut: number;
};

type ImportReport = {
  importId: number;
  created: number;
  updated: number;
  skipped: number;
  skippedOptedOut: number;
  invalid: number;
  duplicates: number;
};

export default function ImportClient() {
  const router = useRouter();
  const { message, show } = useToast();

  const [activeTab, setActiveTab] = useState<"csv" | "single">("csv");

  // CSV import state
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState<string>("");
  const [countryPrefix, setCountryPrefix] = useState<string>("974");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [counts, setCounts] = useState<ImportCounts | null>(null);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // Consent state for CSV
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [consentSource, setConsentSource] = useState<string>("existing_customers");
  const [consentNote, setConsentNote] = useState("");
  const [importing, setImporting] = useState(false);
  const [report, setReport] = useState<ImportReport | null>(null);

  // Single contact state
  const [singlePhone, setSinglePhone] = useState("");
  const [singleName, setSingleName] = useState("");
  const [singleConsentConfirmed, setSingleConsentConfirmed] = useState(false);
  const [singleConsentSource, setSingleConsentSource] = useState<string>("customer_form");
  const [singleConsentNote, setSingleConsentNote] = useState("");
  const [singleSubmitting, setSingleSubmitting] = useState(false);

  // Handle file selection
  async function handleFileChange(selectedFile: File) {
    if (!selectedFile) return;
    if (selectedFile.size > 2 * 1024 * 1024) {
      alert("File is too large. Maximum allowed size is 2 MB.");
      return;
    }
    setFile(selectedFile);
    setReport(null);
    setPreviewError(null);
    setLoadingPreview(true);

    try {
      const text = await selectedFile.text();
      setCsvContent(text);

      const res = await fetch("/api/contacts/import/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvContent: text, countryPrefix }),
      });
      const data = await res.json();
      if (!data.ok) {
        setPreviewError(data.error || "Could not parse CSV.");
        setCounts(null);
        setPreviewRows([]);
      } else {
        setCounts(data.counts);
        setPreviewRows(data.previewRows);
      }
    } catch {
      setPreviewError("Failed to read file.");
    } finally {
      setLoadingPreview(false);
    }
  }

  // Trigger import
  async function handleImport() {
    if (!consentConfirmed) {
      alert("You must confirm the consent declaration before importing contacts.");
      return;
    }
    if (!csvContent) return;

    setImporting(true);
    try {
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvContent,
          countryPrefix,
          consentConfirmed,
          consentSource,
          consentNote,
          filename: file?.name || "contacts.csv",
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        show(data.message || data.error || "Import failed.");
      } else {
        setReport(data.report);
        show("Import completed successfully!");
      }
    } catch {
      show("Network error during import.");
    } finally {
      setImporting(false);
    }
  }

  // Handle Single contact submission
  async function handleSingleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!singleConsentConfirmed) {
      alert("You must confirm the consent declaration before adding a contact.");
      return;
    }
    setSingleSubmitting(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: singlePhone,
          name: singleName,
          consentConfirmed: singleConsentConfirmed,
          consentSource: singleConsentSource,
          consentNote: singleConsentNote,
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        show(data.message || data.error || "Failed to add contact.");
      } else {
        show(data.status === "updated" ? "Contact updated." : "Contact added successfully!");
        setSinglePhone("");
        setSingleName("");
        setSingleConsentNote("");
        setSingleConsentConfirmed(false);
      }
    } catch {
      show("Network error.");
    } finally {
      setSingleSubmitting(false);
    }
  }

  function downloadSampleCsv() {
    const csv = "phone,name\n97433112233,John Doe\n97455223344,Sarah Al-Thani\n97466334455,Ahmed Hassan\n";
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "sample-contacts.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <PageHead
        title="Import Contacts"
        lead="Add contacts with explicit consent for WhatsApp messaging."
        action={
          <Link href="/contacts" className="text-sm text-ink-soft hover:text-ink font-medium">
            &larr; Back to Contacts
          </Link>
        }
      />

      {/* Tabs */}
      <div className="flex border-b border-line gap-4">
        <button
          onClick={() => setActiveTab("csv")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "csv"
              ? "border-pine text-pine-deep"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          CSV File Upload (up to 5,000)
        </button>
        <button
          onClick={() => setActiveTab("single")}
          className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "single"
              ? "border-pine text-pine-deep"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          Single Contact Entry
        </button>
      </div>

      {activeTab === "csv" ? (
        <div className="space-y-6">
          {/* Upload card */}
          <Panel>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-line">
              <div>
                <h2 className="text-base font-semibold">1. Select CSV File</h2>
                <p className="text-xs text-ink-soft mt-0.5">
                  CSV format (UTF-8, max 5,000 rows, max 2 MB). Required column: <code className="bg-canvas px-1 rounded">phone</code>. Optional: <code className="bg-canvas px-1 rounded">name</code>.
                </p>
              </div>
              <button
                type="button"
                onClick={downloadSampleCsv}
                className="text-xs text-pine hover:underline font-medium"
              >
                Download Sample CSV
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label className="border-2 border-dashed border-line hover:border-pine rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer transition-colors bg-canvas/30">
                  <svg className="w-8 h-8 text-ink-soft mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-sm font-medium text-ink">
                    {file ? file.name : "Click or drag CSV file here"}
                  </span>
                  <span className="text-xs text-ink-soft mt-1">
                    {file ? `${(file.size / 1024).toFixed(1)} KB` : "Supports UTF-8 with or without BOM"}
                  </span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
                  />
                </label>
              </div>

              <div>
                <Field label="Default Country Code" hint="Prefixed to 8-digit Qatar numbers">
                  <input
                    value={countryPrefix}
                    onChange={(e) => setCountryPrefix(e.target.value)}
                    placeholder="974"
                    className={inputClass}
                  />
                </Field>
                <p className="text-xs text-ink-faint mt-2 leading-relaxed">
                  Local 8-digit numbers starting with 3, 5, 6, 7 will automatically be prefixed with {countryPrefix}.
                </p>
              </div>
            </div>

            {loadingPreview && (
              <p className="text-sm text-ink-soft mt-4 animate-pulse">Reading and analyzing contacts...</p>
            )}

            {previewError && (
              <div className="mt-4 p-3 bg-[#f8ebe9] border border-brick/20 rounded-md text-xs text-brick font-medium">
                {previewError}
              </div>
            )}
          </Panel>

          {/* Counts & Preview */}
          {counts && (
            <Panel>
              <h2 className="text-base font-semibold mb-4">2. Validation Summary & Preview</h2>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
                <div className="bg-canvas border border-line rounded-lg p-3">
                  <p className="text-xs text-ink-soft">Valid</p>
                  <p className="text-2xl font-semibold text-pine-deep tabular mt-1">{counts.validCount}</p>
                </div>
                <div className="bg-canvas border border-line rounded-lg p-3">
                  <p className="text-xs text-ink-soft">Invalid</p>
                  <p className="text-2xl font-semibold text-brick tabular mt-1">{counts.invalidCount}</p>
                </div>
                <div className="bg-canvas border border-line rounded-lg p-3">
                  <p className="text-xs text-ink-soft">Duplicates in File</p>
                  <p className="text-2xl font-semibold text-amber tabular mt-1">{counts.duplicateCount}</p>
                </div>
                <div className="bg-canvas border border-line rounded-lg p-3">
                  <p className="text-xs text-ink-soft">Already Existing</p>
                  <p className="text-2xl font-semibold text-ink tabular mt-1">{counts.alreadyExisting}</p>
                </div>
                <div className="bg-canvas border border-line rounded-lg p-3">
                  <p className="text-xs text-ink-soft">Already Opted Out</p>
                  <p className="text-2xl font-semibold text-brick tabular mt-1">{counts.alreadyOptedOut}</p>
                  <p className="text-[10px] text-ink-faint mt-0.5">Will be skipped</p>
                </div>
              </div>

              {/* Preview table */}
              <div className="overflow-x-auto border border-line rounded-md">
                <table className="w-full text-left text-xs divide-y divide-line">
                  <thead className="bg-canvas/50 text-ink-soft uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Original Phone</th>
                      <th className="py-2.5 px-3">Normalized (+E.164)</th>
                      <th className="py-2.5 px-3">Name</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Notes / Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-panel">
                    {previewRows.map((r, i) => (
                      <tr key={i} className={!r.valid ? "bg-[#fdf6f5]" : r.isOptedOut ? "bg-amber-wash/30" : ""}>
                        <td className="py-2 px-3 text-ink-soft">{i + 1}</td>
                        <td className="py-2 px-3 font-mono">{r.rawPhone || "—"}</td>
                        <td className="py-2 px-3 font-mono font-medium">
                          {r.normalizedPhone ? `+${r.normalizedPhone}` : "—"}
                        </td>
                        <td className="py-2 px-3">{r.name || "—"}</td>
                        <td className="py-2 px-3">
                          {!r.valid ? (
                            <Tag tone="bad">Invalid</Tag>
                          ) : r.isOptedOut ? (
                            <Tag tone="bad">Opted Out</Tag>
                          ) : r.isExisting ? (
                            <Tag tone="neutral">Existing</Tag>
                          ) : (
                            <Tag tone="good">Valid New</Tag>
                          )}
                        </td>
                        <td className="py-2 px-3 text-ink-soft">{r.reason || r.statusNote || "Ready to import"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {counts.totalRows > 20 && (
                <p className="text-xs text-ink-soft mt-2 text-right">
                  Showing first 20 rows of {counts.totalRows}
                </p>
              )}
            </Panel>
          )}

          {/* Consent declaration box */}
          {counts && counts.validCount > 0 && (
            <Panel className="border-pine/40 bg-pine-wash/10">
              <h2 className="text-base font-semibold text-ink mb-2">3. Mandatory Consent Declaration</h2>

              {/* Warning Alert */}
              <div className="mb-4 p-3.5 bg-amber-wash border border-amber/30 rounded-md flex items-start gap-3 text-xs text-ink">
                <span className="text-amber text-base font-bold leading-none">⚠️</span>
                <div>
                  <p className="font-semibold text-amber">Important WhatsApp Compliance Warning</p>
                  <p className="text-ink-soft mt-0.5 leading-relaxed">
                    Messaging people who did not explicitly agree can get your WhatsApp number permanently banned, and local privacy laws may require verifiable opt-in consent. Never import scraped or purchased lists.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Consent Source (Required)" hint="Where did these customers agree to receive messages?">
                    <select
                      value={consentSource}
                      onChange={(e) => setConsentSource(e.target.value)}
                      className={inputClass}
                      required
                    >
                      {CONSENT_SOURCES.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Consent Note (Optional)" hint="e.g. In-store loyalty sign-up form October 2026">
                    <input
                      value={consentNote}
                      onChange={(e) => setConsentNote(e.target.value)}
                      placeholder="Reference, campaign name, or form link"
                      className={inputClass}
                    />
                  </Field>
                </div>

                <div className="pt-2">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={consentConfirmed}
                      onChange={(e) => setConsentConfirmed(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-line text-pine focus:ring-pine cursor-pointer"
                    />
                    <span className="text-sm font-medium text-ink leading-tight">
                      I confirm these people agreed to receive WhatsApp messages from my business and I can show proof if asked
                    </span>
                  </label>
                </div>

                <div className="pt-4 border-t border-line flex items-center justify-between">
                  <p className="text-xs text-ink-soft">
                    {consentConfirmed
                      ? `Ready to import ${counts.validCount} valid contacts.`
                      : "Please check the consent box above to enable import."}
                  </p>
                  <Button
                    onClick={handleImport}
                    disabled={!consentConfirmed || importing || counts.validCount === 0}
                  >
                    {importing ? "Importing Contacts..." : `Import ${counts.validCount} Contacts`}
                  </Button>
                </div>
              </div>
            </Panel>
          )}

          {/* Import Report Modal / Card */}
          {report && (
            <Panel className="border-pine bg-pine-wash/20">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2.5 h-2.5 rounded-full bg-pine"></span>
                <h3 className="text-lg font-semibold text-pine-deep">Import Completed Successfully</h3>
              </div>
              <p className="text-sm text-ink-soft mb-4">
                Batch #{report.importId} has been processed in a single transaction.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                <div className="bg-panel border border-line rounded-lg p-3">
                  <p className="text-xs text-ink-soft">Created New</p>
                  <p className="text-2xl font-semibold text-pine tabular">{report.created}</p>
                </div>
                <div className="bg-panel border border-line rounded-lg p-3">
                  <p className="text-xs text-ink-soft">Updated Existing</p>
                  <p className="text-2xl font-semibold text-ink tabular">{report.updated}</p>
                </div>
                <div className="bg-panel border border-line rounded-lg p-3">
                  <p className="text-xs text-ink-soft">Skipped (Opted Out)</p>
                  <p className="text-2xl font-semibold text-brick tabular">{report.skippedOptedOut}</p>
                  <p className="text-[10px] text-ink-faint">Preserved opt-out status</p>
                </div>
                <div className="bg-panel border border-line rounded-lg p-3">
                  <p className="text-xs text-ink-soft">Total Skipped/Invalid</p>
                  <p className="text-2xl font-semibold text-ink-soft tabular">{report.skipped}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <Link href="/contacts">
                  <Button variant="quiet">View Contacts</Button>
                </Link>
                <Link href="/broadcasts">
                  <Button>Go to Broadcasts</Button>
                </Link>
              </div>
            </Panel>
          )}
        </div>
      ) : (
        /* Single Contact Form */
        <Panel>
          <form onSubmit={handleSingleSubmit} className="space-y-4 max-w-lg">
            <h2 className="text-base font-semibold mb-2">Add a Single Contact with Consent</h2>

            <Field label="Phone Number (Required)" hint="Qatar numbers or international with country code">
              <input
                value={singlePhone}
                onChange={(e) => setSinglePhone(e.target.value)}
                placeholder="e.g. 97433112233 or 33112233"
                required
                className={inputClass}
              />
            </Field>

            <Field label="Customer Name (Optional)">
              <input
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                placeholder="e.g. Sarah Smith"
                className={inputClass}
              />
            </Field>

            <Field label="Consent Source (Required)">
              <select
                value={singleConsentSource}
                onChange={(e) => setSingleConsentSource(e.target.value)}
                className={inputClass}
                required
              >
                {CONSENT_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Consent Note (Optional)">
              <input
                value={singleConsentNote}
                onChange={(e) => setSingleConsentNote(e.target.value)}
                placeholder="e.g. Agreed via front desk tablet"
                className={inputClass}
              />
            </Field>

            {/* Warning Alert */}
            <div className="p-3 bg-amber-wash border border-amber/30 rounded-md text-xs text-ink leading-relaxed">
              <p className="font-semibold text-amber">Opt-in Consent Required</p>
              Staff cannot change an opted-out contact manually. Messaging people without consent may result in WhatsApp account bans.
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={singleConsentConfirmed}
                  onChange={(e) => setSingleConsentConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-line text-pine focus:ring-pine cursor-pointer"
                />
                <span className="text-sm font-medium text-ink leading-tight">
                  I confirm these people agreed to receive WhatsApp messages from my business and I can show proof if asked
                </span>
              </label>
            </div>

            <div className="pt-4">
              <Button type="submit" disabled={!singleConsentConfirmed || singleSubmitting}>
                {singleSubmitting ? "Adding Contact..." : "Add Contact"}
              </Button>
            </div>
          </form>
        </Panel>
      )}

      <Toast message={message} />
    </div>
  );
}
