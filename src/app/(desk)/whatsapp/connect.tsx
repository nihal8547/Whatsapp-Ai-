"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Panel, PageHead, Tag, Toast, useToast } from "@/components/ui";

export default function WhatsAppConnect({ readOnly }: { readOnly: boolean }) {
  const [status, setStatus] = useState<string>("loading");
  const [instance, setInstance] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [pairing, setPairing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { message, show } = useToast();

  const check = useCallback(async () => {
    const res = await fetch("/api/whatsapp");
    const data = await res.json();
    if (data.ok) {
      setStatus(data.status ?? "none");
      setInstance(data.instance ?? null);
      if (data.status === "connected") {
        setQr(null);
        setPairing(null);
      }
    } else {
      setStatus("none");
    }
  }, []);

  useEffect(() => {
    check();
  }, [check]);

  // While a QR is on screen, watch for the scan to land.
  useEffect(() => {
    if (!qr) return;
    const t = setInterval(check, 4000);
    return () => clearInterval(t);
  }, [qr, check]);

  async function connect() {
    setBusy(true);
    setQr(null);
    const res = await fetch("/api/whatsapp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "connect" }),
    });
    const data = await res.json();
    setBusy(false);
    if (!data.ok || data.error) {
      show(
        data.error === "evolution_global_api_key_required"
          ? "The server key can't create numbers. Ask your administrator."
          : "Could not start the connection. Try again."
      );
      return;
    }
    setQr(data.qr ?? null);
    setPairing(data.pairing_code ?? null);
    setInstance(data.instance ?? null);
    if (!data.qr && !data.pairing_code) show("No QR came back. Try again in a moment.");
  }

  async function disconnect() {
    if (!confirm("Disconnect this number? Customers will stop getting replies.")) return;
    setBusy(true);
    await fetch("/api/whatsapp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "disconnect" }),
    });
    setBusy(false);
    show("Number disconnected");
    check();
  }

  const connected = status === "connected";

  return (
    <div className="p-6 lg:p-8 max-w-2xl">
      <PageHead
        title="WhatsApp number"
        lead="Link the phone that customers message. Everything runs through it."
      />

      <Panel className="mb-5">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="font-medium">
              {connected ? "Connected" : status === "loading" ? "Checking…" : "Not connected"}
            </p>
            <p className="text-sm text-ink-soft mt-0.5">
              {connected
                ? "Your assistant is answering on this number."
                : "Customers cannot reach the assistant until a phone is linked."}
            </p>
            {instance && <p className="text-xs text-ink-faint tabular mt-1">{instance}</p>}
          </div>
          <div className="flex gap-2">
            {connected ? (
              <Tag tone="good">Live</Tag>
            ) : (
              <Tag tone="warn">{status === "loading" ? "…" : "Waiting"}</Tag>
            )}
          </div>
        </div>

        {!readOnly && (
          <div className="flex gap-2 mt-5">
            {connected ? (
              <Button variant="danger" onClick={disconnect} disabled={busy}>
                Disconnect
              </Button>
            ) : (
              <Button onClick={connect} disabled={busy}>
                {busy ? "Preparing…" : "Show QR code"}
              </Button>
            )}
            <Button variant="quiet" onClick={check}>
              Refresh status
            </Button>
          </div>
        )}
      </Panel>

      {qr && !connected && (
        <Panel>
          <h2 className="font-semibold">Scan this with the phone</h2>
          <ol className="text-sm text-ink-soft mt-3 space-y-1.5 list-decimal list-inside">
            <li>Open WhatsApp on the business phone</li>
            <li>Go to Settings, then Linked devices</li>
            <li>Tap Link a device and point it at this code</li>
          </ol>
          <div className="mt-5 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`}
              alt="WhatsApp linking QR code"
              className="w-64 h-64 border border-line rounded-md bg-white p-2"
            />
          </div>
          {pairing && (
            <p className="text-sm text-center mt-4">
              Or type this code on the phone: <span className="tabular font-medium">{pairing}</span>
            </p>
          )}
          <p className="text-xs text-ink-faint text-center mt-4">
            The code expires after about a minute. This page updates itself once the scan lands.
          </p>
        </Panel>
      )}

      <Toast message={message} />
    </div>
  );
}
