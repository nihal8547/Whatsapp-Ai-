import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { q } from "@/lib/db";
import { Panel, PageHead, Empty, Button } from "@/components/ui";
import ContactsList, { ContactItem } from "./contacts-list";
import { INTENT_VALUES, INTENT_CONFIG } from "@/lib/followups";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; consent?: string; intent?: string }>;
}) {
  const { tenantId, session } = await requireTenant();
  const sp = await searchParams;
  const search = (sp.search || "").trim();
  const consent = (sp.consent || "").trim();
  const intent = (sp.intent || "").trim();

  const isOwner = session.role === "owner" || session.superAdmin;

  const contacts = await q<ContactItem>(
    `SELECT c.phone, COALESCE(NULLIF(c.name,''),'') AS name, c.needs_human, c.bot_enabled,
            c.last_message_at, COALESCE(um.summary,'') AS summary,
            c.lead_source, c.first_ad_title,
            c.consent_status, c.consent_source, c.consent_at, c.opted_out_at,
            COALESCE(c.attributes, '{}'::jsonb) AS attributes,
            COALESCE(c.intent, 'unknown') AS intent,
            COALESCE(c.lead_stage, 'none') AS lead_stage,
            c.interest_topic,
            c.quote_summary,
            c.intent_updated_at,
            COALESCE(c.intent_locked, false) AS intent_locked,
            (SELECT count(*) FROM wa_appointments a
              WHERE a.tenant_id = c.tenant_id AND a.phone = c.phone AND a.status = 'confirmed') AS bookings
       FROM wa_contacts c
       LEFT JOIN wa_user_memory um ON um.tenant_id = c.tenant_id AND um.phone = c.phone
      WHERE c.tenant_id = $1
        AND ($2 = '' OR c.phone ILIKE '%' || $2 || '%' OR COALESCE(c.name,'') ILIKE '%' || $2 || '%')
        AND ($3 = '' OR c.consent_status = $3)
        AND ($4 = '' OR c.intent = $4)
      ORDER BY c.last_message_at DESC NULLS LAST LIMIT 200`,
    [tenantId, search, consent, intent]
  );

  const consentFilters = [
    { label: "All Consent", value: "" },
    { label: "Opted In", value: "opted_in" },
    { label: "Opted Out", value: "opted_out" },
    { label: "Unknown", value: "unknown" },
  ];

  const intentFilters = [
    { label: "All Intents", value: "" },
    ...INTENT_VALUES.map((v) => ({ label: INTENT_CONFIG[v].label, value: v })),
  ];

  const exportUrl = `/api/contacts/export?search=${encodeURIComponent(search)}&consent=${encodeURIComponent(consent)}`;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <PageHead
        title="Contacts"
        lead="Everyone who has messaged or opted-in to your business number."
        action={
          <div className="flex items-center gap-2">
            <Link href="/followups">
              <Button variant="quiet" className="border-pine/30 text-pine font-medium">
                🎯 Next follow-ups
              </Button>
            </Link>
            <a href={exportUrl} download>
              <Button variant="quiet">Export CSV</Button>
            </a>
            {isOwner && (
              <>
                <Link href="/data">
                  <Button variant="quiet">Data files</Button>
                </Link>
                <Link href="/contacts/import">
                  <Button>Import Contacts</Button>
                </Link>
              </>
            )}
          </div>
        }
      />

      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <form className="flex-1 max-w-sm">
            <input
              name="search"
              defaultValue={search}
              placeholder="Search name or number"
              className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm focus:border-pine focus:outline-none"
            />
            {consent && <input type="hidden" name="consent" value={consent} />}
            {intent && <input type="hidden" name="intent" value={intent} />}
          </form>

          {/* Consent filter tabs */}
          <div className="flex items-center bg-panel border border-line rounded-lg p-1 gap-1 text-xs font-medium">
            {consentFilters.map((f) => {
              const active = consent === f.value;
              const query = new URLSearchParams();
              if (search) query.set("search", search);
              if (f.value) query.set("consent", f.value);
              if (intent) query.set("intent", intent);
              const href = `/contacts${query.toString() ? `?${query.toString()}` : ""}`;

              return (
                <Link
                  key={f.value}
                  href={href}
                  className={`px-3 py-1.5 rounded-md transition-colors ${
                    active
                      ? "bg-pine text-white"
                      : "text-ink-soft hover:text-ink hover:bg-canvas"
                  }`}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Intent filter tabs */}
        <div className="flex flex-wrap items-center bg-panel border border-line rounded-lg p-1 gap-1 text-xs font-medium">
          <span className="text-[11px] font-semibold text-ink-faint px-2 uppercase tracking-wider">
            Intent:
          </span>
          {intentFilters.map((f) => {
            const active = intent === f.value;
            const query = new URLSearchParams();
            if (search) query.set("search", search);
            if (consent) query.set("consent", consent);
            if (f.value) query.set("intent", f.value);
            const href = `/contacts${query.toString() ? `?${query.toString()}` : ""}`;

            return (
              <Link
                key={f.value}
                href={href}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  active
                    ? "bg-pine text-white"
                    : "text-ink-soft hover:text-ink hover:bg-canvas"
                }`}
              >
                {f.label}
              </Link>
            );
          })}
        </div>
      </div>

      {contacts.length === 0 ? (
        <Panel>
          <Empty
            title={
              search || consent || intent ? "No matching contacts" : "No contacts yet"
            }
          >
            {search || consent || intent
              ? "Try adjusting your search terms or filter selections."
              : "Contacts appear after their first message or when imported."}
          </Empty>
        </Panel>
      ) : (
        <Panel pad={false}>
          <ContactsList initialContacts={contacts} />
        </Panel>
      )}
    </div>
  );
}

