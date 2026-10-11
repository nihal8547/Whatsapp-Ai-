import { requireTenant } from "@/lib/auth";
import { q, one } from "@/lib/db";
import { getTenantConfig, tLabel } from "@/lib/packs";
import CatalogClient from "./catalog-client";

export const dynamic = "force-dynamic";

export default async function CatalogPage() {
  const { tenantId, session } = await requireTenant();
  const config = await getTenantConfig(tenantId);
  const { labels, pack } = config;

  // Preset kind based on pack
  const kindPresets: Record<string, string> = {
    restaurant: "dish",
    hotel: "room_type",
    it_agency: "package",
    education: "course",
    real_estate: "listing",
    grocery: "product",
    retail: "product",
  };
  const presetKind = kindPresets[pack.code] || "product";

  // Catalog title from labels
  const catalogTitle = tLabel(labels, "catalog", "Catalog");
  const itemLabel = tLabel(labels, "item", "Item");
  const itemsLabel = tLabel(labels, "items", "Items");

  // Get categories
  const categories = await q(
    `SELECT id, name, sort_order, active
       FROM wa_catalog_categories
      WHERE tenant_id = $1
      ORDER BY sort_order ASC, name ASC`,
    [tenantId]
  );

  // Get media for picker
  const ps = await one<{ dashboard_url: string }>(
    `SELECT dashboard_url FROM wa_platform_settings WHERE id = 1`
  );
  const baseUrl = (ps?.dashboard_url ?? "").replace(/\/$/, "");

  const mediaRows = await q(
    `SELECT id, title, public_token, category, mime_type
       FROM wa_media
      WHERE tenant_id = $1 AND active = true
      ORDER BY created_at DESC
      LIMIT 100`,
    [tenantId]
  );

  const mediaList = mediaRows.map((m) => ({
    id: m.id,
    title: m.title,
    url: `${baseUrl}/media/${m.public_token}`,
    category: m.category,
  }));

  const isOwner = session.role === "owner" || session.superAdmin;

  return (
    <CatalogClient
      tenantId={tenantId}
      isOwner={isOwner}
      presetKind={presetKind}
      catalogTitle={catalogTitle}
      itemLabel={itemLabel}
      itemsLabel={itemsLabel}
      initialCategories={categories}
      mediaList={mediaList}
    />
  );
}
