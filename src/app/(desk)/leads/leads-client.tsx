"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Panel, PageHead, Button, Field, inputClass, Tag, Empty, Toast, useToast } from "@/components/ui";

export type Lead = {
  id: number;
  tenant_id: number;
  phone: string;
  name: string | null;
  kind: string;
  stage: "new" | "qualified" | "quoted" | "negotiating" | "won" | "lost";
  summary: string;
  details: Record<string, any>;
  budget_min: number | null;
  budget_max: number | null;
  currency: string;
  value: number | null;
  assigned_to: number | null;
  next_followup_at: string | null;
  followups_sent: number;
  lost_reason: string | null;
  source: string;
  staff_alerted: boolean;
  created_at: string;
  updated_at: string;
  first_ad_title?: string | null;
  lead_source?: string | null;
  owner_name?: string | null;
  owner_email?: string | null;
};

export type LeadEvent = {
  id: number;
  lead_id: number;
  kind: "note" | "stage" | "quote" | "followup" | "message" | "assign";
  body: string;
  data: Record<string, any>;
  created_by: number | null;
  created_by_name?: string | null;
  created_at: string;
};

export type QuoteLine = {
  catalog_item_id?: number | null;
  description: string;
  qty: number;
  price: number;
  total: number;
};

export type Quote = {
  id: number;
  tenant_id: number;
  lead_id: number;
  lines: QuoteLine[];
  total: number;
  currency: string;
  valid_until: string | null;
  status: "draft" | "sent" | "accepted" | "declined";
  notes: string | null;
  created_at: string;
};

type TeamMember = {
  id: number;
  email: string;
  full_name: string;
  role: string;
};

type ServiceItem = {
  id: number;
  name: string;
  duration_min: number;
  price: number | null;
  currency: string;
};

type CatalogItem = {
  id: number;
  name: string;
  price: number;
  currency: string;
  unit: string | null;
  kind: string;
};

type Props = {
  tenantId: number;
  isOwner: boolean;
  sessionUser: { id: number; name: string; role: string };
  leadLabel: string;
  leadsLabel: string;
  teamMembers: TeamMember[];
  services: ServiceItem[];
  catalogItems: CatalogItem[];
};

const STAGES: Array<{ id: Lead["stage"]; label: string; tone: "warn" | "neutral" | "good" | "bad" }> = [
  { id: "new", label: "New", tone: "warn" },
  { id: "qualified", label: "Qualified", tone: "neutral" },
  { id: "quoted", label: "Quoted", tone: "neutral" },
  { id: "negotiating", label: "Negotiating", tone: "neutral" },
  { id: "won", label: "Won", tone: "good" },
  { id: "lost", label: "Lost", tone: "bad" },
];

const DETAIL_LABELS: Record<string, string> = {
  urgency: "Urgency",
  destination: "Destination",
  dates: "Dates",
  departure: "Departure",
  adults: "Adults",
  children: "Children",
  travel_type: "Trip Type",
  hotel_category: "Hotel Category",
  property_type: "Property Type",
  bedrooms: "Bedrooms",
  bathrooms: "Bathrooms",
  area: "Area",
  location: "Location",
  buy_or_rent: "Buy or Rent",
  furnished: "Furnishing",
  course: "Course",
  course_name: "Course Name",
  batch: "Preferred Batch",
  target_exam: "Target Exam",
  grade_level: "Grade / Level",
  mode: "Class Mode",
  project_type: "Project Type",
  tech_stack: "Tech Stack",
  timeline: "Timeline",
  scope: "Scope",
  budget_range: "Budget Range",
  requirement: "Requirement",
  preferred_time: "Preferred Time",
};

export default function LeadsClient({
  tenantId,
  isOwner,
  sessionUser,
  leadLabel,
  leadsLabel,
  teamMembers,
  services,
  catalogItems,
}: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
  const { message, show } = useToast();

  // Filters
  const [search, setSearch] = useState("");
  const [kindFilter, setKindFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  // Selected lead drawer
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [drawerTab, setDrawerTab] = useState<"details" | "quotes">("details");
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [quotesLoading, setQuotesLoading] = useState(false);

  // Modals & form state
  const [newNote, setNewNote] = useState("");
  const [noteSubmitting, setNoteSubmitting] = useState(false);

  // Won modal
  const [wonModalOpen, setWonModalOpen] = useState(false);
  const [wonValue, setWonValue] = useState("");
  const [wonNote, setWonNote] = useState("");

  // Lost modal
  const [lostModalOpen, setLostModalOpen] = useState(false);
  const [lostReason, setLostReason] = useState("");

  // Reopen modal (for won/lost leads)
  const [reopenModalOpen, setReopenModalOpen] = useState(false);
  const [reopenTargetStage, setReopenTargetStage] = useState<Lead["stage"]>("new");
  const [reopenNote, setReopenNote] = useState("");

  // New Lead modal
  const [createLeadModalOpen, setCreateLeadModalOpen] = useState(false);
  const [newLeadPhone, setNewLeadPhone] = useState("");
  const [newLeadName, setNewLeadName] = useState("");
  const [newLeadKind, setNewLeadKind] = useState("general");
  const [newLeadSummary, setNewLeadSummary] = useState("");
  const [newLeadBudget, setNewLeadBudget] = useState("");

  // Create Appointment modal
  const [apptModalOpen, setApptModalOpen] = useState(false);
  const [apptServiceId, setApptServiceId] = useState(services[0]?.id ? String(services[0].id) : "");
  const [apptDateTime, setApptDateTime] = useState("");
  const [apptNotes, setApptNotes] = useState("");
  const [apptSubmitting, setApptSubmitting] = useState(false);

  // Quote builder state
  const [quoteBuilderOpen, setQuoteBuilderOpen] = useState(false);
  const [quoteLines, setQuoteLines] = useState<QuoteLine[]>([
    { description: "", qty: 1, price: 0, total: 0 },
  ]);
  const [quoteValidUntil, setQuoteValidUntil] = useState("");
  const [quoteNotes, setQuoteNotes] = useState("");
  const [quoteCurrency, setQuoteCurrency] = useState("QAR");
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);

  // Load leads
  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (kindFilter !== "all") params.set("kind", kindFilter);
      if (ownerFilter !== "all") params.set("owner", ownerFilter);
      if (stageFilter !== "all") params.set("stage", stageFilter);
      if (dateFrom) params.set("date_from", dateFrom);
      if (dateTo) params.set("date_to", dateTo);

      const res = await fetch(`/api/leads?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setLeads(data.leads || []);
      } else {
        show(data.error || "Failed to load leads");
      }
    } catch {
      show("Network error loading leads");
    } finally {
      setLoading(false);
    }
  }, [search, kindFilter, ownerFilter, stageFilter, dateFrom, dateTo, show]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Load events and quotes when drawer opens
  const fetchEvents = useCallback(async (leadId: number) => {
    try {
      setEventsLoading(true);
      const res = await fetch(`/api/leads/${leadId}/events`);
      const data = await res.json();
      if (data.ok) setEvents(data.events || []);
    } catch {
      // ignore
    } finally {
      setEventsLoading(false);
    }
  }, []);

  const fetchQuotes = useCallback(async (leadId: number) => {
    try {
      setQuotesLoading(true);
      const res = await fetch(`/api/quotes?lead_id=${leadId}`);
      const data = await res.json();
      if (data.ok) setQuotes(data.quotes || []);
    } catch {
      // ignore
    } finally {
      setQuotesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLead) {
      fetchEvents(selectedLead.id);
      fetchQuotes(selectedLead.id);
      setQuoteCurrency(selectedLead.currency || "QAR");
    }
  }, [selectedLead, fetchEvents, fetchQuotes]);

  // Update lead stage
  const updateStage = async (
    leadId: number,
    newStage: Lead["stage"],
    options?: { note?: string; value?: number; lost_reason?: string }
  ) => {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;

    // Check if reopening from won/lost
    if ((lead.stage === "won" || lead.stage === "lost") && !options?.note) {
      setReopenTargetStage(newStage);
      setReopenModalOpen(true);
      return;
    }

    try {
      const res = await fetch(`/api/leads`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: leadId,
          stage: newStage,
          note: options?.note,
          value: options?.value,
          lost_reason: options?.lost_reason,
        }),
      });

      const data = await res.json();
      if (data.ok) {
        show(`Moved to ${newStage.toUpperCase()}`);
        setLeads((prev) => prev.map((l) => (l.id === leadId ? data.lead : l)));
        if (selectedLead?.id === leadId) {
          setSelectedLead(data.lead);
          fetchEvents(leadId);
        }
      } else {
        show(data.message || data.error || "Failed to update stage");
      }
    } catch {
      show("Network error updating stage");
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, leadId: number) => {
    e.dataTransfer.setData("leadId", String(leadId));
  };

  const handleDrop = (e: React.DragEvent, targetStage: Lead["stage"]) => {
    e.preventDefault();
    const leadIdStr = e.dataTransfer.getData("leadId");
    if (!leadIdStr) return;
    const leadId = Number(leadIdStr);
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.stage === targetStage) return;

    if (targetStage === "won") {
      setSelectedLead(lead);
      setWonValue(lead.budget_max ? String(lead.budget_max) : lead.budget_min ? String(lead.budget_min) : "");
      setWonModalOpen(true);
      return;
    }

    if (targetStage === "lost") {
      setSelectedLead(lead);
      setLostReason("");
      setLostModalOpen(true);
      return;
    }

    if (lead.stage === "won" || lead.stage === "lost") {
      setSelectedLead(lead);
      setReopenTargetStage(targetStage);
      setReopenNote("");
      setReopenModalOpen(true);
      return;
    }

    updateStage(leadId, targetStage);
  };

  // Assign lead
  const assignLead = async (leadId: number, assigneeId: number | null) => {
    try {
      const res = await fetch(`/api/leads`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, assigned_to: assigneeId }),
      });
      const data = await res.json();
      if (data.ok) {
        show(assigneeId ? "Lead assigned" : "Lead unassigned");
        setLeads((prev) => prev.map((l) => (l.id === leadId ? data.lead : l)));
        if (selectedLead?.id === leadId) {
          setSelectedLead(data.lead);
          fetchEvents(leadId);
        }
      } else {
        show(data.message || data.error || "Failed to assign lead");
      }
    } catch {
      show("Network error assigning lead");
    }
  };

  // Set follow-up date
  const setFollowup = async (leadId: number, dateStr: string) => {
    try {
      const res = await fetch(`/api/leads`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: leadId, next_followup_at: dateStr || null }),
      });
      const data = await res.json();
      if (data.ok) {
        show(dateStr ? "Follow-up scheduled" : "Follow-up removed");
        setLeads((prev) => prev.map((l) => (l.id === leadId ? data.lead : l)));
        if (selectedLead?.id === leadId) {
          setSelectedLead(data.lead);
          fetchEvents(leadId);
        }
      } else {
        show(data.error || "Failed to update follow-up");
      }
    } catch {
      show("Network error");
    }
  };

  // Add note
  const submitNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !newNote.trim()) return;
    try {
      setNoteSubmitting(true);
      const res = await fetch(`/api/leads/${selectedLead.id}/events`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "note", body: newNote.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewNote("");
        show("Note added");
        fetchEvents(selectedLead.id);
        fetchLeads();
      } else {
        show(data.error || "Failed to add note");
      }
    } catch {
      show("Network error adding note");
    } finally {
      setNoteSubmitting(false);
    }
  };

  // Create lead manually
  const submitCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLeadPhone.trim()) {
      show("Phone is required");
      return;
    }
    try {
      const budgetNum = newLeadBudget ? Number(newLeadBudget) : null;
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: newLeadPhone.trim(),
          name: newLeadName.trim() || null,
          kind: newLeadKind.trim() || "general",
          summary: newLeadSummary.trim() || "",
          budget_min: budgetNum,
          budget_max: budgetNum,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        show("Lead created");
        setCreateLeadModalOpen(false);
        setNewLeadPhone("");
        setNewLeadName("");
        setNewLeadSummary("");
        setNewLeadBudget("");
        fetchLeads();
      } else {
        show(data.error || "Failed to create lead");
      }
    } catch {
      show("Network error creating lead");
    }
  };

  // Create appointment prefilled
  const submitAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLead || !apptServiceId || !apptDateTime) {
      show("Service and Date/Time are required");
      return;
    }
    try {
      setApptSubmitting(true);
      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: selectedLead.phone,
          customer_name: selectedLead.name,
          service_id: Number(apptServiceId),
          start_time: apptDateTime,
          notes: apptNotes.trim() || `Booked for ${leadLabel}: ${selectedLead.name || selectedLead.phone}`,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        show("Appointment booked!");
        setApptModalOpen(false);
        // Log event on lead
        await fetch(`/api/leads/${selectedLead.id}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            kind: "followup",
            body: `Appointment booked for ${apptDateTime} (${services.find((s) => s.id === Number(apptServiceId))?.name})`,
          }),
        });
        fetchEvents(selectedLead.id);
      } else {
        show(data.error === "slot_taken" ? "That slot is already booked" : data.error || "Booking failed");
      }
    } catch {
      show("Network error booking appointment");
    } finally {
      setApptSubmitting(false);
    }
  };

  // Quote line manipulation
  const updateQuoteLine = (idx: number, patch: Partial<QuoteLine>) => {
    setQuoteLines((prev) => {
      const next = [...prev];
      const cur = { ...next[idx], ...patch };
      cur.total = Number((cur.qty * cur.price).toFixed(2));
      next[idx] = cur;
      return next;
    });
  };

  const addQuoteLine = () => {
    setQuoteLines((prev) => [...prev, { description: "", qty: 1, price: 0, total: 0 }]);
  };

  const removeQuoteLine = (idx: number) => {
    setQuoteLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const selectCatalogItemForLine = (idx: number, itemId: number) => {
    const item = catalogItems.find((c) => c.id === itemId);
    if (!item) return;
    updateQuoteLine(idx, {
      catalog_item_id: item.id,
      description: item.name,
      price: Number(item.price) || 0,
    });
  };

  const quoteSubtotal = useMemo(() => {
    return Number(quoteLines.reduce((acc, l) => acc + (l.qty * l.price), 0).toFixed(2));
  }, [quoteLines]);

  // Save quote draft
  const saveQuoteDraft = async () => {
    if (!selectedLead) return;
    if (quoteLines.length === 0 || !quoteLines.some((l) => l.description.trim())) {
      show("Please enter at least one line with a description");
      return;
    }
    try {
      setQuoteSubmitting(true);
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_id: selectedLead.id,
          lines: quoteLines,
          currency: quoteCurrency,
          valid_until: quoteValidUntil || null,
          notes: quoteNotes.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        show("Quote draft saved");
        setQuoteBuilderOpen(false);
        setQuoteLines([{ description: "", qty: 1, price: 0, total: 0 }]);
        setQuoteNotes("");
        fetchQuotes(selectedLead.id);
        fetchEvents(selectedLead.id);
      } else {
        show(data.error || "Failed to save quote");
      }
    } catch {
      show("Network error saving quote");
    } finally {
      setQuoteSubmitting(false);
    }
  };

  // Send quote on WhatsApp
  const sendQuoteWhatsApp = async (quoteId: number) => {
    try {
      const res = await fetch(`/api/quotes/${quoteId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();
      if (data.ok) {
        show("Quote sent on WhatsApp!");
        if (selectedLead) {
          fetchQuotes(selectedLead.id);
          fetchEvents(selectedLead.id);
          fetchLeads();
        }
      } else {
        show(data.message || data.error || "Failed to send quote");
      }
    } catch {
      show("Network error sending quote");
    }
  };

  // Update quote status (accepted / declined)
  const setQuoteStatus = async (quoteId: number, status: "accepted" | "declined") => {
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.ok) {
        show(`Quote marked ${status}`);
        if (selectedLead) {
          fetchQuotes(selectedLead.id);
          fetchEvents(selectedLead.id);
        }
      } else {
        show(data.error || "Failed to update quote");
      }
    } catch {
      show("Network error");
    }
  };

  // Export CSV
  const exportCsv = () => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (kindFilter !== "all") params.set("kind", kindFilter);
    if (ownerFilter !== "all") params.set("owner", ownerFilter);
    if (stageFilter !== "all") params.set("stage", stageFilter);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    params.set("format", "csv");
    window.location.href = `/api/leads?${params.toString()}`;
  };

  // Group leads by stage for Kanban
  const groupedLeads = useMemo(() => {
    const map: Record<Lead["stage"], Lead[]> = {
      new: [],
      qualified: [],
      quoted: [],
      negotiating: [],
      won: [],
      lost: [],
    };
    leads.forEach((l) => {
      if (map[l.stage]) map[l.stage].push(l);
    });
    return map;
  }, [leads]);

  // Unique kinds for filter
  const availableKinds = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l) => {
      if (l.kind) set.add(l.kind);
    });
    return Array.from(set);
  }, [leads]);

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      <Toast message={message} />

      {/* Header */}
      <PageHead
        title={leadsLabel}
        lead={`Track enquiries, manage follow-ups, and send itemized quotes over WhatsApp.`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="quiet" onClick={exportCsv}>
              Export CSV
            </Button>
            <Button variant="primary" onClick={() => setCreateLeadModalOpen(true)}>
              + New {leadLabel}
            </Button>
          </div>
        }
      />

      {/* Filter Toolbar */}
      <div className="bg-panel border border-line rounded-lg p-4 mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder={`Search by name, phone, or summary...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputClass}
            />
          </div>

          {/* Kind Filter */}
          <div className="w-36">
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              className={inputClass}
            >
              <option value="all">All kinds</option>
              {availableKinds.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          {/* Owner Filter */}
          <div className="w-40">
            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className={inputClass}
            >
              <option value="all">All owners</option>
              <option value="unassigned">Unassigned</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.email}
                </option>
              ))}
            </select>
          </div>

          {/* Stage Filter */}
          <div className="w-36">
            <select
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
              className={inputClass}
            >
              <option value="all">All stages</option>
              {STAGES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center border border-line rounded-md overflow-hidden bg-canvas">
            <button
              onClick={() => setViewMode("kanban")}
              className={`px-3 py-1.5 text-xs font-semibold ${
                viewMode === "kanban" ? "bg-panel text-ink shadow-xs" : "text-ink-soft hover:text-ink"
              }`}
            >
              Kanban
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-1.5 text-xs font-semibold ${
                viewMode === "list" ? "bg-panel text-ink shadow-xs" : "text-ink-soft hover:text-ink"
              }`}
            >
              List
            </button>
          </div>
        </div>

        {/* Date Filters */}
        <div className="flex items-center gap-3 text-xs text-ink-soft pt-1">
          <span>Date range:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded border border-line bg-panel px-2 py-1 text-xs"
          />
          <span>to</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded border border-line bg-panel px-2 py-1 text-xs"
          />
          {(dateFrom || dateTo || search || kindFilter !== "all" || ownerFilter !== "all" || stageFilter !== "all") && (
            <button
              onClick={() => {
                setSearch("");
                setKindFilter("all");
                setOwnerFilter("all");
                setStageFilter("all");
                setDateFrom("");
                setDateTo("");
              }}
              className="text-pine hover:underline ml-2"
            >
              Reset filters
            </button>
          )}
        </div>
      </div>

      {/* Main View Area */}
      {loading ? (
        <Panel>
          <div className="py-16 text-center text-ink-soft">Loading {leadsLabel.toLowerCase()}...</div>
        </Panel>
      ) : leads.length === 0 ? (
        <Panel>
          <Empty title={`No ${leadsLabel.toLowerCase()} found`}>
            {search || kindFilter !== "all" || ownerFilter !== "all"
              ? "Try adjusting your filters."
              : `New enquiries from WhatsApp or ad clicks will arrive here.`}
          </Empty>
        </Panel>
      ) : viewMode === "kanban" ? (
        /* Kanban Board */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 items-start">
          {STAGES.map((col) => {
            const colLeads = groupedLeads[col.id] || [];
            return (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, col.id)}
                className="bg-canvas border border-line rounded-lg p-3 min-h-[450px] flex flex-col"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-line">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink">{col.label}</span>
                    <span className="text-[11px] font-semibold text-ink-soft bg-panel border border-line px-1.5 py-0.2 rounded-full">
                      {colLeads.length}
                    </span>
                  </div>
                </div>

                {/* Cards List */}
                <div className="space-y-2.5 flex-1">
                  {colLeads.map((lead) => {
                    const isHot = lead.details?.urgency === "high" || lead.budget_min !== null || lead.budget_max !== null || lead.value !== null;
                    const hasFollowup = lead.next_followup_at !== null;
                    const isOverdue = hasFollowup && new Date(lead.next_followup_at!).getTime() < Date.now();

                    return (
                      <div
                        key={lead.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, lead.id)}
                        onClick={() => {
                          setSelectedLead(lead);
                          setDrawerTab("details");
                        }}
                        className="bg-panel border border-line rounded-md p-3 shadow-xs hover:border-pine/50 cursor-pointer transition-all space-y-2"
                      >
                        {/* Top info */}
                        <div className="flex items-start justify-between gap-1">
                          <p className="font-semibold text-sm text-ink truncate leading-snug">
                            {lead.name || lead.phone}
                          </p>
                          {isHot && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-wash text-amber-deep shrink-0">
                              🔥 Hot
                            </span>
                          )}
                        </div>

                        {/* Phone & Kind */}
                        <div className="flex items-center gap-1.5 text-xs text-ink-soft">
                          <span className="font-mono">+{lead.phone}</span>
                          {lead.kind && lead.kind !== "general" && (
                            <span className="bg-canvas border border-line px-1.5 py-0.2 rounded text-[10px]">
                              {lead.kind}
                            </span>
                          )}
                        </div>

                        {/* One-line Summary */}
                        {lead.summary && (
                          <p className="text-xs text-ink-soft line-clamp-2 leading-relaxed">
                            {lead.summary}
                          </p>
                        )}

                        {/* Ad Attribution badge */}
                        {lead.first_ad_title && (
                          <div className="text-[10px] text-pine font-medium bg-pine-wash/50 px-1.5 py-0.5 rounded truncate">
                            From ad: {lead.first_ad_title}
                          </div>
                        )}

                        {/* Budget or Value */}
                        {(lead.value !== null || lead.budget_min !== null || lead.budget_max !== null) && (
                          <div className="text-xs font-semibold text-ink">
                            {lead.value !== null
                              ? `Value: ${lead.currency} ${Number(lead.value).toFixed(2)}`
                              : lead.budget_min && lead.budget_max
                              ? `Budget: ${lead.budget_min}–${lead.budget_max} ${lead.currency}`
                              : `Budget: ${lead.budget_min || lead.budget_max} ${lead.currency}`}
                          </div>
                        )}

                        {/* Footer: Owner and Follow-up */}
                        <div className="pt-2 border-t border-line/60 flex items-center justify-between text-[11px] text-ink-soft">
                          <span className="truncate max-w-[100px]">
                            {lead.owner_name || "Unassigned"}
                          </span>
                          {lead.next_followup_at && (
                            <span
                              className={`text-[10px] px-1 py-0.2 rounded font-medium ${
                                isOverdue ? "bg-[#f8ebe9] text-brick" : "bg-canvas text-ink-soft"
                              }`}
                            >
                              📅 {new Date(lead.next_followup_at).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {/* Mobile Stage Selector */}
                        <div className="block lg:hidden pt-1">
                          <select
                            value={lead.stage}
                            onClick={(e) => e.stopPropagation()}
                            onChange={(e) => updateStage(lead.id, e.target.value as Lead["stage"])}
                            className="w-full text-[10px] bg-canvas border border-line rounded px-1 py-0.5"
                          >
                            {STAGES.map((s) => (
                              <option key={s.id} value={s.id}>
                                Move to {s.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <Panel pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-canvas border-b border-line text-xs uppercase text-ink-soft font-semibold">
                <tr>
                  <th className="px-5 py-3">{leadLabel}</th>
                  <th className="px-5 py-3">Phone</th>
                  <th className="px-5 py-3">Stage</th>
                  <th className="px-5 py-3">Kind</th>
                  <th className="px-5 py-3">Budget / Value</th>
                  <th className="px-5 py-3">Owner</th>
                  <th className="px-5 py-3">Follow-up</th>
                  <th className="px-5 py-3">Ad Source</th>
                  <th className="px-5 py-3">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {leads.map((l) => (
                  <tr
                    key={l.id}
                    onClick={() => {
                      setSelectedLead(l);
                      setDrawerTab("details");
                    }}
                    className="hover:bg-canvas/60 cursor-pointer"
                  >
                    <td className="px-5 py-3.5 font-medium text-ink">
                      <div className="flex items-center gap-1.5">
                        <span>{l.name || "Unknown"}</span>
                        {(l.details?.urgency === "high" || l.budget_min !== null || l.budget_max !== null) && (
                          <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-wash text-amber-deep">
                            🔥 Hot
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-xs text-ink-soft">+{l.phone}</td>
                    <td className="px-5 py-3.5">
                      <Tag tone={l.stage === "new" ? "warn" : l.stage === "won" ? "good" : l.stage === "lost" ? "bad" : "neutral"}>
                        {l.stage.toUpperCase()}
                      </Tag>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink-soft">{l.kind}</td>
                    <td className="px-5 py-3.5 text-xs font-semibold text-ink">
                      {l.value !== null
                        ? `${l.currency} ${Number(l.value).toFixed(2)}`
                        : l.budget_min || l.budget_max
                        ? `${l.budget_min || l.budget_max} ${l.currency}`
                        : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink-soft">{l.owner_name || "Unassigned"}</td>
                    <td className="px-5 py-3.5 text-xs text-ink-soft">
                      {l.next_followup_at ? new Date(l.next_followup_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-pine truncate max-w-[150px]">
                      {l.first_ad_title || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-ink-faint">
                      {new Date(l.updated_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* ================= LEAD DRAWER ================= */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-2xl bg-panel h-full shadow-2xl flex flex-col border-l border-line overflow-y-auto">
            {/* Drawer Header */}
            <div className="p-6 border-b border-line bg-canvas/30 sticky top-0 z-20 backdrop-blur">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold tracking-tight text-ink">
                      {selectedLead.name || selectedLead.phone}
                    </h2>
                    <Tag
                      tone={
                        selectedLead.stage === "new"
                          ? "warn"
                          : selectedLead.stage === "won"
                          ? "good"
                          : selectedLead.stage === "lost"
                          ? "bad"
                          : "neutral"
                      }
                    >
                      {selectedLead.stage.toUpperCase()}
                    </Tag>
                  </div>
                  <p className="text-xs text-ink-soft mt-1 flex items-center gap-3">
                    <span className="font-mono">+{selectedLead.phone}</span>
                    <span>·</span>
                    <span>Kind: {selectedLead.kind}</span>
                    {selectedLead.first_ad_title && (
                      <>
                        <span>·</span>
                        <span className="text-pine font-medium">Ad: {selectedLead.first_ad_title}</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Link
                    href={`/chats?phone=${selectedLead.phone}`}
                    className="px-3 py-1.5 rounded-md bg-pine-wash text-pine-deep text-xs font-semibold hover:bg-pine/20"
                  >
                    Open Chat 💬
                  </Link>
                  <button
                    onClick={() => setSelectedLead(null)}
                    className="p-1.5 text-ink-soft hover:text-ink text-sm rounded-md border border-line bg-panel"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-line/60">
                {/* Stage dropdown */}
                <select
                  value={selectedLead.stage}
                  onChange={(e) => updateStage(selectedLead.id, e.target.value as Lead["stage"])}
                  className="rounded-md border border-line bg-panel px-2.5 py-1 text-xs font-semibold text-ink"
                >
                  {STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      Stage: {s.label}
                    </option>
                  ))}
                </select>

                {/* Mark Won */}
                {selectedLead.stage !== "won" && (
                  <button
                    onClick={() => {
                      setWonValue(selectedLead.budget_max ? String(selectedLead.budget_max) : selectedLead.budget_min ? String(selectedLead.budget_min) : "");
                      setWonModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded bg-pine text-white text-xs font-semibold hover:bg-pine-deep"
                  >
                    ✓ Mark Won
                  </button>
                )}

                {/* Mark Lost */}
                {selectedLead.stage !== "lost" && (
                  <button
                    onClick={() => {
                      setLostReason("");
                      setLostModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded border border-line bg-panel text-brick text-xs font-semibold hover:bg-canvas"
                  >
                    ✕ Mark Lost
                  </button>
                )}

                {/* Schedule Appointment */}
                {services.length > 0 && (
                  <button
                    onClick={() => setApptModalOpen(true)}
                    className="px-2.5 py-1 rounded border border-line bg-panel text-ink text-xs font-semibold hover:bg-canvas"
                  >
                    📅 Book appointment / visit
                  </button>
                )}
              </div>

              {/* Drawer Tabs */}
              <div className="flex gap-4 mt-5 border-b border-line text-sm font-medium">
                <button
                  onClick={() => setDrawerTab("details")}
                  className={`pb-2 transition-colors ${
                    drawerTab === "details"
                      ? "border-b-2 border-pine text-pine-deep font-semibold"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  Details & Timeline
                </button>
                <button
                  onClick={() => setDrawerTab("quotes")}
                  className={`pb-2 transition-colors ${
                    drawerTab === "quotes"
                      ? "border-b-2 border-pine text-pine-deep font-semibold"
                      : "text-ink-soft hover:text-ink"
                  }`}
                >
                  Quotes ({quotes.length})
                </button>
              </div>
            </div>

            {/* Drawer Body */}
            <div className="p-6 space-y-6 flex-1">
              {drawerTab === "details" ? (
                <>
                  {/* Details JSONB Chips */}
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft mb-3">
                      Enquiry Details
                    </h3>
                    {Object.keys(selectedLead.details || {}).length === 0 && !selectedLead.summary ? (
                      <p className="text-xs text-ink-soft italic">No specific details recorded.</p>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {Object.entries(selectedLead.details || {}).map(([k, v]) => {
                          const humanLabel = DETAIL_LABELS[k] || k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                          return (
                            <div key={k} className="bg-canvas border border-line rounded-md p-2 text-xs">
                              <span className="text-[10px] text-ink-soft font-medium uppercase tracking-wider block">
                                {humanLabel}
                              </span>
                              <span className="font-semibold text-ink mt-0.5 block truncate">
                                {typeof v === "object" ? JSON.stringify(v) : String(v)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Summary & Values */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-canvas border border-line rounded-md p-3">
                      <span className="text-xs text-ink-soft font-medium block">Owner</span>
                      <select
                        value={selectedLead.assigned_to ?? ""}
                        onChange={(e) => assignLead(selectedLead.id, e.target.value ? Number(e.target.value) : null)}
                        className="mt-1 w-full text-xs font-semibold bg-panel border border-line rounded px-2 py-1.5"
                      >
                        <option value="">Unassigned</option>
                        {teamMembers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.full_name || m.email}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="bg-canvas border border-line rounded-md p-3">
                      <span className="text-xs text-ink-soft font-medium block">Next Follow-up</span>
                      <input
                        type="datetime-local"
                        value={
                          selectedLead.next_followup_at
                            ? new Date(new Date(selectedLead.next_followup_at).getTime() - new Date().getTimezoneOffset() * 60000)
                                .toISOString()
                                .slice(0, 16)
                            : ""
                        }
                        onChange={(e) => setFollowup(selectedLead.id, e.target.value)}
                        className="mt-1 w-full text-xs font-semibold bg-panel border border-line rounded px-2 py-1.5"
                      />
                    </div>
                  </div>

                  {/* Timeline & Notes */}
                  <div className="pt-4 border-t border-line space-y-4">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                      Activity Timeline
                    </h3>

                    {/* Add note */}
                    <form onSubmit={submitNote} className="space-y-2">
                      <textarea
                        rows={2}
                        placeholder="Add internal note or update..."
                        value={newNote}
                        onChange={(e) => setNewNote(e.target.value)}
                        className={inputClass}
                      />
                      <div className="flex justify-end">
                        <Button type="submit" disabled={noteSubmitting || !newNote.trim()}>
                          {noteSubmitting ? "Adding..." : "Add Note"}
                        </Button>
                      </div>
                    </form>

                    {/* Timeline feed */}
                    {eventsLoading ? (
                      <p className="text-xs text-ink-soft">Loading activity...</p>
                    ) : events.length === 0 ? (
                      <p className="text-xs text-ink-soft italic">No activity recorded yet.</p>
                    ) : (
                      <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-line">
                        {events.map((ev) => (
                          <div key={ev.id} className="relative text-xs">
                            <span
                              className={`absolute -left-6 top-1 w-2.5 h-2.5 rounded-full border-2 border-panel ${
                                ev.kind === "stage"
                                  ? "bg-pine"
                                  : ev.kind === "quote"
                                  ? "bg-amber"
                                  : ev.kind === "assign"
                                  ? "bg-blue-500"
                                  : "bg-ink-soft"
                              }`}
                            />
                            <div className="bg-canvas border border-line rounded-md p-2.5">
                              <div className="flex items-center justify-between text-[11px] text-ink-soft mb-1">
                                <span className="font-semibold capitalize text-ink">
                                  {ev.kind}: {ev.created_by_name || "System"}
                                </span>
                                <span>{new Date(ev.created_at).toLocaleString()}</span>
                              </div>
                              <p className="text-ink leading-relaxed">{ev.body}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                /* ================= QUOTES TAB ================= */
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-ink">Quotes for {selectedLead.name || selectedLead.phone}</h3>
                    {!quoteBuilderOpen && (
                      <Button variant="primary" onClick={() => setQuoteBuilderOpen(true)}>
                        + Create Quote
                      </Button>
                    )}
                  </div>

                  {/* Quote Builder Form */}
                  {quoteBuilderOpen && (
                    <div className="bg-canvas border border-line rounded-lg p-4 space-y-4 shadow-sm">
                      <div className="flex items-center justify-between border-b border-line pb-2">
                        <h4 className="font-semibold text-sm text-ink">New Quote</h4>
                        <button
                          onClick={() => setQuoteBuilderOpen(false)}
                          className="text-xs text-ink-soft hover:text-ink"
                        >
                          Cancel
                        </button>
                      </div>

                      {/* Line Items */}
                      <div className="space-y-3">
                        <span className="text-xs font-bold text-ink-soft uppercase tracking-wider block">
                          Line Items
                        </span>
                        {quoteLines.map((line, idx) => (
                          <div key={idx} className="bg-panel border border-line rounded-md p-3 space-y-2">
                            <div className="flex items-center gap-2">
                              {/* Catalog item picker */}
                              {catalogItems.length > 0 && (
                                <select
                                  onChange={(e) => {
                                    if (e.target.value) selectCatalogItemForLine(idx, Number(e.target.value));
                                  }}
                                  className="text-xs bg-canvas border border-line rounded px-2 py-1 max-w-[180px]"
                                  defaultValue=""
                                >
                                  <option value="">Pick from catalog...</option>
                                  {catalogItems.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name} ({c.currency} {c.price})
                                    </option>
                                  ))}
                                </select>
                              )}
                              <span className="text-xs text-ink-soft">or enter custom description:</span>
                            </div>

                            <input
                              type="text"
                              placeholder="Description / Service / Product name"
                              value={line.description}
                              onChange={(e) => updateQuoteLine(idx, { description: e.target.value })}
                              className={inputClass}
                            />

                            <div className="grid grid-cols-3 gap-2 items-center">
                              <div>
                                <span className="text-[10px] text-ink-soft block">Qty</span>
                                <input
                                  type="number"
                                  min="1"
                                  value={line.qty}
                                  onChange={(e) => updateQuoteLine(idx, { qty: Number(e.target.value) || 1 })}
                                  className={inputClass}
                                />
                              </div>
                              <div>
                                <span className="text-[10px] text-ink-soft block">Unit Price ({quoteCurrency})</span>
                                <input
                                  type="number"
                                  step="0.01"
                                  value={line.price}
                                  onChange={(e) => updateQuoteLine(idx, { price: Number(e.target.value) || 0 })}
                                  className={inputClass}
                                />
                              </div>
                              <div className="flex items-end justify-between">
                                <div>
                                  <span className="text-[10px] text-ink-soft block">Line Total</span>
                                  <span className="font-bold text-sm text-ink font-mono">
                                    {line.total.toFixed(2)}
                                  </span>
                                </div>
                                {quoteLines.length > 1 && (
                                  <button
                                    onClick={() => removeQuoteLine(idx)}
                                    className="text-xs text-brick hover:underline pb-1"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}

                        <button
                          type="button"
                          onClick={addQuoteLine}
                          className="text-xs text-pine font-semibold hover:underline block"
                        >
                          + Add Line Item
                        </button>
                      </div>

                      {/* Valid until and Notes */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <span className="text-xs text-ink-soft block">Valid Until</span>
                          <input
                            type="date"
                            value={quoteValidUntil}
                            onChange={(e) => setQuoteValidUntil(e.target.value)}
                            className={inputClass}
                          />
                        </div>
                        <div>
                          <span className="text-xs text-ink-soft block">Currency</span>
                          <input
                            type="text"
                            value={quoteCurrency}
                            onChange={(e) => setQuoteCurrency(e.target.value.toUpperCase())}
                            className={inputClass}
                          />
                        </div>
                      </div>

                      <div>
                        <span className="text-xs text-ink-soft block">Notes / Terms</span>
                        <textarea
                          rows={2}
                          placeholder="e.g. 50% advance upon confirmation. Delivery in 5 business days."
                          value={quoteNotes}
                          onChange={(e) => setQuoteNotes(e.target.value)}
                          className={inputClass}
                        />
                      </div>

                      {/* Total and Actions */}
                      <div className="flex items-center justify-between pt-3 border-t border-line">
                        <div>
                          <span className="text-xs text-ink-soft block">Total</span>
                          <span className="text-lg font-bold text-ink font-mono">
                            {quoteCurrency} {quoteSubtotal.toFixed(2)}
                          </span>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="quiet"
                            onClick={saveQuoteDraft}
                            disabled={quoteSubmitting}
                          >
                            Save Draft
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Existing Quotes list */}
                  {quotesLoading ? (
                    <p className="text-xs text-ink-soft">Loading quotes...</p>
                  ) : quotes.length === 0 ? (
                    <Empty title="No quotes created yet">
                      Create itemized proposals with catalog items or custom lines and send directly on WhatsApp.
                    </Empty>
                  ) : (
                    <div className="space-y-4">
                      {quotes.map((q) => (
                        <div key={q.id} className="bg-panel border border-line rounded-lg p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-ink">Quote #{q.id}</span>
                              <Tag
                                tone={
                                  q.status === "accepted"
                                    ? "good"
                                    : q.status === "sent"
                                    ? "warn"
                                    : q.status === "declined"
                                    ? "bad"
                                    : "neutral"
                                }
                              >
                                {q.status.toUpperCase()}
                              </Tag>
                            </div>
                            <span className="text-xs text-ink-soft">
                              {new Date(q.created_at).toLocaleDateString()}
                            </span>
                          </div>

                          {/* Line items list */}
                          <div className="bg-canvas border border-line rounded p-2.5 text-xs space-y-1">
                            {q.lines?.map((line, i) => (
                              <div key={i} className="flex justify-between items-center text-ink-soft">
                                <span>
                                  {line.description} × {line.qty}
                                </span>
                                <span className="font-mono text-ink">
                                  {q.currency} {Number(line.total).toFixed(2)}
                                </span>
                              </div>
                            ))}
                            <div className="pt-2 mt-1 border-t border-line flex justify-between font-bold text-ink">
                              <span>Total</span>
                              <span className="font-mono">
                                {q.currency} {Number(q.total).toFixed(2)}
                              </span>
                            </div>
                          </div>

                          {q.valid_until && (
                            <p className="text-xs text-ink-soft">
                              Valid until: {new Date(q.valid_until).toLocaleDateString()}
                            </p>
                          )}

                          {q.notes && (
                            <p className="text-xs text-ink-soft italic">Note: {q.notes}</p>
                          )}

                          {/* Actions */}
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-line">
                            {q.status === "draft" && (
                              <Button
                                variant="primary"
                                onClick={() => sendQuoteWhatsApp(q.id)}
                              >
                                Send on WhatsApp 📤
                              </Button>
                            )}

                            {q.status === "sent" && (
                              <>
                                <button
                                  onClick={() => setQuoteStatus(q.id, "accepted")}
                                  className="px-3 py-1.5 rounded bg-pine text-white text-xs font-semibold hover:bg-pine-deep"
                                >
                                  ✓ Mark Accepted
                                </button>
                                <button
                                  onClick={() => setQuoteStatus(q.id, "declined")}
                                  className="px-3 py-1.5 rounded border border-line bg-panel text-brick text-xs font-semibold hover:bg-canvas"
                                >
                                  ✕ Mark Declined
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: MARK WON ================= */}
      {wonModalOpen && selectedLead && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-panel border border-line rounded-lg p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="font-bold text-lg text-ink">Mark Won — {selectedLead.name || selectedLead.phone}</h3>
            <p className="text-xs text-ink-soft">
              Congratulations on closing this deal! Record the final value and any closing notes.
            </p>

            <Field label={`Deal Value (${selectedLead.currency})`}>
              <input
                type="number"
                step="0.01"
                placeholder="e.g. 5000"
                value={wonValue}
                onChange={(e) => setWonValue(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Closing Note">
              <input
                type="text"
                placeholder="e.g. Signed annual contract"
                value={wonNote}
                onChange={(e) => setWonNote(e.target.value)}
                className={inputClass}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-3 border-t border-line">
              <Button variant="quiet" onClick={() => setWonModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  updateStage(selectedLead.id, "won", {
                    value: wonValue ? Number(wonValue) : undefined,
                    note: wonNote || undefined,
                  });
                  setWonModalOpen(false);
                }}
              >
                Confirm Won ✓
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: MARK LOST ================= */}
      {lostModalOpen && selectedLead && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-panel border border-line rounded-lg p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="font-bold text-lg text-ink">Mark Lost — {selectedLead.name || selectedLead.phone}</h3>
            <p className="text-xs text-ink-soft">
              Record the reason for loss so your team can improve conversion.
            </p>

            <Field label="Reason for Loss">
              <input
                type="text"
                placeholder="e.g. Budget too low, chose competitor, timing not right"
                value={lostReason}
                onChange={(e) => setLostReason(e.target.value)}
                className={inputClass}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-3 border-t border-line">
              <Button variant="quiet" onClick={() => setLostModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  updateStage(selectedLead.id, "lost", {
                    lost_reason: lostReason || "Lost",
                  });
                  setLostModalOpen(false);
                }}
              >
                Confirm Lost ✕
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: REOPEN WON/LOST LEAD ================= */}
      {reopenModalOpen && selectedLead && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-panel border border-line rounded-lg p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="font-bold text-lg text-ink">Reopen Lead</h3>
            <p className="text-xs text-ink-soft">
              This lead was previously marked <strong>{selectedLead.stage.toUpperCase()}</strong>. To change its stage, please provide an explanation note.
            </p>

            <Field label="Reopen Explanation Note *">
              <textarea
                rows={3}
                placeholder="e.g. Client requested revisions to requirements / rekindled discussion"
                value={reopenNote}
                onChange={(e) => setReopenNote(e.target.value)}
                className={inputClass}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-3 border-t border-line">
              <Button variant="quiet" onClick={() => setReopenModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={!reopenNote.trim()}
                onClick={() => {
                  updateStage(selectedLead.id, reopenTargetStage, { note: reopenNote.trim() });
                  setReopenModalOpen(false);
                }}
              >
                Reopen Lead
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL: CREATE LEAD ================= */}
      {createLeadModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={submitCreateLead} className="bg-panel border border-line rounded-lg p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="font-bold text-lg text-ink">New {leadLabel}</h3>

            <Field label="Phone Number *">
              <input
                type="tel"
                placeholder="e.g. 97455123456"
                value={newLeadPhone}
                onChange={(e) => setNewLeadPhone(e.target.value)}
                className={inputClass}
                required
              />
            </Field>

            <Field label="Customer / Contact Name">
              <input
                type="text"
                placeholder="e.g. Sarah Miller"
                value={newLeadName}
                onChange={(e) => setNewLeadName(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Kind / Category">
              <input
                type="text"
                placeholder="e.g. package, property, course, general"
                value={newLeadKind}
                onChange={(e) => setNewLeadKind(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Summary">
              <input
                type="text"
                placeholder="Brief summary of requirements..."
                value={newLeadSummary}
                onChange={(e) => setNewLeadSummary(e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Budget (approximate)">
              <input
                type="number"
                placeholder="e.g. 3500"
                value={newLeadBudget}
                onChange={(e) => setNewLeadBudget(e.target.value)}
                className={inputClass}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-3 border-t border-line">
              <Button type="button" variant="quiet" onClick={() => setCreateLeadModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Create {leadLabel}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* ================= MODAL: CREATE APPOINTMENT ================= */}
      {apptModalOpen && selectedLead && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={submitAppointment} className="bg-panel border border-line rounded-lg p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="font-bold text-lg text-ink">Book Appointment / Visit</h3>
            <p className="text-xs text-ink-soft">
              Prefilled for {selectedLead.name || selectedLead.phone} (+{selectedLead.phone}).
            </p>

            <Field label="Service / Session Type *">
              <select
                value={apptServiceId}
                onChange={(e) => setApptServiceId(e.target.value)}
                className={inputClass}
                required
              >
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.duration_min} min)
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Date & Time *">
              <input
                type="datetime-local"
                value={apptDateTime}
                onChange={(e) => setApptDateTime(e.target.value)}
                className={inputClass}
                required
              />
            </Field>

            <Field label="Notes">
              <input
                type="text"
                placeholder="e.g. Site visit for villa listing"
                value={apptNotes}
                onChange={(e) => setApptNotes(e.target.value)}
                className={inputClass}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-3 border-t border-line">
              <Button type="button" variant="quiet" onClick={() => setApptModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={apptSubmitting}>
                {apptSubmitting ? "Booking..." : "Confirm Booking"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
