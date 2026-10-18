import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { q } from "@/lib/db";
import { Panel, PageHead, Tag, Empty, Button } from "@/components/ui";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; consent?: string }>;
}) {
  const { tenantId, session } = await requireTenant();
  const sp = await searchParams;
  const search = (sp.search || "").trim();
  const consent = (sp.consent || "").trim();

  const isOwner = session.role === "owner" || session.superAdmin;

  const contacts = await q(
    `SELECT c.phone, COALESCE(NULLIF(c.name,''),'') AS name, c.needs_human, c.bot_enabled,
            c.last_message_at, COALESCE(um.summary,'') AS summary,
            c.lead_source, c.first_ad_title,
            c.consent_status, c.consent_source, c.consent_at, c.opted_out_at,
            (SELECT count(*) FROM wa_appointments a
              WHERE a.tenant_id = c.tenant_id AND a.phone = c.phone AND a.status = 'confirmed') AS bookings
       FROM wa_contacts c
       LEFT JOIN wa_user_memory um ON um.tenant_id = c.tenant_id AND um.phone = c.phone
      WHERE c.tenant_id = $1
        AND ($2 = '' OR c.phone ILIKE '%' || $2 || '%' OR COALESCE(c.name,'') ILIKE '%' || $2 || '%')
        AND ($3 = '' OR c.consent_status = $3)
      ORDER BY c.last_message_at DESC NULLS LAST LIMIT 200`,
    [tenantId, search, consent]
  );

  const consentFilters = [
    { label: "All", value: "" },
    { label: "Opted In", value: "opted_in" },
    { label: "Opted Out", value: "opted_out" },
    { label: "Unknown", value: "unknown" },
  ];

  const exportUrl = `/api/contacts/export?search=${encodeURIComponent(search)}&consent=${encodeURIComponent(consent)}`;

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <PageHead
        title="Contacts"
        lead="Everyone who has messaged or opted-in to your business number."
        action={
          <div className="flex items-center gap-2">
            <a href={exportUrl} download>
              <Button variant="quiet">Export CSV</Button>
            </a>
            {isOwner && (
              <Link href="/contacts/import">
                <Button>Import Contacts</Button>
              </Link>
            )}
          </div>
        }
      />

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <form className="flex-1 max-w-sm">
          <input
            name="search"
            defaultValue={search}
            placeholder="Search name or number"
            className="w-full rounded-md border border-line bg-panel px-3 py-2 text-sm focus:border-pine focus:outline-none"
          />
          {consent && <input type="hidden" name="consent" value={consent} />}
        </form>

        {/* Consent filter tabs */}
        <div className="flex items-center bg-panel border border-line rounded-lg p-1 gap-1 text-xs font-medium">
          {consentFilters.map((f) => {
            const active = consent === f.value;
            const query = new URLSearchParams();
            if (search) query.set("search", search);
            if (f.value) query.set("consent", f.value);
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

      {contacts.length === 0 ? (
        <Panel>
          <Empty title={search || consent ? "No matching contacts" : "No contacts yet"}>
            {search || consent
              ? "Try adjusting your search terms or consent status filter."
              : "Contacts appear after their first message or when imported."}
          </Empty>
        </Panel>
      ) : (
        <Panel pad={false}>
          <ul className="divide-y divide-line">
            {contacts.map((c) => {
              const consentTone =
                c.consent_status === "opted_in"
                  ? "good"
                  : c.consent_status === "opted_out"
                  ? "bad"
                  : "neutral";

              const consentLabel =
                c.consent_status === "opted_in"
                  ? "Opted in"
                  : c.consent_status === "opted_out"
                  ? "Opted out"
                  : "Unknown";

              return (
                <li key={c.phone}>
                  <Link href={`/chats?phone=${c.phone}`} className="block px-5 py-4 hover:bg-canvas transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-ink">{c.name || "Unknown"}</p>
                          <Tag tone={consentTone}>{consentLabel}</Tag>
                          {c.lead_source === "ad" && (
                            <Tag tone="good">From ad: {c.first_ad_title || "Ad"}</Tag>
                          )}
                          {c.needs_human && <Tag tone="warn">Wants a person</Tag>}
                          {!c.bot_enabled && !c.needs_human && <Tag tone="neutral">Assistant off</Tag>}
                        </div>
                        <p className="text-sm text-ink-soft tabular mt-0.5">+{c.phone}</p>
                        {c.summary && (
                          <p className="text-sm text-ink-soft mt-1 line-clamp-2">{c.summary}</p>
                        )}
                        {c.consent_source && (
                          <p className="text-xs text-ink-faint mt-1">
                            Consent source: <span className="capitalize">{c.consent_source.replace(/_/g, " ")}</span>
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-ink-faint tabular">{timeAgo(c.last_message_at)}</p>
                        {Number(c.bookings) > 0 && (
                          <p className="text-xs text-ink-soft mt-1">
                            {c.bookings} booking{Number(c.bookings) > 1 ? "s" : ""}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </div>
  );
}
