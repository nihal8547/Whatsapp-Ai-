"use client";

import { useState, useEffect, useTransition } from "react";
import { Panel, PageHead, Button, Field, inputClass, Tag, Empty, Toast } from "@/components/ui";

export type CatalogItem = {
  id: number;
  tenant_id: number;
  category_id: number | null;
  kind: string;
  name: string;
  aliases: string[];
  description: string | null;
  price: number | null;
  currency: string;
  unit: string;
  track_stock: boolean;
  stock_qty: number | null;
  available: boolean;
  variants: Array<{ name: string; price: number }>;
  media_id: number | null;
  media_url?: string | null;
  media_title?: string | null;
  sort_order: number;
  active: boolean;
  category_name?: string | null;
};

export type Category = {
  id: number;
  name: string;
  sort_order: number;
  active: boolean;
  item_count?: number;
};

export type MediaOption = {
  id: number;
  title: string;
  url: string;
  category: string;
};

type Props = {
  tenantId: number;
  isOwner: boolean;
  presetKind: string;
  catalogTitle: string;
  itemLabel: string;
  itemsLabel: string;
  initialCategories: Category[];
  mediaList: MediaOption[];
};

export default function CatalogClient({
  tenantId,
  isOwner,
  presetKind,
  catalogTitle,
  itemLabel,
  itemsLabel,
  initialCategories,
  mediaList: initialMediaList,
}: Props) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [categories, setCategories] = useState<Category[]>(initialCategories);
  const [mediaList, setMediaList] = useState<MediaOption[]>(initialMediaList);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [filterAvailable, setFilterAvailable] = useState<string>("all");
  const [filterActive, setFilterActive] = useState<string>("true");

  // Selection for bulk
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Item Drawer (Add / Edit)
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [formData, setFormData] = useState<{
    name: string;
    aliases: string;
    category_id: string;
    kind: string;
    price: string;
    currency: string;
    unit: string;
    track_stock: boolean;
    stock_qty: string;
    available: boolean;
    active: boolean;
    description: string;
    media_id: string;
    variants: Array<{ name: string; price: number }>;
  }>({
    name: "",
    aliases: "",
    category_id: "",
    kind: presetKind,
    price: "",
    currency: "QAR",
    unit: "each",
    track_stock: false,
    stock_qty: "",
    available: true,
    active: true,
    description: "",
    media_id: "",
    variants: [],
  });

  // Category Manager Modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState("");

  // CSV Import Modal
  const [csvModalOpen, setCsvModalOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState<{
    preview?: boolean;
    totalRows?: number;
    validCount?: number;
    rejectedCount?: number;
    rejected?: Array<{ row: number; name?: string; reason: string }>;
  } | null>(null);
  const [csvSubmitting, setCsvSubmitting] = useState(false);

  // Bulk Price Modal
  const [bulkPriceModalOpen, setBulkPriceModalOpen] = useState(false);
  const [bulkPercent, setBulkPercent] = useState<string>("10");

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  }

  async function loadItems() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("q", search);
      if (selectedCat !== "all") params.set("category_id", selectedCat);
      if (filterAvailable !== "all") params.set("available", filterAvailable);
      if (filterActive !== "all") params.set("active", filterActive);

      const res = await fetch(`/api/catalog?${params.toString()}`);
      const data = await res.json();
      if (data.ok) {
        setItems(data.items || []);
      }
    } catch {
      showToast("Failed to load catalog items.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCategories() {
    try {
      const res = await fetch("/api/catalog/categories");
      const data = await res.json();
      if (data.ok) {
        setCategories(data.categories || []);
      }
    } catch {}
  }

  useEffect(() => {
    loadItems();
  }, [search, selectedCat, filterAvailable, filterActive]);

  // Open Drawer for Create
  function handleCreate() {
    setEditingItem(null);
    setFormData({
      name: "",
      aliases: "",
      category_id: categories.length > 0 ? String(categories[0].id) : "",
      kind: presetKind,
      price: "",
      currency: "QAR",
      unit: "each",
      track_stock: false,
      stock_qty: "",
      available: true,
      active: true,
      description: "",
      media_id: "",
      variants: [],
    });
    setDrawerOpen(true);
  }

  // Open Drawer for Edit
  function handleEdit(item: CatalogItem) {
    setEditingItem(item);
    setFormData({
      name: item.name,
      aliases: Array.isArray(item.aliases) ? item.aliases.join(", ") : "",
      category_id: item.category_id ? String(item.category_id) : "",
      kind: item.kind || presetKind,
      price: item.price !== null ? String(item.price) : "",
      currency: item.currency || "QAR",
      unit: item.unit || "each",
      track_stock: Boolean(item.track_stock),
      stock_qty: item.stock_qty !== null ? String(item.stock_qty) : "",
      available: Boolean(item.available),
      active: Boolean(item.active),
      description: item.description || "",
      media_id: item.media_id ? String(item.media_id) : "",
      variants: Array.isArray(item.variants) ? [...item.variants] : [],
    });
    setDrawerOpen(true);
  }

  // Save Item
  async function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!formData.name.trim()) {
      showToast("Please enter an item name.");
      return;
    }

    const payload = {
      name: formData.name.trim(),
      aliases: formData.aliases,
      category_id: formData.category_id ? Number(formData.category_id) : null,
      kind: formData.kind,
      price: formData.price !== "" ? Number(formData.price) : null,
      currency: formData.currency,
      unit: formData.unit,
      track_stock: formData.track_stock,
      stock_qty: formData.stock_qty !== "" ? Number(formData.stock_qty) : null,
      available: formData.available,
      active: formData.active,
      description: formData.description,
      media_id: formData.media_id ? Number(formData.media_id) : null,
      variants: formData.variants,
    };

    try {
      let res;
      if (editingItem) {
        res = await fetch(`/api/catalog/${editingItem.id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/catalog", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const data = await res.json();
      if (!data.ok) {
        showToast(data.message || data.error || "Save failed.");
        return;
      }
      showToast(editingItem ? `${itemLabel} updated.` : `${itemLabel} created.`);
      setDrawerOpen(false);
      loadItems();
    } catch {
      showToast("Error saving item.");
    }
  }

  // Quick toggle available (sold out)
  async function toggleAvailable(item: CatalogItem, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/catalog/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ available: !item.available }),
      });
      const data = await res.json();
      if (data.ok) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, available: !item.available } : i))
        );
        showToast(`${item.name} marked ${!item.available ? "in stock" : "sold out"}.`);
      }
    } catch {
      showToast("Failed to update status.");
    }
  }

  // Quick toggle active (show/hide)
  async function toggleActive(item: CatalogItem, e: React.MouseEvent) {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/catalog/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: !item.active }),
      });
      const data = await res.json();
      if (data.ok) {
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? { ...i, active: !item.active } : i))
        );
        showToast(`${item.name} ${!item.active ? "activated" : "hidden"}.`);
      }
    } catch {
      showToast("Failed to update active state.");
    }
  }

  // Bulk actions
  async function handleBulkSoldOut(available: boolean) {
    if (selectedIds.length === 0) return;
    try {
      const res = await fetch("/api/catalog/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "sold_out", item_ids: selectedIds, available }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Updated ${selectedIds.length} ${itemsLabel.toLowerCase()}.`);
        setSelectedIds([]);
        loadItems();
      }
    } catch {
      showToast("Bulk update failed.");
    }
  }

  async function handleBulkPriceAdjust() {
    const p = Number(bulkPercent);
    if (isNaN(p)) return;
    try {
      const res = await fetch("/api/catalog/bulk", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "adjust_price", item_ids: selectedIds, percent: p }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(`Adjusted prices for ${selectedIds.length} ${itemsLabel.toLowerCase()}.`);
        setBulkPriceModalOpen(false);
        setSelectedIds([]);
        loadItems();
      }
    } catch {
      showToast("Price adjustment failed.");
    }
  }

  // Categories management
  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    try {
      const res = await fetch("/api/catalog/categories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewCatName("");
        loadCategories();
        showToast("Category added.");
      }
    } catch {
      showToast("Failed to add category.");
    }
  }

  async function handleDeleteCategory(id: number) {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      const res = await fetch(`/api/catalog/categories/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        loadCategories();
        showToast("Category deleted.");
      }
    } catch {
      showToast("Failed to delete category.");
    }
  }

  // CSV Import preview & apply
  async function handleCsvPreview() {
    if (!csvText.trim()) return;
    setCsvSubmitting(true);
    try {
      const res = await fetch("/api/catalog/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csvText, preview: true }),
      });
      const data = await res.json();
      if (data.ok) {
        setCsvPreview(data);
      } else {
        showToast(data.message || data.error || "Failed to validate CSV.");
      }
    } catch {
      showToast("Error processing CSV.");
    } finally {
      setCsvSubmitting(false);
    }
  }

  async function handleCsvApply() {
    if (!csvText.trim()) return;
    setCsvSubmitting(true);
    try {
      const res = await fetch("/api/catalog/import", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ csvText, preview: false }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast(data.message || "CSV imported successfully!");
        setCsvModalOpen(false);
        setCsvText("");
        setCsvPreview(null);
        loadItems();
        loadCategories();
      } else {
        showToast(data.message || data.error || "Import failed.");
      }
    } catch {
      showToast("Import request failed.");
    } finally {
      setCsvSubmitting(false);
    }
  }

  // Variants helper
  function addVariant() {
    setFormData((prev) => ({
      ...prev,
      variants: [...prev.variants, { name: "", price: Number(formData.price || 0) }],
    }));
  }

  function updateVariant(idx: number, field: "name" | "price", val: any) {
    setFormData((prev) => {
      const copy = [...prev.variants];
      copy[idx] = { ...copy[idx], [field]: field === "price" ? Number(val) : String(val) };
      return { ...prev, variants: copy };
    });
  }

  function removeVariant(idx: number) {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.filter((_, i) => i !== idx),
    }));
  }

  return (
    <div className="p-6 lg:p-8 max-w-7xl">
      <Toast message={toast} />

      <PageHead
        title={catalogTitle}
        lead={`Manage your ${itemsLabel.toLowerCase()}, pricing, stock levels and categories.`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="quiet" onClick={() => setCatModalOpen(true)}>
              Categories
            </Button>
            {isOwner && (
              <Button variant="quiet" onClick={() => setCsvModalOpen(true)}>
                Import CSV
              </Button>
            )}
            {isOwner && (
              <Button variant="primary" onClick={handleCreate}>
                + Add {itemLabel}
              </Button>
            )}
          </div>
        }
      />

      {/* Filter Toolbar */}
      <div className="bg-panel border border-line rounded-lg p-4 mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={`Search ${itemsLabel.toLowerCase()} by name, aliases, description...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={inputClass}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-2.5 text-xs text-ink-soft hover:text-ink"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            <select
              value={selectedCat}
              onChange={(e) => setSelectedCat(e.target.value)}
              className="rounded-md border border-line bg-panel px-3 py-2 text-sm focus:border-pine focus:outline-none"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={filterAvailable}
              onChange={(e) => setFilterAvailable(e.target.value)}
              className="rounded-md border border-line bg-panel px-3 py-2 text-sm focus:border-pine focus:outline-none"
            >
              <option value="all">Stock: All</option>
              <option value="true">In Stock</option>
              <option value="false">Sold Out</option>
            </select>

            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value)}
              className="rounded-md border border-line bg-panel px-3 py-2 text-sm focus:border-pine focus:outline-none"
            >
              <option value="true">Active only</option>
              <option value="false">Hidden only</option>
              <option value="all">Active & Hidden</option>
            </select>
          </div>
        </div>

        {/* Categories Bar */}
        {categories.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pt-2 border-t border-line/60">
            <button
              onClick={() => setSelectedCat("all")}
              className={`px-2.5 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                selectedCat === "all"
                  ? "bg-pine text-white font-medium"
                  : "bg-canvas text-ink-soft hover:bg-line/40"
              }`}
            >
              All ({items.length})
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCat(String(c.id))}
                className={`px-2.5 py-1 rounded text-xs whitespace-nowrap transition-colors ${
                  selectedCat === String(c.id)
                    ? "bg-pine text-white font-medium"
                    : "bg-canvas text-ink-soft hover:bg-line/40"
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && isOwner && (
        <div className="bg-ink text-white p-3 rounded-lg mb-4 flex items-center justify-between shadow-lg animate-in fade-in duration-150">
          <div className="text-sm font-medium pl-2">
            {selectedIds.length} {itemsLabel.toLowerCase()} selected
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkSoldOut(false)}
              className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-medium"
            >
              Mark Sold Out
            </button>
            <button
              onClick={() => handleBulkSoldOut(true)}
              className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-medium"
            >
              Mark In Stock
            </button>
            <button
              onClick={() => setBulkPriceModalOpen(true)}
              className="px-2.5 py-1 rounded bg-white/10 hover:bg-white/20 text-xs font-medium"
            >
              Adjust Price %
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="px-2 py-1 text-xs text-white/60 hover:text-white"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* Items Table / Cards */}
      <Panel pad={false}>
        {loading ? (
          <div className="p-12 text-center text-sm text-ink-soft">Loading catalog...</div>
        ) : items.length === 0 ? (
          <Empty title={`No ${itemsLabel.toLowerCase()} found`}>
            {search || selectedCat !== "all"
              ? "Try adjusting your search or category filters."
              : `Click "+ Add ${itemLabel}" or "Import CSV" to start adding items.`}
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-line">
              <thead className="bg-canvas/50 text-xs text-ink-soft">
                <tr>
                  {isOwner && (
                    <th className="py-3 px-4 w-10">
                      <input
                        type="checkbox"
                        checked={selectedIds.length > 0 && selectedIds.length === items.length}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(items.map((i) => i.id));
                          else setSelectedIds([]);
                        }}
                      />
                    </th>
                  )}
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Stock</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => isOwner && handleEdit(item)}
                    className="hover:bg-canvas/50 cursor-pointer transition-colors"
                  >
                    {isOwner && (
                      <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(item.id)}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedIds((prev) => [...prev, item.id]);
                            else setSelectedIds((prev) => prev.filter((id) => id !== item.id));
                          }}
                        />
                      </td>
                    )}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {item.media_url ? (
                          <img
                            src={item.media_url}
                            alt={item.name}
                            className="w-10 h-10 rounded-md object-cover border border-line shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-md bg-canvas border border-line flex items-center justify-center text-ink-faint shrink-0 text-xs font-semibold">
                            {item.name.slice(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-medium text-ink truncate">{item.name}</p>
                          {item.aliases && item.aliases.length > 0 && (
                            <p className="text-xs text-ink-soft truncate">
                              aka: {item.aliases.join(", ")}
                            </p>
                          )}
                          {item.description && (
                            <p className="text-xs text-ink-soft line-clamp-1 mt-0.5">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {item.category_name ? (
                        <span className="text-xs bg-canvas border border-line px-2 py-0.5 rounded font-medium text-ink-soft">
                          {item.category_name}
                        </span>
                      ) : (
                        <span className="text-xs text-ink-faint">—</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-semibold tabular">
                        {item.price !== null
                          ? `${item.currency || "QAR"} ${Number(item.price).toFixed(2)}`
                          : "Free / Quote"}
                      </span>
                      <span className="text-xs text-ink-soft ml-1">/ {item.unit || "each"}</span>
                      {Array.isArray(item.variants) && item.variants.length > 0 && (
                        <span className="block text-[11px] text-pine font-medium mt-0.5">
                          {item.variants.length} variant(s)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      {item.track_stock ? (
                        <span
                          className={`text-xs font-medium ${
                            Number(item.stock_qty || 0) <= 0
                              ? "text-brick"
                              : Number(item.stock_qty || 0) < 5
                              ? "text-amber"
                              : "text-ink"
                          }`}
                        >
                          {item.stock_qty ?? 0} in stock
                        </span>
                      ) : (
                        <span className="text-xs text-ink-faint">Untracked</span>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.available ? (
                          <Tag tone="good">Available</Tag>
                        ) : (
                          <Tag tone="warn">Sold Out</Tag>
                        )}
                        {!item.active && <Tag tone="neutral">Hidden</Tag>}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-2">
                        {isOwner && (
                          <button
                            type="button"
                            onClick={(e) => toggleAvailable(item, e)}
                            className="text-xs font-medium px-2 py-1 rounded border border-line hover:bg-canvas text-ink-soft hover:text-ink"
                            title={item.available ? "Mark as sold out" : "Mark as in stock"}
                          >
                            {item.available ? "Mark Sold Out" : "Mark In Stock"}
                          </button>
                        )}
                        {isOwner && (
                          <button
                            type="button"
                            onClick={(e) => toggleActive(item, e)}
                            className="text-xs font-medium px-2 py-1 rounded border border-line hover:bg-canvas text-ink-soft hover:text-ink"
                            title={item.active ? "Hide from bot & catalog" : "Show in catalog"}
                          >
                            {item.active ? "Hide" : "Show"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Item Drawer (Add / Edit) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-panel h-full shadow-2xl flex flex-col border-l border-line animate-in slide-in-from-right duration-200">
            <div className="p-5 border-b border-line flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  {editingItem ? `Edit ${itemLabel}` : `Add New ${itemLabel}`}
                </h2>
                <p className="text-xs text-ink-soft mt-0.5">
                  Configure item specifications, variants, and stock tracking.
                </p>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-ink-soft hover:text-ink text-sm p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-5 flex-1 overflow-y-auto space-y-4">
              <Field label="Item Name" hint="Official name as seen by customers and the AI bot">
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Avocado Toast or Organic Milk"
                  className={inputClass}
                />
              </Field>

              <Field
                label="Aliases (comma-separated)"
                hint="Alternative names, Manglish, Arabic or dialect keywords (e.g. paal, milk, doodh)"
              >
                <input
                  type="text"
                  value={formData.aliases}
                  onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
                  placeholder="e.g. chai, tea, chaya"
                  className={inputClass}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Category">
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">Uncategorized</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Kind">
                  <select
                    value={formData.kind}
                    onChange={(e) => setFormData({ ...formData, kind: e.target.value })}
                    className={inputClass}
                  >
                    <option value="product">Product</option>
                    <option value="dish">Dish</option>
                    <option value="room_type">Room type</option>
                    <option value="package">Package</option>
                    <option value="listing">Listing</option>
                    <option value="course">Course</option>
                    <option value="add_on">Add-on</option>
                  </select>
                </Field>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Field label="Price">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="0.00"
                    className={inputClass}
                  />
                </Field>

                <Field label="Currency">
                  <input
                    type="text"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    className={inputClass}
                  />
                </Field>

                <Field label="Unit">
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className={inputClass}
                  >
                    <option value="each">each</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="litre">litre</option>
                    <option value="ml">ml</option>
                    <option value="dozen">dozen</option>
                    <option value="portion">portion</option>
                    <option value="box">box</option>
                    <option value="hour">hour</option>
                    <option value="night">night</option>
                  </select>
                </Field>
              </div>

              {/* Stock Tracking */}
              <div className="p-3 bg-canvas/60 border border-line rounded-lg space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.track_stock}
                    onChange={(e) => setFormData({ ...formData, track_stock: e.target.checked })}
                    className="rounded text-pine focus:ring-pine"
                  />
                  <span className="text-sm font-medium">Track stock quantity</span>
                </label>

                {formData.track_stock && (
                  <Field label="Current Stock Quantity" hint="Auto-decremented when orders are accepted">
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={formData.stock_qty}
                      onChange={(e) => setFormData({ ...formData, stock_qty: e.target.value })}
                      placeholder="e.g. 50"
                      className={inputClass}
                    />
                  </Field>
                )}
              </div>

              {/* Variants */}
              <div className="p-3 bg-canvas/60 border border-line rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Variants (Sizes, Add-ons)</span>
                  <button
                    type="button"
                    onClick={addVariant}
                    className="text-xs text-pine hover:underline font-medium"
                  >
                    + Add variant
                  </button>
                </div>
                {formData.variants.length === 0 ? (
                  <p className="text-xs text-ink-soft">
                    No variants added. E.g. Small / Large, 500g / 1kg with specific prices.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {formData.variants.map((v, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Variant name (e.g. Large)"
                          value={v.name}
                          onChange={(e) => updateVariant(idx, "name", e.target.value)}
                          className={`${inputClass} flex-1`}
                        />
                        <input
                          type="number"
                          step="0.01"
                          placeholder="Price"
                          value={v.price}
                          onChange={(e) => updateVariant(idx, "price", e.target.value)}
                          className={`${inputClass} w-24`}
                        />
                        <button
                          type="button"
                          onClick={() => removeVariant(idx)}
                          className="text-xs text-brick p-1 hover:bg-brick/10 rounded"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Field label="Description">
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Ingredients, preparation, portion details..."
                  className={inputClass}
                />
              </Field>

              {/* Photo Picker */}
              <Field label="Photo (from Media Library)" hint="Displayed when bot shares catalog items">
                <select
                  value={formData.media_id}
                  onChange={(e) => setFormData({ ...formData, media_id: e.target.value })}
                  className={inputClass}
                >
                  <option value="">No photo selected</option>
                  {mediaList.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.category})
                    </option>
                  ))}
                </select>
                {formData.media_id && (
                  <div className="mt-2 flex items-center gap-2">
                    {mediaList.find((m) => String(m.id) === formData.media_id)?.url && (
                      <img
                        src={mediaList.find((m) => String(m.id) === formData.media_id)!.url}
                        alt="Preview"
                        className="w-16 h-16 rounded object-cover border border-line"
                      />
                    )}
                    <span className="text-xs text-ink-soft">
                      {mediaList.find((m) => String(m.id) === formData.media_id)?.title}
                    </span>
                  </div>
                )}
              </Field>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.available}
                    onChange={(e) => setFormData({ ...formData, available: e.target.checked })}
                    className="rounded text-pine focus:ring-pine"
                  />
                  <span className="text-sm font-medium">Available (in stock)</span>
                </label>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.active}
                    onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    className="rounded text-pine focus:ring-pine"
                  />
                  <span className="text-sm font-medium">Active (visible)</span>
                </label>
              </div>

              <div className="pt-4 border-t border-line flex items-center justify-between">
                <Button variant="quiet" type="button" onClick={() => setDrawerOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  {editingItem ? "Save Changes" : `Create ${itemLabel}`}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Categories Modal */}
      {catModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-panel rounded-xl border border-line shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="font-semibold text-base">Manage Categories</h3>
              <button
                onClick={() => setCatModalOpen(false)}
                className="text-ink-soft hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="New category name..."
                value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                className={`${inputClass} flex-1`}
              />
              <Button variant="primary" onClick={handleAddCategory}>
                Add
              </Button>
            </div>

            <div className="max-h-60 overflow-y-auto divide-y divide-line border border-line rounded-lg">
              {categories.length === 0 ? (
                <div className="p-4 text-center text-xs text-ink-soft">No categories yet.</div>
              ) : (
                categories.map((c) => (
                  <div key={c.id} className="p-2.5 flex items-center justify-between text-sm">
                    <span className="font-medium text-ink">{c.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-soft tabular">
                        {c.item_count ?? 0} items
                      </span>
                      {isOwner && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(c.id)}
                          className="text-xs text-brick hover:underline p-1"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button variant="quiet" onClick={() => setCatModalOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Modal */}
      {csvModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-panel rounded-xl border border-line shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-semibold text-base">Import {itemsLabel} from CSV</h3>
                <p className="text-xs text-ink-soft mt-0.5">
                  Columns: category, name, aliases, description, price, unit, stock, available.
                </p>
              </div>
              <button
                onClick={() => {
                  setCsvModalOpen(false);
                  setCsvPreview(null);
                }}
                className="text-ink-soft hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center justify-between text-xs bg-canvas/70 p-3 rounded-lg border border-line">
              <span className="text-ink-soft">
                Upserts by item name. Max 5,000 items per tenant.
              </span>
              <a
                href="/api/catalog/import"
                download="catalog_sample.csv"
                className="text-pine font-medium hover:underline inline-flex items-center gap-1"
              >
                📥 Download sample CSV
              </a>
            </div>

            <div className="flex-1 min-h-[140px] flex flex-col">
              <label className="text-xs font-semibold text-ink-soft mb-1">
                Paste CSV content or upload file:
              </label>
              <textarea
                value={csvText}
                onChange={(e) => setCsvText(e.target.value)}
                placeholder="category,name,aliases,description,price,unit,stock,available&#10;Fruits,Fresh Red Apples,apple,Crisp sweet apples,12.50,kg,100,true"
                rows={6}
                className={`${inputClass} font-mono text-xs flex-1`}
              />
              <div className="mt-2">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (evt) => {
                        setCsvText(String(evt.target?.result || ""));
                      };
                      reader.readAsText(file);
                    }
                  }}
                  className="text-xs text-ink-soft file:mr-2 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-pine file:text-white hover:file:bg-pine-deep"
                />
              </div>
            </div>

            {/* Validation & Preview Report */}
            {csvPreview && (
              <div className="p-3 bg-canvas border border-line rounded-lg text-xs space-y-2 max-h-40 overflow-y-auto">
                <div className="flex items-center gap-4 font-semibold">
                  <span className="text-pine">✓ Valid: {csvPreview.validCount}</span>
                  <span className="text-brick">✕ Rejected: {csvPreview.rejectedCount}</span>
                  <span className="text-ink-soft">Total: {csvPreview.totalRows}</span>
                </div>

                {csvPreview.rejected && csvPreview.rejected.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-line">
                    <p className="font-semibold text-brick">Rejection details:</p>
                    {csvPreview.rejected.map((r, i) => (
                      <p key={i} className="text-brick">
                        Row {r.row} {r.name ? `("${r.name}")` : ""}: {r.reason}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t border-line">
              <Button
                variant="quiet"
                onClick={() => {
                  setCsvModalOpen(false);
                  setCsvPreview(null);
                }}
              >
                Cancel
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  variant="quiet"
                  disabled={!csvText.trim() || csvSubmitting}
                  onClick={handleCsvPreview}
                >
                  {csvSubmitting ? "Checking..." : "Preview & Validate"}
                </Button>
                <Button
                  variant="primary"
                  disabled={!csvText.trim() || csvSubmitting}
                  onClick={handleCsvApply}
                >
                  {csvSubmitting ? "Importing..." : "Import Now"}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Price Adjustment Modal */}
      {bulkPriceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-panel rounded-xl border border-line shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-line pb-2">
              <h3 className="font-semibold text-base">Adjust Price by %</h3>
              <button
                onClick={() => setBulkPriceModalOpen(false)}
                className="text-ink-soft hover:text-ink text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-ink-soft">
              Change prices for {selectedIds.length} selected items. Use positive percentage to
              increase (e.g. 10) or negative to decrease (e.g. -5).
            </p>

            <Field label="Percentage change (%)">
              <input
                type="number"
                step="0.5"
                value={bulkPercent}
                onChange={(e) => setBulkPercent(e.target.value)}
                placeholder="10"
                className={inputClass}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="quiet" onClick={() => setBulkPriceModalOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={handleBulkPriceAdjust}>
                Apply Price Change
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
