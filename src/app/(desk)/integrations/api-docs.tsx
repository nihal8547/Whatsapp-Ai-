"use client";

import { useState } from "react";
import { Panel, Button, Tag } from "@/components/ui";
import { ApiKey } from "./integrations-view";

const BASE_API_URL =
  process.env.NEXT_PUBLIC_TENANT_API_URL || "https://n8n.webbea.qa/webhook/tenant-api";

export type EndpointDoc = {
  id: string;
  title: string;
  description: string;
  requestBody: Record<string, any>;
  paramsList?: { name: string; type: string; required: boolean; desc: string }[];
  responseBody: Record<string, any>;
};

export const ENDPOINTS_DATA: EndpointDoc[] = [
  {
    id: "services",
    title: "Services",
    description: "List your active services with prices and durations",
    requestBody: {
      endpoint: "services",
    },
    paramsList: [
      { name: "endpoint", type: "string", required: true, desc: "Must be 'services'" },
    ],
    responseBody: {
      ok: true,
      services: [
        {
          id: 1,
          name: "Dental Cleaning",
          description: "Routine examination and professional ultrasonic scaling",
          duration_min: 45,
          price: "150.00",
          currency: "QAR",
          active: true,
        },
      ],
    },
  },
  {
    id: "hours",
    title: "Business hours",
    description: "Get your opening hours for each day of the week",
    requestBody: {
      endpoint: "hours",
    },
    paramsList: [
      { name: "endpoint", type: "string", required: true, desc: "Must be 'hours'" },
    ],
    responseBody: {
      ok: true,
      hours: [
        {
          weekday: 0,
          open_time: "09:00:00",
          close_time: "18:00:00",
          is_closed: false,
        },
        {
          weekday: 5,
          open_time: "00:00:00",
          close_time: "00:00:00",
          is_closed: true,
        },
      ],
    },
  },
  {
    id: "contacts",
    title: "Contacts",
    description: "List your customers with their source, tags and last activity",
    requestBody: {
      endpoint: "contacts",
    },
    paramsList: [
      { name: "endpoint", type: "string", required: true, desc: "Must be 'contacts'. Returns max 200 ordered by last_message_at desc." },
    ],
    responseBody: {
      ok: true,
      contacts: [
        {
          phone: "+97455551234",
          name: "Fatima Al-Kuwari",
          lead_source: "organic",
          ad_title: null,
          tags: ["vip", "repeat_customer"],
          created_at: "2026-10-01T10:00:00Z",
          last_message_at: "2026-10-24T09:15:00Z",
          needs_human: false,
        },
      ],
    },
  },
  {
    id: "contact-detail",
    title: "Contact detail",
    description: "Get full details of one customer by phone number",
    requestBody: {
      endpoint: "contacts/+97455551234",
    },
    paramsList: [
      { name: "endpoint", type: "string", required: true, desc: "Format: 'contacts/<phone>'. Accepts phone numbers with or without '+' prefix." },
    ],
    responseBody: {
      ok: true,
      contact: {
        phone: "+97455551234",
        name: "Fatima Al-Kuwari",
        lead_source: "organic",
        tags: ["vip"],
        notes: "Prefers morning appointments",
        created_at: "2026-10-01T10:00:00Z",
        last_message_at: "2026-10-24T09:15:00Z",
        needs_human: false,
        bot_enabled: true,
        consent_status: "opted_in",
      },
    },
  },
  {
    id: "appointments",
    title: "Appointments",
    description: "List bookings, optionally filtered by status or phone",
    requestBody: {
      endpoint: "appointments",
      status: "confirmed",
      phone: "+97455551234",
    },
    paramsList: [
      { name: "endpoint", type: "string", required: true, desc: "Must be 'appointments'" },
      { name: "status", type: "string", required: false, desc: "Filter: 'confirmed', 'cancelled', 'completed', or 'no_show'" },
      { name: "phone", type: "string", required: false, desc: "Filter by customer phone number" },
    ],
    responseBody: {
      ok: true,
      appointments: [
        {
          id: 101,
          booking_ref: "BK-0101",
          phone: "+97455551234",
          customer_name: "Fatima Al-Kuwari",
          service: "Dental Cleaning",
          start_time: "2026-10-25T10:00:00Z",
          end_time: "2026-10-25T10:45:00Z",
          status: "confirmed",
          notes: "First appointment",
          source: "whatsapp",
          created_at: "2026-10-24T08:00:00Z",
        },
      ],
    },
  },
  {
    id: "chats",
    title: "Chat history",
    description: "Get the last 50 messages with one customer",
    requestBody: {
      endpoint: "chats/+97455551234",
    },
    paramsList: [
      { name: "endpoint", type: "string", required: true, desc: "Format: 'chats/<phone>'. Returns the last 50 messages, newest first." },
    ],
    responseBody: {
      ok: true,
      messages: [
        {
          direction: "in",
          sender: "customer",
          type: "text",
          content: "Can I book an appointment for tomorrow at 10 AM?",
          created_at: "2026-10-24T09:15:00Z",
        },
        {
          direction: "out",
          sender: "bot",
          type: "text",
          content: "Hello Fatima! Yes, 10:00 AM is available with Dr. Sarah. Would you like me to book it?",
          created_at: "2026-10-24T09:15:05Z",
        },
      ],
    },
  },
  {
    id: "stats",
    title: "Dashboard stats",
    description: "Quick counts: contacts, upcoming appointments, today's messages",
    requestBody: {
      endpoint: "stats",
    },
    paramsList: [
      { name: "endpoint", type: "string", required: true, desc: "Must be 'stats'" },
    ],
    responseBody: {
      ok: true,
      stats: {
        contacts: 142,
        appointments_upcoming: 8,
        messages_today: 34,
        ai_replies_today: 29,
        needs_human: 2,
      },
    },
  },
];

export const FIELD_REFERENCE_DATA = [
  {
    endpoint: "Services",
    fields: [
      { name: "id", type: "integer", desc: "Unique internal identifier of the service." },
      { name: "name", type: "string", desc: "Service display name." },
      { name: "description", type: "string", desc: "Detailed summary of what the service includes." },
      { name: "duration_min", type: "integer", desc: "Duration of the appointment in minutes." },
      { name: "price", type: "string / number", desc: "Base price formatted as currency amount." },
      { name: "currency", type: "string", desc: "3-letter ISO currency code (e.g., 'QAR', 'USD')." },
      { name: "active", type: "boolean", desc: "Whether the service is currently offered and bookable." },
    ],
  },
  {
    endpoint: "Business Hours",
    fields: [
      { name: "weekday", type: "integer", desc: "Day index: 0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday." },
      { name: "open_time", type: "string", desc: "Opening time in HH:MM:SS 24-hour format." },
      { name: "close_time", type: "string", desc: "Closing time in HH:MM:SS 24-hour format." },
      { name: "is_closed", type: "boolean", desc: "True if the business is closed on this day." },
    ],
  },
  {
    endpoint: "Contacts",
    fields: [
      { name: "phone", type: "string", desc: "Customer phone number in international E.164 format." },
      { name: "name", type: "string", desc: "Customer display name or WhatsApp push name." },
      { name: "lead_source", type: "string", desc: "'organic' (customer initiated) or 'ad' (clicked Meta/Instagram ad)." },
      { name: "ad_title", type: "string | null", desc: "Title of the advertisement clicked if lead_source is 'ad'." },
      { name: "tags", type: "array of strings", desc: "Assigned customer labels (e.g. ['vip', 'inquiry'])." },
      { name: "notes", type: "string", desc: "Staff notes or bot memory about customer preferences." },
      { name: "needs_human", type: "boolean", desc: "True if customer requested a human agent or bot paused." },
      { name: "bot_enabled", type: "boolean", desc: "Whether AI auto-reply is currently enabled for this contact." },
      { name: "consent_status", type: "string", desc: "Opt-in state: 'unknown', 'opted_in', or 'opted_out'." },
      { name: "created_at", type: "string (ISO 8601)", desc: "Timestamp when contact first contacted business." },
      { name: "last_message_at", type: "string (ISO 8601)", desc: "Timestamp of most recent message." },
    ],
  },
  {
    endpoint: "Appointments",
    fields: [
      { name: "id", type: "integer", desc: "Internal appointment identifier." },
      { name: "booking_ref", type: "string", desc: "Human-readable booking reference formatted as 'BK-0001'." },
      { name: "phone", type: "string", desc: "Customer contact phone number." },
      { name: "customer_name", type: "string", desc: "Customer name at time of booking." },
      { name: "service", type: "string", desc: "Name of the booked service." },
      { name: "start_time", type: "string (ISO 8601)", desc: "Scheduled appointment start datetime with timezone." },
      { name: "end_time", type: "string (ISO 8601)", desc: "Scheduled appointment end datetime with timezone." },
      { name: "status", type: "string", desc: "Booking status: 'confirmed', 'cancelled', 'completed', or 'no_show'." },
      { name: "notes", type: "string", desc: "Customer or staff booking notes." },
      { name: "source", type: "string", desc: "Booking channel (e.g. 'whatsapp', 'admin', 'website')." },
      { name: "created_at", type: "string (ISO 8601)", desc: "Creation timestamp in ISO 8601 format." },
    ],
  },
  {
    endpoint: "Chat History",
    fields: [
      { name: "direction", type: "string", desc: "'in' (customer to business) or 'out' (business to customer)." },
      { name: "sender", type: "string", desc: "'customer', 'bot' (AI), 'staff' (human from dashboard), or 'system' (broadcast/reminder)." },
      { name: "type", type: "string", desc: "Message type: 'text', 'image', 'document', 'audio', etc." },
      { name: "content", type: "string", desc: "Text body or caption of the message." },
      { name: "created_at", type: "string (ISO 8601)", desc: "Timestamp when the message was sent or received." },
    ],
  },
  {
    endpoint: "Dashboard Stats",
    fields: [
      { name: "contacts", type: "integer", desc: "Total customer contacts registered for this workspace." },
      { name: "appointments_upcoming", type: "integer", desc: "Total future confirmed appointments." },
      { name: "messages_today", type: "integer", desc: "Inbound messages received today." },
      { name: "ai_replies_today", type: "integer", desc: "AI assistant responses delivered today." },
      { name: "needs_human", type: "integer", desc: "Number of chats currently flagged for human intervention." },
    ],
  },
];

type Props = {
  keys: ApiKey[];
  onGoToKeysTab: () => void;
};

export default function ApiDocs({ keys, onGoToKeysTab }: Props) {
  const [copiedBaseUrl, setCopiedBaseUrl] = useState(false);
  const [quickStartOpen, setQuickStartOpen] = useState(keys.length === 0);
  const [fieldRefOpen, setFieldRefOpen] = useState(false);

  // Active code snippet tabs per endpoint: key = endpointId, value = "curl" | "fetch" | "python" | "php"
  const [codeTabs, setCodeTabs] = useState<Record<string, "curl" | "fetch" | "python" | "php">>({});
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);

  // Try it panel states: key = endpointId
  const [activeTryItId, setActiveTryItId] = useState<string | null>(null);
  const [tryItBodies, setTryItBodies] = useState<Record<string, string>>({});
  const [userApiKeys, setUserApiKeys] = useState<Record<string, string>>({});
  const [runningEndpoint, setRunningEndpoint] = useState<string | null>(null);
  const [tryItResults, setTryItResults] = useState<
    Record<
      string,
      {
        status: number;
        statusText: string;
        timeMs: number;
        data: any;
        rawText: string;
        error?: string;
      }
    >
  >({});

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    if (id === "base_url") {
      setCopiedBaseUrl(true);
      setTimeout(() => setCopiedBaseUrl(false), 2000);
    } else {
      setCopiedSnippet(id);
      setTimeout(() => setCopiedSnippet(null), 2000);
    }
  }

  function getCodeTab(epId: string): "curl" | "fetch" | "python" | "php" {
    return codeTabs[epId] || "curl";
  }

  function setEndpointTab(epId: string, tab: "curl" | "fetch" | "python" | "php") {
    setCodeTabs((prev) => ({ ...prev, [epId]: tab }));
  }

  function toggleTryIt(ep: EndpointDoc) {
    if (activeTryItId === ep.id) {
      setActiveTryItId(null);
    } else {
      setActiveTryItId(ep.id);
      if (!tryItBodies[ep.id]) {
        setTryItBodies((prev) => ({
          ...prev,
          [ep.id]: JSON.stringify(ep.requestBody, null, 2),
        }));
      }
    }
  }

  // Direct client-side fetch from browser directly to n8n webhook URL
  async function runTryIt(ep: EndpointDoc) {
    const rawBody = tryItBodies[ep.id] || JSON.stringify(ep.requestBody, null, 2);
    const apiKey = (userApiKeys[ep.id] || "").trim();

    setRunningEndpoint(ep.id);

    const start = performance.now();
    try {
      let parsedBody: any;
      try {
        parsedBody = JSON.parse(rawBody);
      } catch (err: any) {
        setRunningEndpoint(null);
        setTryItResults((prev) => ({
          ...prev,
          [ep.id]: {
            status: 400,
            statusText: "Invalid JSON",
            timeMs: 0,
            data: null,
            rawText: "",
            error: "SyntaxError: Request body contains invalid JSON. Please fix and try again.",
          },
        }));
        return;
      }

      const res = await fetch(BASE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey || "YOUR_API_KEY",
        },
        body: JSON.stringify(parsedBody),
      });

      const timeMs = Math.round(performance.now() - start);
      const text = await res.text();
      let parsedData: any = null;
      try {
        parsedData = JSON.parse(text);
      } catch {
        parsedData = { raw: text };
      }

      setRunningEndpoint(null);
      setTryItResults((prev) => ({
        ...prev,
        [ep.id]: {
          status: res.status,
          statusText: res.statusText || (res.ok ? "OK" : "Error"),
          timeMs,
          data: parsedData,
          rawText: text,
        },
      }));
    } catch (err: any) {
      const timeMs = Math.round(performance.now() - start);
      setRunningEndpoint(null);
      setTryItResults((prev) => ({
        ...prev,
        [ep.id]: {
          status: 0,
          statusText: "Network Error",
          timeMs,
          data: null,
          rawText: "",
          error:
            err?.message ||
            "Failed to fetch from n8n webhook URL. Check your internet connection or CORS settings.",
        },
      }));
    }
  }

  function generateCodeSnippet(
    ep: EndpointDoc,
    lang: "curl" | "fetch" | "python" | "php",
    userKey?: string
  ): string {
    const key = userKey?.trim() || "YOUR_API_KEY";
    const bodyStr = JSON.stringify(ep.requestBody, null, 2);

    if (lang === "curl") {
      return `curl -X POST "${BASE_API_URL}" \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: ${key}" \\
  -d '${JSON.stringify(ep.requestBody, null, 2)}'`;
    }

    if (lang === "fetch") {
      return `const response = await fetch("${BASE_API_URL}", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "${key}"
  },
  body: JSON.stringify(${bodyStr.replace(/\n/g, "\n  ")})
});

const data = await response.json();
console.log(data);`;
    }

    if (lang === "python") {
      return `import requests

url = "${BASE_API_URL}"
headers = {
    "Content-Type": "application/json",
    "x-api-key": "${key}"
}
payload = ${bodyStr.replace(/"/g, '"')}

response = requests.post(url, headers=headers, json=payload)
data = response.json()
print(data)`;
    }

    if (lang === "php") {
      return `<?php
$curl = curl_init();

$payload = json_encode(${bodyStr.replace(/"/g, '"')});

curl_setopt_array($curl, [
    CURLOPT_URL => "${BASE_API_URL}",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_CUSTOMREQUEST => "POST",
    CURLOPT_POSTFIELDS => $payload,
    CURLOPT_HTTPHEADER => [
        "Content-Type: application/json",
        "x-api-key: ${key}"
    ],
]);

$response = curl_exec($curl);
curl_close($curl);

$data = json_decode($response, true);
print_r($data);
?>`;
    }

    return "";
  }

  return (
    <div className="space-y-6">
      {/* ── 1. OVERVIEW CARD ── */}
      <Panel>
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold text-ink tracking-tight">
                Tenant Public REST API
              </h2>
              <p className="text-sm text-ink-soft mt-1 leading-relaxed max-w-2xl">
                Connect your website, app, CRM or any tool to your WhatsApp business data. Every call
                uses your API key and returns only your business&apos;s data.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs px-2.5 py-1 rounded bg-pine-wash text-pine-deep font-medium border border-pine/30 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-pine inline-block animate-pulse" />
                API v1 Active
              </span>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-3 pt-2">
            {/* Endpoint Chip */}
            <div className="sm:col-span-2 p-3.5 bg-canvas/70 border border-line rounded-lg">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft">
                  Webhook Base URL (POST)
                </span>
                <button
                  type="button"
                  onClick={() => copyText(BASE_API_URL, "base_url")}
                  className="text-xs text-pine hover:text-pine-deep font-medium flex items-center gap-1"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  <span>{copiedBaseUrl ? "Copied!" : "Copy URL"}</span>
                </button>
              </div>
              <code className="text-xs font-mono text-ink font-semibold break-all select-all block">
                {BASE_API_URL}
              </code>
            </div>

            {/* Rate limit badge */}
            <div className="p-3.5 bg-canvas/70 border border-line rounded-lg">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft block mb-1">
                Rate Limit
              </span>
              <p className="text-xs text-ink font-medium leading-tight">
                Default 60 requests per minute. Shown on your key.
              </p>
            </div>
          </div>

          <div className="p-3 bg-amber-wash/50 border border-amber/20 rounded-lg text-xs text-ink-soft leading-relaxed flex items-start gap-2.5">
            <span className="text-amber text-sm shrink-0">🔑</span>
            <div>
              <strong className="text-ink font-medium">Authentication: </strong>
              Send your API key in the <code className="font-mono text-ink bg-panel px-1 py-0.5 rounded border border-line">x-api-key</code> header.
              All requests use HTTP <code className="font-mono text-ink font-bold">POST</code>. Put the endpoint name and any filters in the JSON body.
            </div>
          </div>
        </div>
      </Panel>

      {/* ── 2. QUICK-START GUIDE (COLLAPSIBLE) ── */}
      <Panel pad={false} className="overflow-hidden">
        <button
          type="button"
          onClick={() => setQuickStartOpen(!quickStartOpen)}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-canvas/50 transition-colors"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-pine/10 text-pine flex items-center justify-center font-bold text-xs">
              ⚡
            </div>
            <div>
              <h3 className="font-semibold text-sm text-ink">5-Minute Quick-Start Guide</h3>
              <p className="text-xs text-ink-soft">Get your integration running in 5 easy steps</p>
            </div>
          </div>
          <span className="text-xs text-ink-faint font-medium">
            {quickStartOpen ? "Hide guide ▲" : "Show guide ▼"}
          </span>
        </button>

        {quickStartOpen && (
          <div className="px-5 pb-5 pt-1 border-t border-line bg-canvas/20">
            <ol className="space-y-3 text-xs text-ink mt-2">
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-panel border border-line flex items-center justify-center font-bold text-[11px] shrink-0 text-pine">
                  1
                </span>
                <div>
                  <strong>Create an API key: </strong>
                  Switch to the{" "}
                  <button
                    type="button"
                    onClick={onGoToKeysTab}
                    className="text-pine font-medium underline underline-offset-2 hover:text-pine-deep"
                  >
                    API Keys
                  </button>{" "}
                  tab and click &quot;Create API Key&quot;.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-panel border border-line flex items-center justify-center font-bold text-[11px] shrink-0 text-pine">
                  2
                </span>
                <div>
                  <strong>Copy the key: </strong>
                  Save the key to a secure password manager or .env file (it is only shown once).
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-panel border border-line flex items-center justify-center font-bold text-[11px] shrink-0 text-pine">
                  3
                </span>
                <div>
                  <strong>Pick an endpoint: </strong>
                  Browse the documented endpoints below (e.g. Services, Contacts, Appointments).
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-panel border border-line flex items-center justify-center font-bold text-[11px] shrink-0 text-pine">
                  4
                </span>
                <div>
                  <strong>Test with &quot;Try it&quot;: </strong>
                  Use the inline interactive tester to test live payloads directly in your browser.
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-panel border border-line flex items-center justify-center font-bold text-[11px] shrink-0 text-pine">
                  5
                </span>
                <div>
                  <strong>Integrate into your codebase: </strong>
                  Copy the cURL, JavaScript, Python, or PHP code snippet directly into your backend or app.
                </div>
              </li>
            </ol>
          </div>
        )}
      </Panel>

      {/* ── 3. ENDPOINTS REFERENCE (ACCORDION SECTIONS) ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink-soft">
            Endpoints Reference ({ENDPOINTS_DATA.length})
          </h3>
          <span className="text-xs text-ink-faint">All endpoints use POST with JSON body</span>
        </div>

        {ENDPOINTS_DATA.map((ep, idx) => {
          const tab = getCodeTab(ep.id);
          const tryItOpen = activeTryItId === ep.id;
          const currentBody = tryItBodies[ep.id] ?? JSON.stringify(ep.requestBody, null, 2);
          const currentApiKey = userApiKeys[ep.id] || "";
          const result = tryItResults[ep.id];
          const isRunning = runningEndpoint === ep.id;

          const snippet = generateCodeSnippet(ep, tab, currentApiKey);

          return (
            <Panel key={ep.id} className="border-line overflow-hidden shadow-xs">
              <div className="space-y-4">
                {/* Header with Title and Try It button */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold bg-pine text-white px-2 py-0.5 rounded">
                        POST
                      </span>
                      <h4 className="text-base font-semibold text-ink">
                        {idx + 1}. {ep.title}
                      </h4>
                      <code className="text-xs font-mono text-ink-faint bg-canvas px-1.5 py-0.5 rounded border border-line">
                        endpoint: &quot;{ep.requestBody.endpoint}&quot;
                      </code>
                    </div>
                    <p className="text-xs text-ink-soft">{ep.description}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant={tryItOpen ? "primary" : "quiet"}
                      onClick={() => toggleTryIt(ep)}
                      className="text-xs py-1.5 px-3 flex items-center gap-1.5"
                    >
                      <span>▶</span>
                      <span>{tryItOpen ? "Close Tester" : "Try it"}</span>
                    </Button>
                  </div>
                </div>

                {/* Parameters Table if applicable */}
                {ep.paramsList && ep.paramsList.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-faint block mb-1.5">
                      Body Parameters
                    </span>
                    <div className="overflow-x-auto border border-line rounded-lg">
                      <table className="w-full text-xs">
                        <thead className="bg-canvas/50 border-b border-line text-left text-ink-soft">
                          <tr>
                            <th className="py-2 px-3 font-semibold">Parameter</th>
                            <th className="py-2 px-3 font-semibold">Type</th>
                            <th className="py-2 px-3 font-semibold">Required</th>
                            <th className="py-2 px-3 font-semibold">Description</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {ep.paramsList.map((p) => (
                            <tr key={p.name} className="hover:bg-canvas/30">
                              <td className="py-2 px-3 font-mono font-medium text-ink">{p.name}</td>
                              <td className="py-2 px-3 font-mono text-ink-soft text-[11px]">{p.type}</td>
                              <td className="py-2 px-3">
                                {p.required ? (
                                  <Tag tone="warn">required</Tag>
                                ) : (
                                  <span className="text-ink-faint text-[11px]">optional</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-ink-soft">{p.desc}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Request and Response side-by-side on desktop */}
                <div className="grid lg:grid-cols-2 gap-3 pt-1">
                  {/* Request Preview */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft block">
                      Example Request Body (JSON)
                    </span>
                    <div className="bg-[#10231c] text-[#e6f0ea] rounded-lg p-3 text-xs font-mono border border-[#17543a]/40 overflow-x-auto">
                      <pre>
                        <code>{JSON.stringify(ep.requestBody, null, 2)}</code>
                      </pre>
                    </div>
                  </div>

                  {/* Response Preview */}
                  <div className="space-y-1.5">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-soft block">
                      Example Response (JSON)
                    </span>
                    <div className="bg-[#10231c] text-[#e6f0ea] rounded-lg p-3 text-xs font-mono border border-[#17543a]/40 overflow-x-auto max-h-48 overflow-y-auto">
                      <pre>
                        <code>{JSON.stringify(ep.responseBody, null, 2)}</code>
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Code Examples with Tabs */}
                <div className="pt-2">
                  <div className="flex items-center justify-between bg-canvas/70 border border-line rounded-t-lg px-3 py-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      {(["curl", "fetch", "python", "php"] as const).map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setEndpointTab(ep.id, lang)}
                          className={`px-2.5 py-1 rounded text-xs transition-colors font-medium ${
                            tab === lang
                              ? "bg-pine text-white"
                              : "text-ink-soft hover:text-ink hover:bg-canvas"
                          }`}
                        >
                          {lang === "curl" && "cURL"}
                          {lang === "fetch" && "JavaScript (fetch)"}
                          {lang === "python" && "Python (requests)"}
                          {lang === "php" && "PHP (curl)"}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => copyText(snippet, `${ep.id}_${tab}`)}
                      className="px-2.5 py-1 text-xs text-ink-soft hover:text-ink rounded border border-line bg-panel hover:bg-canvas flex items-center gap-1 transition-colors"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                      </svg>
                      <span>{copiedSnippet === `${ep.id}_${tab}` ? "Copied!" : "Copy code"}</span>
                    </button>
                  </div>

                  <div className="bg-[#10231c] text-[#e6f0ea] p-4 text-xs font-mono rounded-b-lg border-x border-b border-[#17543a]/40 overflow-x-auto">
                    <pre>
                      <code>{snippet}</code>
                    </pre>
                  </div>
                </div>

                {/* ── TRY IT INTERACTIVE PANEL ── */}
                {tryItOpen && (
                  <div className="mt-4 p-4 rounded-xl border border-pine/30 bg-pine-wash/20 space-y-4 animate-in fade-in duration-200">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-2 border-b border-line">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-ink flex items-center gap-1.5">
                          <span>Interactive API Tester</span>
                        </span>
                        <Tag tone="good">Browser Direct</Tag>
                      </div>

                      {/* Security lock note */}
                      <div
                        className="flex items-center gap-1 text-[11px] text-ink-soft bg-panel px-2 py-0.5 rounded border border-line"
                        title="Your key is sent directly to the API, not through our server."
                      >
                        <span className="text-pine">🔒</span>
                        <span>Direct to API (Never saved on dashboard server)</span>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      {/* Pick existing key helper */}
                      <div>
                        <label className="block text-xs font-medium text-ink mb-1">
                          Select Key from Workspace
                        </label>
                        <select
                          className="w-full text-xs rounded-md border border-line bg-panel px-3 py-2 text-ink focus:border-pine focus:outline-none"
                          value={
                            keys.find((k) => k.key_prefix === currentApiKey.slice(0, 8))?.id || ""
                          }
                          onChange={(e) => {
                            const selectedId = Number(e.target.value);
                            const found = keys.find((k) => k.id === selectedId);
                            if (found) {
                              // If they pick a key, suggest pasting the full key for this prefix
                              setUserApiKeys((prev) => ({
                                ...prev,
                                [ep.id]: found.key_prefix,
                              }));
                            }
                          }}
                        >
                          <option value="">— Select an API key prefix —</option>
                          {keys.map((k) => (
                            <option key={k.id} value={k.id}>
                              {k.name} ({k.key_prefix}...) {k.active ? "" : "[Inactive]"}
                            </option>
                          ))}
                        </select>
                        <span className="text-[11px] text-ink-faint mt-1 block">
                          Shows key name & prefix for convenience.
                        </span>
                      </div>

                      {/* Actual API key input */}
                      <div>
                        <label className="block text-xs font-medium text-ink mb-1">
                          Paste API Key (<code className="font-mono text-pine">x-api-key</code>)
                        </label>
                        <input
                          type="password"
                          placeholder="Paste full 48-char key (e.g. wbk_a3f2...)"
                          className="w-full text-xs font-mono rounded-md border border-line bg-panel px-3 py-2 text-ink focus:border-pine focus:outline-none placeholder:font-sans"
                          value={currentApiKey}
                          onChange={(e) =>
                            setUserApiKeys((prev) => ({ ...prev, [ep.id]: e.target.value }))
                          }
                        />
                        <span className="text-[11px] text-ink-faint mt-1 block">
                          Client-only. Sent directly from your browser to n8n.
                        </span>
                      </div>
                    </div>

                    {/* Editable JSON Request Body */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-ink">
                          Request Body (JSON)
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setTryItBodies((prev) => ({
                              ...prev,
                              [ep.id]: JSON.stringify(ep.requestBody, null, 2),
                            }))
                          }
                          className="text-[11px] text-pine hover:underline"
                        >
                          Reset to default
                        </button>
                      </div>
                      <textarea
                        rows={4}
                        className="w-full text-xs font-mono rounded-md border border-line bg-panel p-3 text-ink focus:border-pine focus:outline-none"
                        value={currentBody}
                        onChange={(e) =>
                          setTryItBodies((prev) => ({ ...prev, [ep.id]: e.target.value }))
                        }
                      />
                    </div>

                    {/* Send button */}
                    <div className="flex items-center justify-between pt-1">
                      <Button
                        variant="primary"
                        disabled={isRunning}
                        onClick={() => runTryIt(ep)}
                        className="text-xs py-2 px-5 flex items-center gap-2 shadow-xs"
                      >
                        {isRunning ? (
                          <>
                            <span className="animate-spin inline-block">⟳</span>
                            <span>Sending Request…</span>
                          </>
                        ) : (
                          <>
                            <span>Send Request</span>
                            <span>→</span>
                          </>
                        )}
                      </Button>

                      {result && (
                        <div className="flex items-center gap-2 text-xs">
                          <Tag
                            tone={
                              result.status === 200
                                ? "good"
                                : result.status >= 500
                                ? "bad"
                                : "warn"
                            }
                          >
                            HTTP {result.status || "ERR"} {result.statusText}
                          </Tag>
                          <span className="text-ink-soft tabular font-mono">
                            {result.timeMs} ms
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Result Panel */}
                    {result && (
                      <div className="space-y-2 pt-2 border-t border-line/50">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-ink">Response:</span>
                          {result.status === 401 && (
                            <span className="text-xs text-amber font-medium">
                              ⚠️ Check your API key. Make sure you entered the full 48-character key and that it is active.
                            </span>
                          )}
                          {result.status === 429 && (
                            <span className="text-xs text-amber font-medium">
                              ⚠️ Rate limit exceeded. Please wait a minute and retry.
                            </span>
                          )}
                        </div>

                        {result.error && (
                          <div className="p-3 bg-[#f8ebe9] border border-brick/30 text-brick text-xs rounded-md">
                            {result.error}
                          </div>
                        )}

                        <div className="bg-[#10231c] text-[#e6f0ea] rounded-lg p-3 text-xs font-mono border border-[#17543a]/40 overflow-x-auto max-h-64 overflow-y-auto">
                          <pre>
                            <code>
                              {result.data
                                ? JSON.stringify(result.data, null, 2)
                                : result.rawText || "(empty response)"}
                            </code>
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Panel>
          );
        })}
      </div>

      {/* ── 4. RESPONSE FIELD REFERENCE (COLLAPSIBLE) ── */}
      <Panel pad={false} className="overflow-hidden">
        <button
          type="button"
          onClick={() => setFieldRefOpen(!fieldRefOpen)}
          className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-canvas/50 transition-colors"
        >
          <div>
            <h3 className="font-semibold text-sm text-ink">Response Field Reference</h3>
            <p className="text-xs text-ink-soft mt-0.5">
              Comprehensive dictionary of fields returned across all API endpoints
            </p>
          </div>
          <span className="text-xs text-ink-faint font-medium">
            {fieldRefOpen ? "Hide reference ▲" : "Show reference ▼"}
          </span>
        </button>

        {fieldRefOpen && (
          <div className="p-5 border-t border-line space-y-6">
            {FIELD_REFERENCE_DATA.map((group) => (
              <div key={group.endpoint} className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-pine">
                  {group.endpoint}
                </h4>
                <div className="overflow-x-auto border border-line rounded-lg">
                  <table className="w-full text-xs">
                    <thead className="bg-canvas/50 border-b border-line text-left text-ink-soft">
                      <tr>
                        <th className="py-2 px-3 font-semibold w-40">Field</th>
                        <th className="py-2 px-3 font-semibold w-36">Type</th>
                        <th className="py-2 px-3 font-semibold">Description</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {group.fields.map((f) => (
                        <tr key={f.name} className="hover:bg-canvas/30">
                          <td className="py-2 px-3 font-mono font-medium text-ink">{f.name}</td>
                          <td className="py-2 px-3 font-mono text-ink-soft text-[11px]">{f.type}</td>
                          <td className="py-2 px-3 text-ink-soft">{f.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ── 5. WEBHOOK DOCS PLACEHOLDER CARD ── */}
      <Panel className="bg-pine-wash/20 border-pine/20">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-pine/10 text-pine flex items-center justify-center shrink-0 mt-0.5 font-bold">
            ⚡
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm text-ink">Webhooks (coming soon)</h4>
              <Tag tone="warn">Under development</Tag>
            </div>
            <p className="text-xs text-ink-soft leading-relaxed">
              Receive real-time notifications when a customer messages, books an appointment or opts out. No polling needed.
              Configure target URLs and HMAC signature secrets on the{" "}
              <button
                type="button"
                onClick={onGoToKeysTab}
                className="text-pine font-medium underline underline-offset-2 hover:text-pine-deep"
              >
                API Keys & Webhooks
              </button>{" "}
              tab.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
