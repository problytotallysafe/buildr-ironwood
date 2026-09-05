"use client";

import { useState } from "react";
import { Mail, MessageSquare } from "lucide-react";

export function InvoiceSendControls({ projectId, enabled, paid = false }: { projectId: string; enabled: boolean; paid?: boolean }) {
  const [busy, setBusy] = useState<"email" | "text" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);

  async function send(channel: "email" | "text") {
    setBusy(channel);
    setMessage("");
    setError(false);
    try {
      const response = await fetch(`/api/projects/${projectId}/invoice/${channel}`, { method: "POST" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || `The ${paid ? "receipt" : "invoice"} could not be sent.`);
      if (channel === "text" && body.mode === "composer" && body.smsUrl) window.location.href = body.smsUrl;
      const noun = paid ? "Receipt" : "Invoice";
      setMessage(channel === "email" ? `${noun} emailed.` : body.mode === "sent" ? `${noun} texted.` : "Text message opened.");
    } catch (reason) {
      setError(true);
      setMessage(reason instanceof Error ? reason.message : `The ${paid ? "receipt" : "invoice"} could not be sent.`);
    } finally {
      setBusy(null);
    }
  }

  if (!enabled) return <small className="invoice-send-note">Mark this project substantially complete or complete to send its final invoice.</small>;

  return <div className="invoice-send-controls">
    <div>
      <button className="button button--gold" disabled={busy !== null} onClick={() => send("email")}><Mail size={16}/>{busy === "email" ? "Sending…" : paid ? "Email receipt" : "Email invoice"}</button>
      <button className="button button--outline" disabled={busy !== null} onClick={() => send("text")}><MessageSquare size={16}/>{busy === "text" ? "Preparing…" : paid ? "Text receipt" : "Text invoice"}</button>
    </div>
    {message && <small className={error ? "form-error" : "form-success"}>{message}</small>}
  </div>;
}
