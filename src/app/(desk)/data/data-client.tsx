"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Panel, PageHead, Button, Field, inputClass, Tag, Toast, useToast } from "@/components/ui";
import { CONSENT_SOURCES } from "@/lib/contacts-import";
import { fullStamp } from "@/lib/format";

type Kind = "customers" | "catalog" | "knowledge";

type KnowledgeTable = {
  id: number;
  name: string;
  title: string;
  description: string;
  columns: any;
  row_count: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type UploadRecord = {
  id: number;
  kind: Kind;
  filename: string;
  total_rows: number;
  imported_rows: number;
  rejected_rows: number;
  target_table_id: number | null;
  created_at: string;
  uploaded_by_name: string | null;
};

type Props = {
  initialTables: KnowledgeTable[];
  initialUploads: UploadRecord[];
  contactsWithFieldsCount: number;
  userName: string;
};

export default function DataClient({
  initialTables,
  initialUploads,
  contactsWithFieldsCount,
}: Props) {
  const router = useRouter();
  const { message: toastMsg, show: showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"wizard" | "manage">("wizard");
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  // Step 1: Selected kind
  const [selectedKind, setSelectedKind] = useState<Kind>("customers");

  // Step 2: Upload state
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState("");
  const [parsing, setParsing] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Server parse result
  const [parseResult, setParseResult] = useState<any>(null);

  // Step 3: Mapping state
  // For Customers:
  const [phoneCol, setPhoneCol] = useState<number>(0);
  const [nameCol, setNameCol] = useState<number | null>(null);
  const [customFieldMap, setCustomFieldMap] = useState<Record<string, string>>({});
  const [customerMode, setCustomerMode] = useState<"assistant_only" | "promotional">("assistant_only");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [consentSource, setConsentSource] = useState<string>("existing_customers");
  const [consentNote, setConsentNote] = useState("");

  // For Catalog:
  const [catalogColMap, setCatalogColMap] = useState<Record<string, number>>({});

  // For Knowledge:
  const [tableTitle, setTableTitle] = useState("");
  const [tableName, setTableName] = useState("");
  const [tableDescription, setTableDescription] = useState("");
  const [knowledgeMode, setKnowledgeMode] = useState<"replace" | "append">("replace");
  const [targetExistingTableId, setTargetExistingTableId] = useState<number | null>(null);
  const [knowledgeColumns, setKnowledgeColumns] = useState<any[]>([]);

  // Step 4: Import state
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState<any>(null);

  // Management State
  const [tables, setTables] = useState<KnowledgeTable[]>(initialTables);
  const [uploads, setUploads] = useState<UploadRecord[]>(initialUploads);
  const [customFieldsCount, setCustomFieldsCount] = useState<number>(contactsWithFieldsCount);

  // Table rows inspection modal
  const [viewingTable, setViewingTable] = useState<KnowledgeTable | null>(null);
  const [tableRows, setTableRows] = useState<any[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowSearch, setRowSearch] = useState("");
  const [rowPagination, setRowPagination] = useState({ page: 1, limit: 25, total: 0, totalPages: 1 });

  // Edit description modal
  const [editingTable, setEditingTable] = useState<KnowledgeTable | null>(null);
  const [editDescText, setEditDescText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Clear custom fields modal
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);

  // 1. Handle File Selection in Step 2
  async function handleFileSelected(selectedFile: File) {
    if (!selectedFile) return;
    if (selectedFile.size > 2 * 1024 * 1024) {
      setUploadError("File exceeds 2 MB limit.");
      return;
    }

    setFile(selectedFile);
    setUploadError(null);
    setParsing(true);
    setImportReport(null);

    try {
      const text = await selectedFile.text();
      setCsvContent(text);

      const res = await fetch("/api/data/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          csvContent: text,
          kind: selectedKind,
          filename: selectedFile.name,
        }),
      });

      const data = await res.json();
      if (!data.ok) {
        setUploadError(data.error || "Failed to parse CSV file.");
        setParseResult(null);
      } else {
        setParseResult(data);
        // Initialize mappings based on parsed result
        if (selectedKind === "customers") {
          setPhoneCol(data.detectedMapping.phoneColumn ?? 0);
          setNameCol(data.detectedMapping.nameColumn);
          setCustomFieldMap(data.detectedMapping.customFields || {});
        } else if (selectedKind === "catalog") {
          setCatalogColMap(data.detectedMapping || {});
        } else if (selectedKind === "knowledge") {
          setTableTitle(data.suggestedTitle || "Knowledge Table");
          setTableName(data.suggestedName || "knowledge_data");
          setKnowledgeColumns(data.columns || []);
        }
        setStep(3);
      }
    } catch {
      setUploadError("Network error while reading and uploading file.");
    } finally {
      setParsing(false);
    }
  }

  // 2. Handle Execute Import (Step 4)
  async function handleExecuteImport() {
    if (!csvContent) return;

    if (selectedKind === "customers" && customerMode === "promotional" && !consentConfirmed) {
      alert("You must confirm the consent declaration before importing promotional contacts.");
      return;
    }

    if (selectedKind === "knowledge" && !tableDescription.trim()) {
      alert("Please provide the 'When should the assistant use this?' description.");
      return;
    }

    setImporting(true);
    try {
      const payload: any = {
        kind: selectedKind,
        filename: file?.name || `${selectedKind}.csv`,
        csvContent,
      };

      if (selectedKind === "customers") {
        payload.phoneColumn = phoneCol;
        payload.nameColumn = nameCol;
        payload.customFields = customFieldMap;
        payload.customerMode = customerMode;
        if (customerMode === "promotional") {
          payload.consentConfirmed = consentConfirmed;
          payload.consentSource = consentSource;
          payload.consentNote = consentNote;
        }
      } else if (selectedKind === "catalog") {
        payload.columnMap = catalogColMap;
      } else if (selectedKind === "knowledge") {
        payload.tableId = targetExistingTableId;
        payload.tableName = tableName;
        payload.tableTitle = tableTitle;
        payload.tableDescription = tableDescription;
        payload.knowledgeMode = knowledgeMode;
        payload.columns = knowledgeColumns;
      }

      const res = await fetch("/api/data/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.ok) {
        showToast(data.error || "Import failed.");
        alert(data.error || "Import failed.");
      } else {
        setImportReport(data);
        setStep(4);
        showToast("Data imported successfully!");
        refreshManagementData();
      }
    } catch {
      showToast("Network error during import.");
    } finally {
      setImporting(false);
    }
  }

  // 3. Refresh tables and uploads
  async function refreshManagementData() {
    try {
      const res = await fetch("/api/data/tables");
      const data = await res.json();
      if (data.ok) {
        setTables(data.tables || []);
        setUploads(data.uploads || []);
      }
      router.refresh();
    } catch {}
  }

  // 4. Toggle knowledge table active state
  async function toggleTableActive(table: KnowledgeTable) {
    try {
      const res = await fetch(`/api/data/tables/${table.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !table.active }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Table ${table.name} is now ${!table.active ? "active" : "inactive"}.`);
        refreshManagementData();
      } else {
        showToast(data.error || "Failed to update table.");
      }
    } catch {
      showToast("Network error.");
    }
  }

  // 5. Delete knowledge table
  async function deleteTable(table: KnowledgeTable) {
    if (!confirm(`Are you sure you want to delete table "${table.title}" (${table.name})? All ${table.row_count} rows will be permanently deleted.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/data/tables/${table.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        showToast("Table deleted.");
        refreshManagementData();
      } else {
        showToast(data.error || "Failed to delete table.");
      }
    } catch {
      showToast("Network error.");
    }
  }

  // 6. View Table Rows
  async function openViewRows(table: KnowledgeTable, page = 1, search = "") {
    setViewingTable(table);
    setLoadingRows(true);
    setRowSearch(search);
    try {
      const res = await fetch(
        `/api/data/tables/${table.id}?page=${page}&limit=25&search=${encodeURIComponent(search)}`
      );
      const data = await res.json();
      if (data.ok) {
        setTableRows(data.rows || []);
        setRowPagination(data.pagination || { page: 1, limit: 25, total: 0, totalPages: 1 });
      }
    } catch {
      showToast("Failed to load table rows.");
    } finally {
      setLoadingRows(false);
    }
  }

  // 7. Save edited description
  async function saveDescriptionEdit() {
    if (!editingTable) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/data/tables/${editingTable.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description: editDescText.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("Description updated.");
        setEditingTable(null);
        refreshManagementData();
      } else {
        showToast(data.error || "Failed to update description.");
      }
    } catch {
      showToast("Network error.");
    } finally {
      setSavingEdit(false);
    }
  }

  // 8. Clear all custom fields
  async function handleClearCustomFields() {
    setClearing(true);
    try {
      const res = await fetch("/api/data/customers/clear", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        showToast(`Cleared custom fields from ${data.clearedCount} contacts.`);
        setCustomFieldsCount(0);
        setShowClearModal(false);
        router.refresh();
      } else {
        showToast(data.error || "Failed to clear custom fields.");
      }
    } catch {
      showToast("Network error.");
    } finally {
      setClearing(false);
    }
  }

  // Launch replace for an existing knowledge table
  function startReplaceForTable(table: KnowledgeTable) {
    setSelectedKind("knowledge");
    setTargetExistingTableId(table.id);
    setTableName(table.name);
    setTableTitle(table.title);
    setTableDescription(table.description);
    setKnowledgeMode("replace");
    setStep(2);
    setActiveTab("wizard");
  }

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <PageHead
        title="Data Files"
        lead="Feed structured customer details, catalogs, and knowledge tables into your WhatsApp AI assistant."
        action={
          <div className="flex items-center gap-2">
            <Button
              variant={activeTab === "wizard" ? "primary" : "quiet"}
              onClick={() => {
                setActiveTab("wizard");
                if (step === 4) setStep(1);
              }}
            >
              + Upload Data Wizard
            </Button>
            <Button
              variant={activeTab === "manage" ? "primary" : "quiet"}
              onClick={() => setActiveTab("manage")}
            >
              Manage Tables & Files ({tables.length})
            </Button>
          </div>
        }
      />

      {/* Explanatory banner card on how the assistant uses data */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-canvas border border-line rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-pine font-semibold text-xs uppercase tracking-wider mb-1">
              <span>👤</span> Customers with Details
            </div>
            <p className="text-xs text-ink-soft leading-relaxed">
              Assistant personalizes answers using customer attributes like loyalty tier, company name, city, or preferences.
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-line/60">
            <p className="text-[11px] font-semibold text-ink-soft mb-1">Example customer questions:</p>
            <ul className="text-[11px] text-ink space-y-1 list-disc list-inside">
              <li>&ldquo;What is my loyalty discount level?&rdquo;</li>
              <li>&ldquo;Do you have my delivery address on file?&rdquo;</li>
              <li>&ldquo;Can you check my VIP status?&rdquo;</li>
            </ul>
          </div>
        </div>

        <div className="bg-canvas border border-line rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-pine font-semibold text-xs uppercase tracking-wider mb-1">
              <span>📦</span> Catalog & Price List
            </div>
            <p className="text-xs text-ink-soft leading-relaxed">
              Assistant checks real-time prices, product descriptions, units, and stock quantities to answer shopper inquiries.
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-line/60">
            <p className="text-[11px] font-semibold text-ink-soft mb-1">Example customer questions:</p>
            <ul className="text-[11px] text-ink space-y-1 list-disc list-inside">
              <li>&ldquo;How much is the organic milk?&rdquo;</li>
              <li>&ldquo;Do you have sourdough bread in stock?&rdquo;</li>
              <li>&ldquo;Can I order 2 kg of fresh red apples?&rdquo;</li>
            </ul>
          </div>
        </div>

        <div className="bg-canvas border border-line rounded-xl p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-pine font-semibold text-xs uppercase tracking-wider mb-1">
              <span>📚</span> Knowledge Tables
            </div>
            <p className="text-xs text-ink-soft leading-relaxed">
              Assistant searches delivery rules, class schedules, clinic timetables, or branch locations by context.
            </p>
          </div>
          <div className="mt-3 pt-3 border-t border-line/60">
            <p className="text-[11px] font-semibold text-ink-soft mb-1">Example customer questions:</p>
            <ul className="text-[11px] text-ink space-y-1 list-disc list-inside">
              <li>&ldquo;Do you deliver to Al Wakrah and what is the fee?&rdquo;</li>
              <li>&ldquo;What are Dr. Sarah&apos;s clinic hours on Tuesdays?&rdquo;</li>
              <li>&ldquo;Where is your nearest branch in Doha?&rdquo;</li>
            </ul>
          </div>
        </div>
      </div>

      {/* ---------------- WIZARD TAB ---------------- */}
      {activeTab === "wizard" && (
        <div className="space-y-6">
          {/* Step Progress Indicator */}
          <div className="flex items-center justify-between border-b border-line pb-4 text-xs font-medium">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setStep(1)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md ${
                  step === 1 ? "bg-pine text-white" : "text-ink-soft hover:bg-canvas"
                }`}
              >
                <span>1.</span> Pick Kind
              </button>
              <button
                onClick={() => file && setStep(2)}
                disabled={!file && step < 2}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md ${
                  step === 2 ? "bg-pine text-white" : "text-ink-soft hover:bg-canvas disabled:opacity-40"
                }`}
              >
                <span>2.</span> Upload CSV
              </button>
              <button
                onClick={() => parseResult && setStep(3)}
                disabled={!parseResult && step < 3}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md ${
                  step === 3 ? "bg-pine text-white" : "text-ink-soft hover:bg-canvas disabled:opacity-40"
                }`}
              >
                <span>3.</span> Map & Preview
              </button>
              <button
                onClick={() => importReport && setStep(4)}
                disabled={!importReport}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md ${
                  step === 4 ? "bg-pine text-white" : "text-ink-soft hover:bg-canvas disabled:opacity-40"
                }`}
              >
                <span>4.</span> Summary
              </button>
            </div>
            <span className="text-ink-faint">Step {step} of 4</span>
          </div>

          {/* STEP 1: Pick the Kind */}
          {step === 1 && (
            <Panel>
              <h2 className="text-base font-semibold text-ink mb-1">Step 1: Pick the Data Kind</h2>
              <p className="text-xs text-ink-soft mb-6">
                Choose what type of information you are importing into your workspace.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Customers card */}
                <div
                  onClick={() => {
                    setSelectedKind("customers");
                    setTargetExistingTableId(null);
                    setStep(2);
                  }}
                  className={`border-2 rounded-xl p-5 cursor-pointer transition-all hover:border-pine flex flex-col justify-between ${
                    selectedKind === "customers" ? "border-pine bg-pine-wash/20" : "border-line bg-panel"
                  }`}
                >
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-pine-wash text-pine flex items-center justify-center text-xl mb-3">
                      👤
                    </div>
                    <h3 className="text-sm font-semibold text-ink mb-1">Customers with details</h3>
                    <p className="text-xs text-ink-soft leading-relaxed">
                      Import customer profiles with phone numbers, names, and any custom columns (loyalty tier, company, city, preferences).
                    </p>
                    <div className="mt-3 p-2.5 bg-canvas rounded border border-line text-[11px] font-mono text-ink-soft">
                      phone,name,company,city,vip_tier
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
                    <a
                      href="/api/data/sample?kind=customers"
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-pine font-medium hover:underline"
                    >
                      Download sample CSV &darr;
                    </a>
                    <span className="text-xs font-semibold text-pine">Select &rarr;</span>
                  </div>
                </div>

                {/* Catalog card */}
                <div
                  onClick={() => {
                    setSelectedKind("catalog");
                    setTargetExistingTableId(null);
                    setStep(2);
                  }}
                  className={`border-2 rounded-xl p-5 cursor-pointer transition-all hover:border-pine flex flex-col justify-between ${
                    selectedKind === "catalog" ? "border-pine bg-pine-wash/20" : "border-line bg-panel"
                  }`}
                >
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-pine-wash text-pine flex items-center justify-center text-xl mb-3">
                      📦
                    </div>
                    <h3 className="text-sm font-semibold text-ink mb-1">Catalog or price list</h3>
                    <p className="text-xs text-ink-soft leading-relaxed">
                      Upload your products and service catalog with categories, prices, units, and stock availability for quick AI retrieval.
                    </p>
                    <div className="mt-3 p-2.5 bg-canvas rounded border border-line text-[11px] font-mono text-ink-soft">
                      category,name,price,unit,stock
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
                    <a
                      href="/api/data/sample?kind=catalog"
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-pine font-medium hover:underline"
                    >
                      Download sample CSV &darr;
                    </a>
                    <span className="text-xs font-semibold text-pine">Select &rarr;</span>
                  </div>
                </div>

                {/* Knowledge card */}
                <div
                  onClick={() => {
                    setSelectedKind("knowledge");
                    setTargetExistingTableId(null);
                    setStep(2);
                  }}
                  className={`border-2 rounded-xl p-5 cursor-pointer transition-all hover:border-pine flex flex-col justify-between ${
                    selectedKind === "knowledge" ? "border-pine bg-pine-wash/20" : "border-line bg-panel"
                  }`}
                >
                  <div>
                    <div className="w-10 h-10 rounded-lg bg-pine-wash text-pine flex items-center justify-center text-xl mb-3">
                      📚
                    </div>
                    <h3 className="text-sm font-semibold text-ink mb-1">Knowledge table</h3>
                    <p className="text-xs text-ink-soft leading-relaxed">
                      Custom structured reference data such as delivery areas &amp; fees, doctor schedules, branch contacts, or class timetables.
                    </p>
                    <div className="mt-3 p-2.5 bg-canvas rounded border border-line text-[11px] font-mono text-ink-soft">
                      zone,min_order,fee,areas_covered
                    </div>
                  </div>
                  <div className="mt-4 pt-3 border-t border-line flex items-center justify-between">
                    <a
                      href="/api/data/sample?kind=knowledge"
                      download
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-pine font-medium hover:underline"
                    >
                      Download sample CSV &darr;
                    </a>
                    <span className="text-xs font-semibold text-pine">Select &rarr;</span>
                  </div>
                </div>
              </div>
            </Panel>
          )}

          {/* STEP 2: Upload CSV */}
          {step === 2 && (
            <Panel>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-semibold text-ink">
                    Step 2: Upload {selectedKind === "customers" ? "Customers" : selectedKind === "catalog" ? "Catalog" : "Knowledge"} CSV
                  </h2>
                  <p className="text-xs text-ink-soft mt-0.5">
                    CSV only, max 2 MB and 5,000 rows. Delimiter (comma, semicolon, tab) is automatically detected.
                  </p>
                </div>
                <Button variant="quiet" onClick={() => setStep(1)}>
                  &larr; Back to Step 1
                </Button>
              </div>

              {/* Excel Tip Banner */}
              <div className="mb-4 p-3 bg-canvas border border-line rounded-md flex items-center gap-2.5 text-xs text-ink">
                <span className="text-pine font-bold">💡 Tip:</span>
                <span>
                  In Excel use <strong>Save As &rarr; CSV UTF-8 (Comma delimited) (.csv)</strong>.
                </span>
              </div>

              {/* Target Existing Table Banner (if replacing) */}
              {targetExistingTableId && (
                <div className="mb-4 p-3 bg-amber-wash border border-amber/30 rounded-md text-xs text-ink flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-amber">Replacing Table:</span> {tableTitle} (<code>{tableName}</code>)
                  </div>
                  <button
                    onClick={() => setTargetExistingTableId(null)}
                    className="text-[11px] text-brick hover:underline font-medium"
                  >
                    Upload as new table instead
                  </button>
                </div>
              )}

              {/* Upload Drop Zone */}
              <label className="border-2 border-dashed border-line hover:border-pine rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer bg-canvas/40 transition-colors">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelected(f);
                  }}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-full bg-panel border border-line flex items-center justify-center text-xl mb-3 shadow-2xs">
                  📁
                </div>
                <p className="text-sm font-semibold text-ink">
                  {file ? file.name : "Click to select or drag and drop your CSV file"}
                </p>
                <p className="text-xs text-ink-soft mt-1">
                  UTF-8 with or without BOM, max 20 columns, each cell max 500 characters
                </p>
              </label>

              {parsing && (
                <div className="mt-4 p-4 text-center text-xs text-pine font-medium animate-pulse">
                  Analyzing CSV and validating rows on server...
                </div>
              )}

              {uploadError && (
                <div className="mt-4 p-3.5 bg-brick/10 border border-brick/30 rounded-md text-xs text-brick">
                  <p className="font-semibold">Upload Rejected:</p>
                  <p className="mt-0.5">{uploadError}</p>
                </div>
              )}
            </Panel>
          )}

          {/* STEP 3: Map and Preview */}
          {step === 3 && parseResult && (
            <div className="space-y-6">
              <Panel>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-ink">Step 3: Map Columns &amp; Preview</h2>
                    <p className="text-xs text-ink-soft mt-0.5">
                      Verify column mappings, preview parsed rows, and configure settings.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-canvas border border-line px-2 py-1 rounded">
                      Delimiter: &ldquo;{parseResult.delimiter === "\t" ? "\\t (Tab)" : parseResult.delimiter}&rdquo;
                    </span>
                    <Button variant="quiet" onClick={() => setStep(2)}>
                      Change File
                    </Button>
                  </div>
                </div>

                {/* KIND: CUSTOMERS MAPPING */}
                {selectedKind === "customers" && (
                  <div className="space-y-4 mb-6 border-b border-line pb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Phone Column (Required)" hint="Used to identify and message the customer">
                        <select
                          value={phoneCol}
                          onChange={(e) => setPhoneCol(Number(e.target.value))}
                          className={inputClass}
                        >
                          {parseResult.headers.map((h: string, idx: number) => (
                            <option key={idx} value={idx}>
                              Column {idx + 1}: {h}
                            </option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Name Column (Optional)" hint="Customer's full name">
                        <select
                          value={nameCol ?? ""}
                          onChange={(e) => setNameCol(e.target.value === "" ? null : Number(e.target.value))}
                          className={inputClass}
                        >
                          <option value="">(None - leave name empty)</option>
                          {parseResult.headers.map((h: string, idx: number) => (
                            <option key={idx} value={idx}>
                              Column {idx + 1}: {h}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    {/* Custom fields keys configuration */}
                    <div>
                      <h3 className="text-xs font-semibold text-ink uppercase tracking-wider mb-2">
                        Custom Fields (Saved into Assistant Profile)
                      </h3>
                      <p className="text-xs text-ink-soft mb-3">
                        Every other column becomes an assistant custom field. Editable keys must use lowercase letters, numbers, and underscores (max 30 chars).
                      </p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {parseResult.headers.map((h: string, idx: number) => {
                          if (idx === phoneCol || idx === nameCol) return null;
                          const currentKey = customFieldMap[String(idx)] ?? "";

                          return (
                            <div key={idx} className="bg-canvas border border-line rounded-lg p-2.5 text-xs">
                              <span className="text-ink-soft block font-medium truncate mb-1">
                                Column {idx + 1}: &ldquo;{h}&rdquo;
                              </span>
                              <input
                                value={currentKey}
                                onChange={(e) => {
                                  const val = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
                                  setCustomFieldMap((prev) => ({ ...prev, [String(idx)]: val }));
                                }}
                                placeholder="field_key"
                                className="w-full font-mono text-xs rounded border border-line bg-panel px-2 py-1 text-ink focus:border-pine focus:outline-none"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Customer Purpose & Consent Choice */}
                    <div className="pt-4 border-t border-line space-y-3">
                      <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
                        Import Purpose &amp; Messaging Permission
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <label
                          className={`p-3.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                            customerMode === "assistant_only"
                              ? "border-pine bg-pine-wash/20 font-medium"
                              : "border-line bg-canvas hover:bg-canvas/80"
                          }`}
                        >
                          <input
                            type="radio"
                            name="customerMode"
                            checked={customerMode === "assistant_only"}
                            onChange={() => setCustomerMode("assistant_only")}
                            className="hidden"
                          />
                          <p className="font-semibold text-ink">Use this data so the assistant knows my customers (Default)</p>
                          <p className="text-ink-soft mt-1">
                            Merges custom fields so the AI assistant recognizes them. Does not change promotional consent.
                          </p>
                        </label>

                        <label
                          className={`p-3.5 rounded-lg border cursor-pointer text-xs transition-colors ${
                            customerMode === "promotional"
                              ? "border-pine bg-pine-wash/20 font-medium"
                              : "border-line bg-canvas hover:bg-canvas/80"
                          }`}
                        >
                          <input
                            type="radio"
                            name="customerMode"
                            checked={customerMode === "promotional"}
                            onChange={() => setCustomerMode("promotional")}
                            className="hidden"
                          />
                          <p className="font-semibold text-ink">Also allow promotional messages to these people</p>
                          <p className="text-ink-soft mt-1">
                            Requires signed compliance confirmation and sets opted_in for eligible contacts. NEVER re-opts in opted-out contacts.
                          </p>
                        </label>
                      </div>

                      {/* Consent Box if promotional selected */}
                      {customerMode === "promotional" && (
                        <div className="p-4 bg-amber-wash/30 border border-amber/30 rounded-lg space-y-4">
                          <div className="flex items-start gap-2.5 text-xs text-ink">
                            <span className="text-amber font-bold text-sm">⚠️</span>
                            <div>
                              <p className="font-semibold text-amber">WhatsApp Compliance Opt-in Attestation</p>
                              <p className="text-ink-soft mt-0.5 leading-relaxed">
                                Never message people without verifiable consent. Contacts who previously opted out will remain opted-out.
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <Field label="Consent Source (Required)" hint="Where did these customers agree?">
                              <select
                                value={consentSource}
                                onChange={(e) => setConsentSource(e.target.value)}
                                className={inputClass}
                              >
                                {CONSENT_SOURCES.map((s) => (
                                  <option key={s.value} value={s.value}>
                                    {s.label}
                                  </option>
                                ))}
                              </select>
                            </Field>

                            <Field label="Consent Note (Optional)" hint="Campaign or form reference">
                              <input
                                value={consentNote}
                                onChange={(e) => setConsentNote(e.target.value)}
                                placeholder="e.g. October 2026 Customer Database"
                                className={inputClass}
                              />
                            </Field>
                          </div>

                          <label className="flex items-start gap-2.5 cursor-pointer pt-1">
                            <input
                              type="checkbox"
                              checked={consentConfirmed}
                              onChange={(e) => setConsentConfirmed(e.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded border-line text-pine focus:ring-pine cursor-pointer"
                            />
                            <span className="text-xs font-medium text-ink leading-tight">
                              I confirm these people agreed to receive WhatsApp messages from my business and I can show proof if asked
                            </span>
                          </label>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* KIND: KNOWLEDGE TABLE CONFIG */}
                {selectedKind === "knowledge" && (
                  <div className="space-y-4 mb-6 border-b border-line pb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Table Title" hint="Human readable name (e.g. Delivery Zones & Fees)">
                        <input
                          value={tableTitle}
                          onChange={(e) => setTableTitle(e.target.value)}
                          required
                          className={inputClass}
                        />
                      </Field>

                      <Field label="Machine Name (auto slug)" hint="Regex: ^[a-z][a-z0-9_]{1,40}$">
                        <input
                          value={tableName}
                          onChange={(e) => setTableName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 40))}
                          required
                          className={`${inputClass} font-mono`}
                        />
                      </Field>
                    </div>

                    <Field
                      label="When should the assistant use this? (Required)"
                      hint="One or two plain sentences shown directly to the AI model so it knows when to look up this table."
                    >
                      <textarea
                        value={tableDescription}
                        onChange={(e) => setTableDescription(e.target.value)}
                        required
                        rows={2}
                        placeholder="e.g. Use this table when customers ask about delivery areas, minimum order amounts, delivery fees, or estimated delivery timeframes."
                        className={inputClass}
                      />
                    </Field>

                    {targetExistingTableId && (
                      <div className="p-3 bg-canvas border border-line rounded-lg text-xs space-y-2">
                        <span className="font-semibold text-ink">Update Mode:</span>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="knowledgeMode"
                              checked={knowledgeMode === "replace"}
                              onChange={() => setKnowledgeMode("replace")}
                            />
                            <span>Replace all existing rows</span>
                          </label>
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="radio"
                              name="knowledgeMode"
                              checked={knowledgeMode === "append"}
                              onChange={() => setKnowledgeMode("append")}
                            />
                            <span>Append to existing rows</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Guessed Columns Types */}
                    <div>
                      <h4 className="text-xs font-semibold text-ink uppercase tracking-wider mb-2">Detected Columns &amp; Guessed Types</h4>
                      <div className="flex flex-wrap gap-2">
                        {knowledgeColumns.map((c: any, i: number) => (
                          <div key={i} className="bg-canvas border border-line rounded px-2.5 py-1 text-xs flex items-center gap-1.5">
                            <span className="font-semibold text-ink">{c.name}</span>
                            <span className="text-[10px] uppercase font-mono px-1 rounded bg-panel text-ink-soft">
                              {c.type}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Counts breakdown & validation card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                  <div className="bg-canvas border border-line rounded-lg p-3">
                    <p className="text-xs text-ink-soft">Total in File</p>
                    <p className="text-xl font-semibold text-ink tabular mt-0.5">{parseResult.counts?.totalRows ?? 0}</p>
                  </div>
                  <div className="bg-canvas border border-line rounded-lg p-3">
                    <p className="text-xs text-ink-soft">Valid Rows</p>
                    <p className="text-xl font-semibold text-pine-deep tabular mt-0.5">{parseResult.counts?.validCount ?? 0}</p>
                  </div>
                  <div className="bg-canvas border border-line rounded-lg p-3">
                    <p className="text-xs text-ink-soft">Rejected</p>
                    <p className="text-xl font-semibold text-brick tabular mt-0.5">{parseResult.counts?.rejectedCount ?? 0}</p>
                  </div>
                  <div className="bg-canvas border border-line rounded-lg p-3">
                    <p className="text-xs text-ink-soft">
                      {selectedKind === "customers" ? "Duplicates in File" : selectedKind === "catalog" ? "Will Update" : "Columns"}
                    </p>
                    <p className="text-xl font-semibold text-amber tabular mt-0.5">
                      {selectedKind === "customers"
                        ? parseResult.counts?.duplicateCount ?? 0
                        : selectedKind === "catalog"
                        ? parseResult.counts?.willUpdate ?? 0
                        : parseResult.headers?.length ?? 0}
                    </p>
                  </div>
                </div>

                {/* Rejected Sample List */}
                {parseResult.rejectedSample && parseResult.rejectedSample.length > 0 && (
                  <div className="mb-5 p-3 bg-brick/10 border border-brick/30 rounded-lg text-xs space-y-1">
                    <p className="font-semibold text-brick">
                      Sample Rejected Rows ({parseResult.rejectedSample.length} shown):
                    </p>
                    <ul className="space-y-1 max-h-32 overflow-y-auto">
                      {parseResult.rejectedSample.map((r: any, idx: number) => (
                        <li key={idx} className="text-brick font-mono text-[11px]">
                          Row {r.row}: {r.reason} {r.phone ? `(${r.phone})` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Preview Top 20 Rows Table */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-xs font-semibold text-ink uppercase tracking-wider">
                      Preview (First 20 Rows)
                    </h3>
                    <span className="text-[11px] text-ink-faint">
                      Showing up to 20 of {parseResult.totalRows} rows
                    </span>
                  </div>

                  <div className="overflow-x-auto border border-line rounded-lg max-h-80">
                    <table className="w-full text-left text-xs divide-y divide-line">
                      <thead className="bg-canvas text-ink-soft font-semibold sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          {parseResult.headers.map((h: string, i: number) => (
                            <th key={i} className="py-2.5 px-3 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line bg-panel font-mono text-[11px]">
                        {parseResult.previewRows.map((r: any, i: number) => (
                          <tr key={i} className="hover:bg-canvas/50">
                            <td className="py-2 px-3 text-ink-soft">{r.rowNum}</td>
                            {r.cells.map((cell: string, cIdx: number) => (
                              <td key={cIdx} className="py-2 px-3 whitespace-nowrap max-w-xs truncate">
                                {cell || "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Confirm and Import Action */}
                <div className="pt-6 mt-6 border-t border-line flex items-center justify-between">
                  <Button variant="quiet" onClick={() => setStep(2)}>
                    &larr; Back
                  </Button>
                  <Button
                    onClick={handleExecuteImport}
                    disabled={
                      importing ||
                      (selectedKind === "customers" && customerMode === "promotional" && !consentConfirmed) ||
                      (selectedKind === "knowledge" && !tableDescription.trim())
                    }
                  >
                    {importing ? "Importing Data..." : "Confirm & Import in One Transaction"}
                  </Button>
                </div>
              </Panel>
            </div>
          )}

          {/* STEP 4: Import Complete Summary */}
          {step === 4 && importReport && (
            <Panel className="border-pine bg-pine-wash/20">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full bg-pine"></span>
                <h3 className="text-lg font-semibold text-pine-deep">Import Completed Successfully</h3>
              </div>
              <p className="text-xs text-ink-soft mb-5">
                All records were processed and written in a single atomic database transaction.
              </p>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
                <div className="bg-panel border border-line rounded-lg p-3">
                  <p className="text-xs text-ink-soft">Successfully Imported</p>
                  <p className="text-2xl font-semibold text-pine-deep tabular mt-1">
                    {importReport.importedCount ?? 0}
                  </p>
                </div>
                <div className="bg-panel border border-line rounded-lg p-3">
                  <p className="text-xs text-ink-soft">Rejected Rows</p>
                  <p className="text-2xl font-semibold text-brick tabular mt-1">
                    {importReport.rejectedCount ?? 0}
                  </p>
                </div>
                <div className="bg-panel border border-line rounded-lg p-3">
                  <p className="text-xs text-ink-soft">Upload Batch ID</p>
                  <p className="text-2xl font-semibold text-ink tabular mt-1">
                    #{importReport.uploadId}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  onClick={() => {
                    setStep(1);
                    setFile(null);
                    setCsvContent("");
                    setParseResult(null);
                    setImportReport(null);
                  }}
                >
                  + Upload Another File
                </Button>
                <Button variant="quiet" onClick={() => setActiveTab("manage")}>
                  View All Tables &amp; Files
                </Button>
              </div>
            </Panel>
          )}
        </div>
      )}

      {/* ---------------- MANAGEMENT TAB ---------------- */}
      {activeTab === "manage" && (
        <div className="space-y-6">
          {/* Customer Custom Fields Management Card */}
          <Panel>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-ink">Customer Custom Fields</h3>
                <p className="text-xs text-ink-soft mt-0.5">
                  Currently <strong>{customFieldsCount}</strong> contacts have custom fields attached. These are displayed in the chat context panel and on the Contacts page.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link href="/contacts">
                  <Button variant="quiet">View Contacts</Button>
                </Link>
                <Button variant="danger" onClick={() => setShowClearModal(true)} disabled={customFieldsCount === 0}>
                  Clear All Custom Fields
                </Button>
              </div>
            </div>
          </Panel>

          {/* Knowledge Tables List */}
          <Panel pad={false}>
            <div className="p-5 border-b border-line flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-ink">Knowledge Tables ({tables.length} / 20)</h3>
                <p className="text-xs text-ink-soft mt-0.5">
                  Searchable tabular reference data used by the assistant to answer questions.
                </p>
              </div>
              <Button
                onClick={() => {
                  setSelectedKind("knowledge");
                  setTargetExistingTableId(null);
                  setStep(1);
                  setActiveTab("wizard");
                }}
              >
                + New Knowledge Table
              </Button>
            </div>

            {tables.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-soft">
                No knowledge tables yet. Upload a CSV to create delivery matrices, class timings, doctor schedules, or branch locations.
              </div>
            ) : (
              <div className="divide-y divide-line">
                {tables.map((t) => (
                  <div key={t.id} className="p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div className="min-w-0 max-w-xl">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-semibold text-ink text-sm">{t.title}</h4>
                        <span className="font-mono text-xs text-ink-soft bg-canvas px-1.5 py-0.5 rounded border border-line">
                          {t.name}
                        </span>
                        <Tag tone={t.active ? "good" : "neutral"}>{t.active ? "Active" : "Inactive"}</Tag>
                        <span className="text-xs text-ink-faint tabular">
                          {t.row_count} row{t.row_count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <p className="text-xs text-ink-soft mt-1 leading-relaxed">
                        <strong className="text-ink">Assistant prompt:</strong> {t.description}
                      </p>
                      <p className="text-[11px] text-ink-faint mt-1">
                        Updated {fullStamp(t.updated_at)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button variant="quiet" onClick={() => openViewRows(t, 1)}>
                        View Rows
                      </Button>
                      <Button
                        variant="quiet"
                        onClick={() => {
                          setEditingTable(t);
                          setEditDescText(t.description);
                        }}
                      >
                        Edit Prompt
                      </Button>
                      <Button variant="quiet" onClick={() => toggleTableActive(t)}>
                        {t.active ? "Disable" : "Enable"}
                      </Button>
                      <Button variant="quiet" onClick={() => startReplaceForTable(t)}>
                        Replace Data
                      </Button>
                      <a href={`/api/data/tables/${t.id}?export=true`} download>
                        <Button variant="quiet">Download CSV</Button>
                      </a>
                      <Button variant="danger" onClick={() => deleteTable(t)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Uploads History */}
          <Panel pad={false}>
            <div className="p-5 border-b border-line">
              <h3 className="text-base font-semibold text-ink">Recent Data Uploads</h3>
              <p className="text-xs text-ink-soft mt-0.5">Audit log of all CSV files uploaded to this workspace.</p>
            </div>

            {uploads.length === 0 ? (
              <div className="p-8 text-center text-xs text-ink-soft">No uploads yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs divide-y divide-line">
                  <thead className="bg-canvas text-ink-soft font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Kind</th>
                      <th className="py-2.5 px-4">Filename</th>
                      <th className="py-2.5 px-4">Imported</th>
                      <th className="py-2.5 px-4">Rejected</th>
                      <th className="py-2.5 px-4">Uploaded By</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line bg-panel">
                    {uploads.map((u) => (
                      <tr key={u.id} className="hover:bg-canvas/50">
                        <td className="py-2.5 px-4 text-ink-soft tabular">{fullStamp(u.created_at)}</td>
                        <td className="py-2.5 px-4 capitalize font-medium text-ink">{u.kind}</td>
                        <td className="py-2.5 px-4 font-mono text-ink">{u.filename || "—"}</td>
                        <td className="py-2.5 px-4 font-medium text-pine-deep tabular">{u.imported_rows}</td>
                        <td className="py-2.5 px-4 tabular text-brick">{u.rejected_rows}</td>
                        <td className="py-2.5 px-4 text-ink-soft">{u.uploaded_by_name || "Owner"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      )}

      {/* ---------------- MODAL: VIEW ROWS ---------------- */}
      {viewingTable && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-panel border border-line rounded-xl max-w-4xl w-full max-h-[85vh] flex flex-col shadow-lg overflow-hidden">
            <div className="p-4 border-b border-line flex items-center justify-between bg-canvas/40">
              <div>
                <h3 className="font-semibold text-sm text-ink">{viewingTable.title}</h3>
                <p className="text-xs text-ink-soft font-mono">{viewingTable.name}</p>
              </div>
              <button
                onClick={() => setViewingTable(null)}
                className="text-ink-soft hover:text-ink text-sm px-2 py-1"
              >
                &times;
              </button>
            </div>

            {/* Search filter inside modal */}
            <div className="p-3 border-b border-line bg-canvas flex items-center gap-2">
              <input
                value={rowSearch}
                onChange={(e) => setRowSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") openViewRows(viewingTable, 1, rowSearch);
                }}
                placeholder="Search rows by any text..."
                className="flex-1 rounded border border-line bg-panel px-3 py-1.5 text-xs text-ink focus:border-pine focus:outline-none"
              />
              <Button variant="quiet" onClick={() => openViewRows(viewingTable, 1, rowSearch)}>
                Search
              </Button>
            </div>

            {/* Rows Table */}
            <div className="flex-1 overflow-auto p-4">
              {loadingRows ? (
                <div className="p-8 text-center text-xs text-ink-soft animate-pulse">Loading rows...</div>
              ) : tableRows.length === 0 ? (
                <div className="p-8 text-center text-xs text-ink-soft">No rows found matching search.</div>
              ) : (
                <div className="border border-line rounded-lg overflow-x-auto">
                  <table className="w-full text-left text-xs divide-y divide-line">
                    <thead className="bg-canvas text-ink-soft sticky top-0">
                      <tr>
                        <th className="py-2 px-3">#</th>
                        {Object.keys(tableRows[0]?.data || {}).map((k) => (
                          <th key={k} className="py-2 px-3 whitespace-nowrap">
                            {k}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line bg-panel font-mono text-[11px]">
                      {tableRows.map((r, i) => (
                        <tr key={r.id}>
                          <td className="py-1.5 px-3 text-ink-soft">
                            {(rowPagination.page - 1) * rowPagination.limit + i + 1}
                          </td>
                          {Object.values(r.data || {}).map((val: any, vIdx: number) => (
                            <td key={vIdx} className="py-1.5 px-3 whitespace-nowrap max-w-xs truncate">
                              {String(val || "—")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            <div className="p-3 border-t border-line flex items-center justify-between text-xs text-ink-soft bg-canvas/30">
              <span>
                Total: {rowPagination.total} rows (Page {rowPagination.page} of {rowPagination.totalPages || 1})
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="quiet"
                  disabled={rowPagination.page <= 1}
                  onClick={() => openViewRows(viewingTable, rowPagination.page - 1, rowSearch)}
                >
                  Previous
                </Button>
                <Button
                  variant="quiet"
                  disabled={rowPagination.page >= rowPagination.totalPages}
                  onClick={() => openViewRows(viewingTable, rowPagination.page + 1, rowSearch)}
                >
                  Next
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: EDIT DESCRIPTION ---------------- */}
      {editingTable && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-panel border border-line rounded-xl max-w-lg w-full p-5 space-y-4 shadow-lg">
            <h3 className="font-semibold text-sm text-ink">
              Edit Assistant Prompt: {editingTable.title}
            </h3>
            <Field
              label="When should the assistant use this?"
              hint="Shown to the AI to understand when to look up this table."
            >
              <textarea
                value={editDescText}
                onChange={(e) => setEditDescText(e.target.value)}
                rows={3}
                required
                className={inputClass}
              />
            </Field>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
              <Button variant="quiet" onClick={() => setEditingTable(null)}>
                Cancel
              </Button>
              <Button onClick={saveDescriptionEdit} disabled={savingEdit || !editDescText.trim()}>
                {savingEdit ? "Saving..." : "Save Prompt"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ---------------- MODAL: CLEAR CUSTOM FIELDS CONFIRMATION ---------------- */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-panel border border-line rounded-xl max-w-md w-full p-6 space-y-4 shadow-lg">
            <div className="flex items-center gap-2 text-brick font-semibold text-base">
              <span>⚠️</span> Clear All Custom Fields
            </div>
            <p className="text-xs text-ink-soft leading-relaxed">
              Are you sure you want to remove all custom field attributes from <strong>{customFieldsCount}</strong> contacts?
              This will reset the profile fields for every contact in your workspace. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
              <Button variant="quiet" onClick={() => setShowClearModal(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={handleClearCustomFields} disabled={clearing}>
                {clearing ? "Clearing..." : "Yes, Clear All Attributes"}
              </Button>
            </div>
          </div>
        </div>
      )}

      <Toast message={toastMsg} />
    </div>
  );
}
