import Link from "next/link";
import { requireTenant } from "@/lib/auth";
import { q } from "@/lib/db";
import { Panel, PageHead, Tag, Empty } from "@/components/ui";
import { timeAgo } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string }>;
}) {
  const { tenantId } = await requireTenant();
  const sp = await searchParams;
  const search = (sp.search || "").trim();

  const contacts = await q(
    `SELECT c.phone, COALESCE(NULLIF(c.name,''),'') AS name, c.needs_human, c.bot_enabled,
            c.last_message_at, COALESCE(um.summary,'') AS summary,
            (SELECT count(*) FROM wa_appointments a
              WHERE a.tenant_id = c.tenant_id AND a.phone = c.phone AND a.status = 'confirmed') AS bookings
       FROM wa_contacts c
       LEFT JOIN wa_user_memory um ON um.tenant_id = c.tenant_id AND um.phone = c.phone
      WHERE c.tenant_id = $1
        AND ($2 = '' OR c.phone ILIKE '%' || $2 || '%' OR COALESCE(c.name,'') ILIKE '%' || $2 || '%')
      ORDER BY c.last_message_at DESC NULLS LAST LIMIT 200`,
    [tenantId, search]
  );

  return (
    <div className="p-6 lg:p-8 max-w-4xl">
      <PageHead title="Contacts" lead="Everyone who has messaged your number." />

      <form className="mb-4">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search name or number"
          className="w-full max-w-sm rounded-md border border-line bg-panel px-3 py-2 text-sm focus:border-pine focus:outline-none"
        />
      </form>

      {contacts.length === 0 ? (
        <Panel>
          <Empty title={search ? "Nobody matches that" : "No contacts yet"}>
            {search ? "Try a different name or number." : "Contacts appear after the first message."}
          </Empty>
        </Panel>
      ) : (
        <Panel pad={false}>
          <ul className="divide-y divide-line">
            {contacts.map((c) => (
              <li key={c.phone}>
                <Link href={`/chats?phone=${c.phone}`} className="block px-5 py-4 hover:bg-canvas">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{c.name || "Unknown"}</p>
                        {c.needs_human && <Tag tone="warn">Wants a person</Tag>}
                        {!c.bot_enabled && !c.needs_human && <Tag tone="neutral">Assistant off</Tag>}
                      </div>
                      <p className="text-sm text-ink-soft tabular">+{c.phone}</p>
                      {c.summary && (
                        <p className="text-sm text-ink-soft mt-1 line-clamp-2">{c.summary}</p>
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
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
