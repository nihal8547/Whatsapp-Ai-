"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Panel, PageHead, Button, Field, inputClass, Tag, Empty, Toast } from "@/components/ui";

export type OrderItem = {
  id: number;
  item_id: number | null;
  name: string;
  variant: string;
  qty: number;
  unit_price: number;
  line_total: number;
  notes: string | null;
};

export type Order = {
  id: number;
  tenant_id: number;
  phone: string;
  order_no: string;
  status: "pending" | "accepted" | "preparing" | "ready" | "out_for_delivery" | "completed" | "cancelled" | "rejected";
  fulfilment: "pickup" | "delivery" | "dine_in" | null;
  address_text: string | null;
  zone_id: number | null;
  zone_name?: string | null;
  payment_method: string;
  payment_status: "unpaid" | "paid" | "refunded";
  subtotal: number;
  delivery_fee: number;
  discount: number;
  total: number;
  currency: string;
  customer_name: string | null;
  contact_name?: string | null;
  notes: string | null;
  staff_notes: string | null;
  cancel_reason: string | null;
  tracking_ref: string | null;
  placed_at: string | null;
  created_at: string;
  items: OrderItem[];
};

type Props = {
  tenantId: number;
  isOwner: boolean;
  orderLabel: string;
  ordersLabel: string;
  companyName?: string;
};

const COLUMNS: Array<{ id: Order["status"]; title: string; tone: "warn" | "neutral" | "good" }> = [
  { id: "pending", title: "New", tone: "warn" },
  { id: "accepted", title: "Accepted", tone: "neutral" },
  { id: "preparing", title: "Preparing", tone: "neutral" },
  { id: "ready", title: "Ready", tone: "good" },
  { id: "out_for_delivery", title: "Out for Delivery", tone: "good" },
  { id: "completed", title: "Completed (24h)", tone: "good" },
];

export default function OrdersClient({ tenantId, isOwner, orderLabel, ordersLabel, companyName }: Props) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"board" | "cancelled" | "rejected">("board");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Transitions & notes
  const [actionLoading, setActionLoading] = useState(false);
  const [messageWarning, setMessageWarning] = useState<string | null>(null);
  const [reasonModal, setReasonModal] = useState<{ open: boolean; targetStatus: "rejected" | "cancelled" }>({
    open: false,
    targetStatus: "cancelled",
  });
  const [reasonText, setReasonText] = useState("");

  // Edit staff note & tracking ref in drawer
  const [staffNoteInput, setStaffNoteInput] = useState("");
  const [trackingRefInput, setTrackingRefInput] = useState("");

  // Print ticket modal
  const [printOrder, setPrintOrder] = useState<Order | null>(null);

  // New order modal
  const [newOrderModalOpen, setNewOrderModalOpen] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState({
    phone: "",
    customer_name: "",
    fulfilment: "delivery" as "delivery" | "pickup",
    address_text: "",
    items_summary: "",
    total: "",
    notes: "",
  });
  const [createLoading, setCreateLoading] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }

  async function handleCreateOrder(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrderForm.phone.trim()) {
      showToast("Phone number is required");
      return;
    }
    if (!newOrderForm.items_summary.trim()) {
      showToast("Items description is required");
      return;
    }
    setCreateLoading(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          phone: newOrderForm.phone,
          customer_name: newOrderForm.customer_name,
          fulfilment: newOrderForm.fulfilment,
          address_text: newOrderForm.address_text,
          notes: newOrderForm.notes,
          total: Number(newOrderForm.total) || 0,
          items: [
            {
              name: newOrderForm.items_summary,
              qty: 1,
              unit_price: Number(newOrderForm.total) || 0,
              line_total: Number(newOrderForm.total) || 0,
              notes: newOrderForm.address_text || null,
            },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        showToast(data.error || "Failed to create order");
        setCreateLoading(false);
        return;
      }
      showToast(`Order #${data.order.order_no} created successfully.`);
      setNewOrderModalOpen(false);
      setNewOrderForm({
        phone: "",
        customer_name: "",
        fulfilment: "delivery",
        address_text: "",
        items_summary: "",
        total: "",
        notes: "",
      });
      loadOrders();
    } catch {
      showToast("Error creating order.");
    } finally {
      setCreateLoading(false);
    }
  }

  async function loadOrders() {
    try {
      const res = await fetch("/api/orders");
      const data = await res.json();
      if (data.ok) {
        setOrders(data.orders || []);
        // Update selected order if open
        if (selectedOrder) {
          const fresh = (data.orders || []).find((o: Order) => o.id === selectedOrder.id);
          if (fresh) setSelectedOrder(fresh);
        }
      }
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
    const interval = setInterval(loadOrders, 8000);
    return () => clearInterval(interval);
  }, [selectedOrder?.id]);

  useEffect(() => {
    if (selectedOrder) {
      setStaffNoteInput(selectedOrder.staff_notes || "");
      setTrackingRefInput(selectedOrder.tracking_ref || "");
      setMessageWarning(null);
    }
  }, [selectedOrder]);

  function getMinutesSince(dateStr?: string | null): number {
    if (!dateStr) return 0;
    const diffMs = Date.now() - new Date(dateStr).getTime();
    return Math.floor(diffMs / 60000);
  }

  // Handle status transition
  async function handleTransition(nextStatus: Order["status"], reason?: string) {
    if (!selectedOrder) return;
    setActionLoading(true);
    setMessageWarning(null);

    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/transition`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus, reason }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        showToast(data.message || data.error || "Transition rejected.");
        setActionLoading(false);
        return;
      }

      showToast(`Order #${selectedOrder.order_no} moved to ${nextStatus}.`);

      if (data.messageSent === false) {
        setMessageWarning("Customer WhatsApp notification could not be sent.");
      }

      setReasonModal({ open: false, targetStatus: "cancelled" });
      setReasonText("");
      loadOrders();
    } catch {
      showToast("Network error executing transition.");
    } finally {
      setActionLoading(false);
    }
  }

  // Resend WhatsApp message
  async function handleResendMessage() {
    if (!selectedOrder) return;
    setActionLoading(true);
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}/resend-message`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setMessageWarning(null);
        showToast("WhatsApp notification dispatched successfully.");
      } else {
        showToast("Retry failed: " + (data.error || "could not send"));
      }
    } catch {
      showToast("Retry failed.");
    } finally {
      setActionLoading(false);
    }
  }

  // Save staff notes or tracking ref
  async function handleSaveNotes() {
    if (!selectedOrder) return;
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          staff_notes: staffNoteInput,
          tracking_ref: trackingRefInput,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("Staff notes saved.");
        loadOrders();
      }
    } catch {
      showToast("Failed to save notes.");
    }
  }

  // Mark paid
  async function handleMarkPaid() {
    if (!selectedOrder) return;
    try {
      const res = await fetch(`/api/orders/${selectedOrder.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ payment_status: "paid" }),
      });
      const data = await res.json();
      if (data.ok) {
        showToast("Order marked as paid.");
        loadOrders();
      }
    } catch {
      showToast("Failed to update payment status.");
    }
  }

  // Filter orders
  const boardOrders = orders.filter((o) => {
    if (o.status === "cancelled" || o.status === "rejected") return false;
    if (o.status === "completed") {
      const hours = (Date.now() - new Date(o.placed_at || o.created_at).getTime()) / 3600000;
      return hours <= 24;
    }
    return true;
  });

  const cancelledOrders = orders.filter((o) => o.status === "cancelled");
  const rejectedOrders = orders.filter((o) => o.status === "rejected");

  return (
    <div className="p-6 lg:p-8 max-w-[1600px]">
      <Toast message={toast} />

      <PageHead
        title={ordersLabel}
        lead="Live operational order processing board with customer WhatsApp automation."
        action={
          <div className="flex items-center gap-2">
            <Button variant="primary" onClick={() => setNewOrderModalOpen(true)}>
              + New Order
            </Button>
            {isOwner && (
              <Link href="/orders/settings">
                <Button variant="quiet">Order Settings</Button>
              </Link>
            )}
            <Button variant="quiet" onClick={loadOrders}>
              ↻ Refresh
            </Button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-line mb-6">
        <button
          onClick={() => setActiveTab("board")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "board"
              ? "border-pine text-pine font-semibold"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          Live Board ({boardOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("cancelled")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "cancelled"
              ? "border-pine text-pine font-semibold"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          Cancelled ({cancelledOrders.length})
        </button>
        <button
          onClick={() => setActiveTab("rejected")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "rejected"
              ? "border-pine text-pine font-semibold"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          Rejected ({rejectedOrders.length})
        </button>
      </div>

      {loading ? (
        <div className="p-16 text-center text-sm text-ink-soft">Loading orders board...</div>
      ) : activeTab === "board" ? (
        /* Kanban Board Columns */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-start">
          {COLUMNS.map((col) => {
            const colOrders = boardOrders.filter((o) => o.status === col.id);
            return (
              <div
                key={col.id}
                className="bg-canvas/50 border border-line rounded-xl flex flex-col min-h-[500px]"
              >
                {/* Column Header */}
                <div className="p-3 border-b border-line flex items-center justify-between bg-panel rounded-t-xl">
                  <span className="font-semibold text-xs tracking-tight text-ink uppercase">
                    {col.title}
                  </span>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-canvas text-ink-soft border border-line tabular">
                    {colOrders.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="p-2 space-y-2.5 flex-1 overflow-y-auto">
                  {colOrders.length === 0 ? (
                    <div className="p-6 text-center text-xs text-ink-faint">No orders</div>
                  ) : (
                    colOrders.map((order) => {
                      const mins = getMinutesSince(order.placed_at || order.created_at);
                      const isOverdueNew = order.status === "pending" && mins >= 10;

                      return (
                        <div
                          key={order.id}
                          onClick={() => setSelectedOrder(order)}
                          className={`p-3.5 bg-panel border rounded-lg shadow-2xs hover:shadow-sm cursor-pointer transition-all ${
                            isOverdueNew
                              ? "border-brick/60 bg-[#fff8f7] ring-1 ring-brick/30"
                              : "border-line hover:border-pine/50"
                          }`}
                        >
                          {/* Card Top: Order No & Timer */}
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-bold text-xs text-ink font-mono">
                              #{order.order_no}
                            </span>
                            <span
                              className={`text-[11px] font-semibold tabular ${
                                isOverdueNew
                                  ? "text-brick animate-pulse"
                                  : mins >= 20
                                  ? "text-amber"
                                  : "text-ink-soft"
                              }`}
                            >
                              ⏱ {mins}m ago
                            </span>
                          </div>

                          {/* Customer Name & Phone */}
                          <div className="mt-1">
                            <p className="text-xs font-semibold text-ink truncate">
                              {order.customer_name || order.contact_name || "Unknown"}
                            </p>
                            <p className="text-[11px] text-ink-soft font-mono truncate">
                              {order.phone}
                            </p>
                          </div>

                          {/* Compact Items Summary */}
                          <div className="mt-2 text-[11px] text-ink-soft line-clamp-2 bg-canvas/70 p-1.5 rounded border border-line/60">
                            {order.items && order.items.length > 0
                              ? order.items
                                  .map((it) => `${Number(it.qty)}x ${it.name}${it.variant ? ` (${it.variant})` : ""}`)
                                  .join(", ")
                              : "No items"}
                          </div>

                          {/* Fulfilment & Payment */}
                          <div className="mt-2 flex items-center justify-between gap-1 text-[11px]">
                            <span
                              className={`px-1.5 py-0.5 rounded font-medium ${
                                order.fulfilment === "delivery"
                                  ? "bg-sky-50 text-sky-700 border border-sky-200"
                                  : "bg-amber-wash text-amber border border-amber/30"
                              }`}
                            >
                              {order.fulfilment === "delivery" ? "🚗 Delivery" : "🛍 Pickup"}
                            </span>

                            <span
                              className={`px-1.5 py-0.5 rounded font-medium ${
                                order.payment_status === "paid"
                                  ? "bg-pine-wash text-pine"
                                  : "text-ink-soft"
                              }`}
                            >
                              {order.payment_status === "paid" ? "✓ Paid" : "Unpaid"}
                            </span>
                          </div>

                          {/* Total */}
                          <div className="mt-2 pt-2 border-t border-line/60 flex items-center justify-between">
                            <span className="text-[10px] text-ink-faint uppercase font-medium">
                              {order.payment_method?.toUpperCase()}
                            </span>
                            <span className="font-bold text-xs text-ink tabular">
                              {order.currency} {Number(order.total).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Cancelled or Rejected List Table */
        <Panel pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm divide-y divide-line">
              <thead className="bg-canvas/50 text-xs text-ink-soft">
                <tr>
                  <th className="py-3 px-4">Order #</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Items</th>
                  <th className="py-3 px-4">Total</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(activeTab === "cancelled" ? cancelledOrders : rejectedOrders).length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-xs text-ink-soft">
                      No {activeTab} orders.
                    </td>
                  </tr>
                ) : (
                  (activeTab === "cancelled" ? cancelledOrders : rejectedOrders).map((order) => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className="hover:bg-canvas/50 cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono font-semibold">#{order.order_no}</td>
                      <td className="py-3 px-4">
                        <p className="font-medium">{order.customer_name || "Unknown"}</p>
                        <p className="text-xs text-ink-soft">{order.phone}</p>
                      </td>
                      <td className="py-3 px-4 text-xs text-ink-soft">
                        {order.items?.map((it) => `${Number(it.qty)}x ${it.name}`).join(", ")}
                      </td>
                      <td className="py-3 px-4 font-semibold tabular">
                        {order.currency} {Number(order.total).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-xs text-brick">
                        {order.cancel_reason || "None recorded"}
                      </td>
                      <td className="py-3 px-4 text-xs text-ink-soft">
                        {new Date(order.placed_at || order.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      {/* Order Detail Drawer */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-2xl bg-panel h-full shadow-2xl flex flex-col border-l border-line animate-in slide-in-from-right duration-200">
            {/* Drawer Header */}
            <div className="p-5 border-b border-line flex items-center justify-between bg-canvas/30">
              <div className="flex items-center gap-3">
                <span className="font-bold text-lg font-mono text-ink">
                  #{selectedOrder.order_no}
                </span>
                <Tag
                  tone={
                    selectedOrder.status === "completed"
                      ? "good"
                      : selectedOrder.status === "cancelled" || selectedOrder.status === "rejected"
                      ? "bad"
                      : "warn"
                  }
                >
                  {selectedOrder.status.toUpperCase()}
                </Tag>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPrintOrder(selectedOrder)}
                  className="px-2.5 py-1 rounded border border-line text-xs font-semibold text-ink-soft hover:text-ink hover:bg-canvas flex items-center gap-1"
                >
                  🖨 Print Ticket
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-ink-soft hover:text-ink text-sm p-1 ml-2"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Warning banner if message failed to send */}
            {messageWarning && (
              <div className="p-3 bg-amber-wash border-b border-amber/30 text-xs flex items-center justify-between text-amber font-medium">
                <span>⚠️ {messageWarning}</span>
                <button
                  type="button"
                  onClick={handleResendMessage}
                  disabled={actionLoading}
                  className="underline font-bold hover:text-ink"
                >
                  Retry Sending
                </button>
              </div>
            )}

            {/* Drawer Body */}
            <div className="p-6 flex-1 overflow-y-auto space-y-5">
              {/* Customer Info Card */}
              <div className="p-4 bg-canvas/60 border border-line rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase text-ink-soft">
                    Customer Details
                  </span>
                  <Link
                    href={`/chats?phone=${selectedOrder.phone}`}
                    className="text-xs text-pine font-semibold hover:underline flex items-center gap-1"
                  >
                    💬 Open WhatsApp Chat →
                  </Link>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-ink">
                      {selectedOrder.customer_name || selectedOrder.contact_name || "Unknown"}
                    </p>
                    <p className="text-xs font-mono text-ink-soft">{selectedOrder.phone}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs bg-panel border border-line px-2 py-0.5 rounded font-medium">
                      {selectedOrder.fulfilment === "delivery" ? "🚗 Delivery" : "🛍 Pickup"}
                    </span>
                  </div>
                </div>

                {selectedOrder.fulfilment === "delivery" && selectedOrder.address_text && (
                  <div className="pt-2 border-t border-line/60 text-xs text-ink-soft">
                    <span className="font-medium text-ink">Address: </span>
                    {selectedOrder.address_text}
                    {selectedOrder.zone_name && ` (${selectedOrder.zone_name})`}
                  </div>
                )}

                {selectedOrder.notes && (
                  <div className="pt-2 border-t border-line/60 text-xs bg-amber-wash/40 p-2 rounded text-amber">
                    <span className="font-semibold">Customer Note: </span>
                    {selectedOrder.notes}
                  </div>
                )}
              </div>

              {/* Items List */}
              <div>
                <h3 className="text-xs font-semibold uppercase text-ink-soft mb-2">Order Items</h3>
                <div className="border border-line rounded-xl overflow-hidden divide-y divide-line">
                  {selectedOrder.items?.map((item) => (
                    <div key={item.id} className="p-3 bg-panel flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-ink">
                          <span className="font-bold tabular mr-1">{Number(item.qty)}x</span>{" "}
                          {item.name}
                        </p>
                        {item.variant && (
                          <p className="text-xs text-pine font-medium mt-0.5">
                            Variant: {item.variant}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-ink-soft mt-0.5 italic">Note: {item.notes}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-bold tabular">
                          {selectedOrder.currency} {Number(item.line_total).toFixed(2)}
                        </span>
                        <span className="block text-[11px] text-ink-soft tabular">
                          @{Number(item.unit_price).toFixed(2)} each
                        </span>
                      </div>
                    </div>
                  ))}

                  {/* Calculations breakdown */}
                  <div className="p-3 bg-canvas/40 space-y-1 text-xs">
                    <div className="flex justify-between text-ink-soft">
                      <span>Subtotal</span>
                      <span className="tabular font-medium">
                        {selectedOrder.currency} {Number(selectedOrder.subtotal).toFixed(2)}
                      </span>
                    </div>
                    {Number(selectedOrder.delivery_fee) > 0 && (
                      <div className="flex justify-between text-ink-soft">
                        <span>Delivery Fee</span>
                        <span className="tabular font-medium">
                          +{selectedOrder.currency} {Number(selectedOrder.delivery_fee).toFixed(2)}
                        </span>
                      </div>
                    )}
                    {Number(selectedOrder.discount) > 0 && (
                      <div className="flex justify-between text-pine">
                        <span>Discount</span>
                        <span className="tabular font-medium">
                          -{selectedOrder.currency} {Number(selectedOrder.discount).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold text-ink pt-1 border-t border-line">
                      <span>Total</span>
                      <span className="tabular">
                        {selectedOrder.currency} {Number(selectedOrder.total).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Details */}
              <div className="p-4 bg-canvas/60 border border-line rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-ink-soft uppercase font-medium">Payment</span>
                  <p className="text-sm font-semibold text-ink uppercase mt-0.5">
                    {selectedOrder.payment_method}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Tag tone={selectedOrder.payment_status === "paid" ? "good" : "warn"}>
                    {selectedOrder.payment_status === "paid" ? "PAID" : "UNPAID"}
                  </Tag>
                  {selectedOrder.payment_status !== "paid" && (
                    <Button variant="quiet" onClick={handleMarkPaid}>
                      Mark as Paid
                    </Button>
                  )}
                </div>
              </div>

              {/* Staff Notes & Tracking Reference */}
              <div className="space-y-3">
                <Field label="Staff Notes (Internal)" hint="Kitchen prep instructions, driver assignments">
                  <textarea
                    rows={2}
                    value={staffNoteInput}
                    onChange={(e) => setStaffNoteInput(e.target.value)}
                    placeholder="e.g. Extra napkins, assigned to driver Alex"
                    className={inputClass}
                  />
                </Field>

                <Field label="Tracking Reference / Courier ID">
                  <input
                    type="text"
                    value={trackingRefInput}
                    onChange={(e) => setTrackingRefInput(e.target.value)}
                    placeholder="e.g. TRK-88921"
                    className={inputClass}
                  />
                </Field>

                <div className="flex justify-end">
                  <Button variant="quiet" onClick={handleSaveNotes}>
                    Save Notes & Reference
                  </Button>
                </div>
              </div>

              {selectedOrder.cancel_reason && (
                <div className="p-3 bg-brick/10 border border-brick/30 rounded-lg text-xs text-brick">
                  <span className="font-semibold">Cancellation / Rejection Reason: </span>
                  {selectedOrder.cancel_reason}
                </div>
              )}
            </div>

            {/* Transition Action Buttons Footer */}
            <div className="p-4 border-t border-line bg-canvas/40 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                {selectedOrder.status === "pending" && (
                  <Button
                    variant="danger"
                    disabled={actionLoading}
                    onClick={() => setReasonModal({ open: true, targetStatus: "rejected" })}
                  >
                    Reject Order
                  </Button>
                )}
                {["pending", "accepted", "preparing", "ready", "out_for_delivery"].includes(
                  selectedOrder.status
                ) && (
                  <Button
                    variant="danger"
                    disabled={actionLoading}
                    onClick={() => setReasonModal({ open: true, targetStatus: "cancelled" })}
                  >
                    Cancel Order
                  </Button>
                )}
              </div>

              <div className="flex items-center gap-2">
                {selectedOrder.status === "pending" && (
                  <Button
                    variant="primary"
                    disabled={actionLoading}
                    onClick={() => handleTransition("accepted")}
                  >
                    Accept Order →
                  </Button>
                )}
                {selectedOrder.status === "accepted" && (
                  <Button
                    variant="primary"
                    disabled={actionLoading}
                    onClick={() => handleTransition("preparing")}
                  >
                    Start Preparing →
                  </Button>
                )}
                {selectedOrder.status === "preparing" && (
                  <Button
                    variant="primary"
                    disabled={actionLoading}
                    onClick={() => handleTransition("ready")}
                  >
                    Mark Ready →
                  </Button>
                )}
                {selectedOrder.status === "ready" && selectedOrder.fulfilment === "delivery" && (
                  <Button
                    variant="primary"
                    disabled={actionLoading}
                    onClick={() => handleTransition("out_for_delivery")}
                  >
                    Out for Delivery →
                  </Button>
                )}
                {selectedOrder.status === "ready" && selectedOrder.fulfilment !== "delivery" && (
                  <Button
                    variant="primary"
                    disabled={actionLoading}
                    onClick={() => handleTransition("completed")}
                  >
                    Complete Order ✓
                  </Button>
                )}
                {selectedOrder.status === "out_for_delivery" && (
                  <Button
                    variant="primary"
                    disabled={actionLoading}
                    onClick={() => handleTransition("completed")}
                  >
                    Complete Order ✓
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reason Modal for Cancel / Reject */}
      {reasonModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-panel rounded-xl border border-line shadow-2xl p-5 space-y-4 animate-in zoom-in-95 duration-150">
            <h3 className="font-semibold text-base capitalize">
              {reasonModal.targetStatus} Order #{selectedOrder?.order_no}
            </h3>
            <p className="text-xs text-ink-soft">
              Please specify a reason for {reasonModal.targetStatus}ing this order.
            </p>

            <Field label="Reason" hint="Will be saved and included in the cancellation message">
              <input
                type="text"
                required
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder="e.g. Item out of stock, customer requested"
                className={inputClass}
              />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="quiet"
                onClick={() => setReasonModal({ open: false, targetStatus: "cancelled" })}
              >
                Go Back
              </Button>
              <Button
                variant="danger"
                disabled={actionLoading || (!reasonText.trim() && reasonModal.targetStatus === "rejected")}
                onClick={() => handleTransition(reasonModal.targetStatus, reasonText.trim())}
              >
                Confirm {reasonModal.targetStatus}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 80mm Print Layout Ticket Modal */}
      {printOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4 print:p-0 print:bg-white print:static">
          {/* Printable Ticket Container with 80mm Print Styles */}
          <div className="bg-white text-black p-6 rounded-xl max-w-sm w-full font-mono text-xs shadow-2xl border border-line print:border-none print:shadow-none print:w-[80mm] print:max-w-[80mm] print:p-2 print:m-0">
            <style jsx global>{`
              @media print {
                @page {
                  size: 80mm auto;
                  margin: 0;
                }
                body {
                  margin: 0;
                  background: white;
                }
                /* Hide everything except print ticket */
                body * {
                  visibility: hidden;
                }
                #print-ticket,
                #print-ticket * {
                  visibility: visible;
                }
                #print-ticket {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 80mm;
                  padding: 4mm;
                }
              }
            `}</style>

            <div id="print-ticket" className="space-y-3">
              <div className="text-center border-b border-black pb-2">
                <h2 className="text-base font-black tracking-tight uppercase">
                  {companyName || "ORDER TICKET"}
                </h2>
                <p className="text-lg font-black mt-1">ORDER #{printOrder.order_no}</p>
                <p className="text-[10px] text-gray-600 mt-0.5">
                  {new Date(printOrder.placed_at || printOrder.created_at).toLocaleString()}
                </p>
                <div className="inline-block mt-1 font-bold text-xs uppercase px-2 py-0.5 border border-black rounded">
                  {printOrder.fulfilment === "delivery" ? "DELIVERY" : "PICKUP"}
                </div>
              </div>

              {/* Customer */}
              <div className="border-b border-black pb-2 text-[11px] leading-tight">
                <p>
                  <span className="font-bold">Customer: </span>
                  {printOrder.customer_name || printOrder.contact_name || "Unknown"}
                </p>
                <p>
                  <span className="font-bold">Phone: </span>
                  {printOrder.phone}
                </p>
                {printOrder.fulfilment === "delivery" && printOrder.address_text && (
                  <p className="mt-1">
                    <span className="font-bold">Address: </span>
                    {printOrder.address_text}
                  </p>
                )}
              </div>

              {/* Items */}
              <div className="border-b border-black pb-2">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-gray-400">
                      <th className="py-1">QTY</th>
                      <th className="py-1">ITEM</th>
                      <th className="py-1 text-right">TOTAL</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printOrder.items?.map((it) => (
                      <tr key={it.id} className="border-b border-gray-200">
                        <td className="py-1 font-bold align-top w-8">{Number(it.qty)}x</td>
                        <td className="py-1 align-top">
                          <p className="font-bold">{it.name}</p>
                          {it.variant && <p className="text-[10px] text-gray-700">[{it.variant}]</p>}
                          {it.notes && <p className="text-[10px] italic">Note: {it.notes}</p>}
                        </td>
                        <td className="py-1 text-right align-top tabular">
                          {Number(it.line_total).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Notes */}
              {printOrder.notes && (
                <div className="border-b border-black pb-2 text-[11px]">
                  <p className="font-bold">CUSTOMER NOTE:</p>
                  <p className="italic">{printOrder.notes}</p>
                </div>
              )}

              {printOrder.staff_notes && (
                <div className="border-b border-black pb-2 text-[11px]">
                  <p className="font-bold">STAFF NOTE:</p>
                  <p>{printOrder.staff_notes}</p>
                </div>
              )}

              {/* Total Summary */}
              <div className="text-right text-xs space-y-0.5 pt-1">
                <p>Subtotal: {Number(printOrder.subtotal).toFixed(2)}</p>
                {Number(printOrder.delivery_fee) > 0 && (
                  <p>Delivery: {Number(printOrder.delivery_fee).toFixed(2)}</p>
                )}
                <p className="font-black text-sm">
                  TOTAL: {printOrder.currency} {Number(printOrder.total).toFixed(2)}
                </p>
                <p className="text-[10px] uppercase">Payment: {printOrder.payment_method} ({printOrder.payment_status})</p>
              </div>

              <div className="text-center pt-2 text-[10px] text-gray-500">
                *** THANK YOU ***
              </div>
            </div>

            {/* Print & Close Buttons (screen only) */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-300 print:hidden">
              <Button variant="quiet" onClick={() => setPrintOrder(null)}>
                Close
              </Button>
              <Button variant="primary" onClick={() => window.print()}>
                🖨 Print Now
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* New Order Modal */}
      {newOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/50 p-4">
          <div className="bg-surface border border-line rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-semibold text-ink text-base">Create New Order</h3>
                <p className="text-xs text-ink-soft">Record a customer order manually</p>
              </div>
              <button
                onClick={() => setNewOrderModalOpen(false)}
                className="text-ink-soft hover:text-ink text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="space-y-3">
              <Field label="Customer Phone *">
                <input
                  type="text"
                  required
                  placeholder="e.g. 97430954643"
                  value={newOrderForm.phone}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, phone: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Customer Name">
                <input
                  type="text"
                  placeholder="Full name"
                  value={newOrderForm.customer_name}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, customer_name: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Fulfilment">
                  <select
                    value={newOrderForm.fulfilment}
                    onChange={(e) =>
                      setNewOrderForm({ ...newOrderForm, fulfilment: e.target.value as "delivery" | "pickup" })
                    }
                    className={inputClass}
                  >
                    <option value="delivery">Delivery</option>
                    <option value="pickup">Pickup</option>
                  </select>
                </Field>

                <Field label="Total Amount (QAR)">
                  <input
                    type="number"
                    step="0.01"
                    placeholder="e.g. 938"
                    value={newOrderForm.total}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, total: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              </div>

              {newOrderForm.fulfilment === "delivery" && (
                <Field label="Delivery Address / Area">
                  <input
                    type="text"
                    placeholder="e.g. Doha, Street 12, Villa 4"
                    value={newOrderForm.address_text}
                    onChange={(e) => setNewOrderForm({ ...newOrderForm, address_text: e.target.value })}
                    className={inputClass}
                  />
                </Field>
              )}

              <Field label="Items Description *">
                <textarea
                  required
                  rows={2}
                  placeholder="e.g. Winter Drift Bike (Blue) x 1, Winter Drift Bike (Yellow) x 1"
                  value={newOrderForm.items_summary}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, items_summary: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <Field label="Special Notes">
                <input
                  type="text"
                  placeholder="Any customer notes or delivery instructions"
                  value={newOrderForm.notes}
                  onChange={(e) => setNewOrderForm({ ...newOrderForm, notes: e.target.value })}
                  className={inputClass}
                />
              </Field>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-line">
                <Button variant="quiet" type="button" onClick={() => setNewOrderModalOpen(false)}>
                  Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={createLoading}>
                  {createLoading ? "Creating..." : "Save Order"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
