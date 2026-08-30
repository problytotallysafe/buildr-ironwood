"use client";

import { Mail, MessageSquareText, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SendChangeOrderButton({ id, disabled, emailDisabled, textDisabled }: { id: string; disabled?: boolean; emailDisabled?: boolean; textDisabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();

  async function sendEmail() {
    setBusy(true); setMessage("");
    const response = await fetch(`/api/change-orders/${id}/send`, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    setBusy(false); setMessage(response.ok ? "Change order emailed." : body.error || "Could not send change order.");
    if (response.ok) router.refresh();
  }

  async function sendText() {
    setBusy(true); setMessage("");
    const response = await fetch(`/api/change-orders/${id}/text`, { method: "POST" });
    const body = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok) {
      setMessage(body.error || "Could not prepare the change-order text.");
      return;
    }
    setMessage(body.mode === "sent" ? "Change order texted." : "Opening your text app. Send the prepared message to finish.");
    router.refresh();
    if (body.mode === "composer" && body.smsUrl) window.location.href = body.smsUrl;
  }

  async function remove() {
    const supabase = createClient();
    const { data: changeOrder, error: loadError } = await supabase.from("change_orders").select("change_order_number,project_id,status,total").eq("id", id).single();
    if (loadError || !changeOrder) { setMessage(loadError?.message || "Could not load change order."); return; }
    const acceptedWarning = changeOrder.status === "accepted" ? " This was accepted, so its amount will also be removed from the project contract." : "";
    if (!window.confirm(`Delete ${changeOrder.change_order_number}? This permanently removes the change order and its activity.${acceptedWarning}`)) return;
    setBusy(true); setMessage("");
    let priorContractTotal: number | null = null;
    if (changeOrder.status === "accepted") {
      const { data: project, error } = await supabase.from("projects").select("contract_total").eq("id", changeOrder.project_id).single();
      if (error || !project) { setMessage(error?.message || "Could not load project total."); setBusy(false); return; }
      priorContractTotal = Number(project.contract_total);
      const { error: totalError } = await supabase.from("projects").update({ contract_total: Math.max(0, priorContractTotal - Number(changeOrder.total)) }).eq("id", changeOrder.project_id);
      if (totalError) { setMessage(totalError.message); setBusy(false); return; }
    }
    const { error: deleteError } = await supabase.from("change_orders").delete().eq("id", id);
    if (deleteError) {
      if (priorContractTotal !== null) await supabase.from("projects").update({ contract_total: priorContractTotal }).eq("id", changeOrder.project_id);
      setMessage(deleteError.message); setBusy(false); return;
    }
    router.push(`/projects/${changeOrder.project_id}`);
    router.refresh();
  }

  return <div className="send-control"><div className="button-row"><button className="button button--gold" type="button" onClick={sendEmail} disabled={busy || disabled || emailDisabled}><Mail size={16}/>{busy ? "Working…" : "Email approval"}</button><button className="button button--outline" type="button" onClick={sendText} disabled={busy || disabled || textDisabled}><MessageSquareText size={16}/>Text approval</button><button className="button button--danger" type="button" onClick={remove} disabled={busy}><Trash2 size={16}/>Delete</button></div>{message && <small>{message}</small>}</div>;
}
