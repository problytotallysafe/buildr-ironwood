"use client";

import { FormEvent, useMemo, useState } from "react";
import { Check, ClipboardCheck, Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const workChecklist = [
  ["final_cleanup_complete", "Final cleanup complete"],
  ["customer_walkthrough_complete", "Customer walkthrough complete"],
  ["keys_access_returned", "Keys, remotes, and access returned"],
  ["manuals_delivered", "Product manuals and care instructions delivered"],
  ["warranty_information_delivered", "Warranty information delivered"],
  ["subcontractor_documents_complete", "Subcontractor documents / lien waivers complete"],
  ["final_photos_complete", "Final photos complete"],
] as const;

const checklist = [...workChecklist, ["final_payment_complete", "Final payment complete"]] as const;

export function ProjectCloseout({ projectId, initialCloseout, initialItems }: { projectId: string; initialCloseout: any; initialItems: any[] }) {
  const supabase = createClient();
  const [closeout, setCloseout] = useState<any>(initialCloseout || Object.fromEntries(checklist.map(([key]) => [key, false])));
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const completeCount = workChecklist.filter(([key]) => Boolean(closeout[key])).length;
  const openPunch = items.filter((item) => item.status !== "complete").length;
  const workComplete = completeCount === workChecklist.length && openPunch === 0;
  const readyToClose = workComplete && Boolean(closeout.final_payment_complete);

  async function saveCloseout(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); return; }
    const values: any = { owner_id: user.id, project_id: projectId };
    checklist.forEach(([key]) => { values[key] = form.get(key) === "on"; });
    ["walkthrough_date","customer_notes","warranty_notes","internal_notes"].forEach((key) => { values[key] = String(form.get(key) || "").trim() || null; });
    values.closed_at = readyToClose ? closeout.closed_at || new Date().toISOString() : null;
    const { data, error } = await supabase.from("project_closeouts").upsert(values, { onConflict: "project_id" }).select("*").single();
    setBusy(false);
    if (error) setMessage(error.message);
    else { setCloseout(data); setMessage(readyToClose ? "Closeout saved. Work and payment are complete." : workComplete ? "Work is 100% complete. The job will stay current while payment is outstanding." : "Closeout saved."); }
  }

  async function addPunch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("project_punch_items").insert({
      owner_id: user.id, project_id: projectId,
      description: String(form.get("description") || "").trim(),
      room_location: String(form.get("room_location") || "").trim() || null,
      responsible_party: String(form.get("responsible_party") || "ironwood"),
      due_date: String(form.get("due_date") || "") || null,
      priority: String(form.get("priority") || "normal"),
      customer_visible: form.get("customer_visible") === "on",
    }).select("*").single();
    if (error) setMessage(error.message);
    else if (data) { setItems((current) => [...current, data]); event.currentTarget.reset(); }
  }

  async function savePunch(event: FormEvent<HTMLFormElement>, item: any) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const values = {
      description: String(form.get("description") || "").trim(),
      room_location: String(form.get("room_location") || "").trim() || null,
      responsible_party: String(form.get("responsible_party") || "ironwood"),
      due_date: String(form.get("due_date") || "") || null,
      priority: String(form.get("priority") || "normal"),
      customer_visible: form.get("customer_visible") === "on",
    };
    const { data, error } = await supabase.from("project_punch_items").update(values).eq("id", item.id).select("*").single();
    if (error) setMessage(error.message);
    else if (data) { setItems((current) => current.map((entry) => entry.id === item.id ? data : entry)); setMessage("Punch item updated."); }
  }

  async function togglePunch(item: any) {
    const status = item.status === "complete" ? "open" : "complete";
    const { data } = await supabase.from("project_punch_items").update({ status, completed_at: status === "complete" ? new Date().toISOString() : null }).eq("id", item.id).select("*").single();
    if (data) setItems((current) => current.map((entry) => entry.id === item.id ? data : entry));
  }

  async function deletePunch(id: string) {
    if (!window.confirm("Delete this punch-list item?")) return;
    const { error } = await supabase.from("project_punch_items").delete().eq("id", id);
    if (!error) setItems((current) => current.filter((item) => item.id !== id));
  }

  const orderedItems = useMemo(() => [...items].sort((a, b) => Number(a.status === "complete") - Number(b.status === "complete")), [items]);

  return <section id="closeout" className="project-closeout-wrap project-section-anchor">
    <div className="project-closeout-heading"><div><span className="project-overview-label">Punch list & closeout</span><h2>Finish every detail—and the handoff</h2><p>{openPunch} open punch item{openPunch === 1 ? "" : "s"} · {completeCount} of {workChecklist.length} work steps complete</p></div><div className={workComplete ? "closeout-readiness closeout-readiness--ready" : "closeout-readiness"}><ClipboardCheck/><strong>{readyToClose ? "Work complete · Paid" : workComplete ? "100% complete · Awaiting payment" : "Closeout in progress"}</strong></div></div>

    <div className="closeout-grid">
      <div className="stack">
        <section className="panel"><div className="panel-heading"><div><h2>Punch list</h2><p>Each item stays editable until it is truly resolved.</p></div><strong>{openPunch} open</strong></div>
          <form onSubmit={addPunch} className="punch-add-form"><input name="description" required placeholder="Describe the correction or final detail"/><input name="room_location" placeholder="Room / location"/><select name="responsible_party" defaultValue="ironwood"><option value="ironwood">Ironwood</option><option value="subcontractor">Subcontractor</option><option value="customer">Customer</option></select><input name="due_date" type="date"/><select name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select><label className="checkbox"><input type="checkbox" name="customer_visible" defaultChecked/>Customer visible</label><button className="button button--gold"><Plus size={16}/>Add item</button></form>
          <div className="punch-list">{orderedItems.map((item) => <form onSubmit={(event) => savePunch(event, item)} className={item.status === "complete" ? "punch-item punch-item--complete" : `punch-item punch-item--${item.priority}`} key={item.id}><button type="button" className="today-check" onClick={() => togglePunch(item)} aria-label={item.status === "complete" ? "Reopen item" : "Complete item"}>{item.status === "complete" ? <RotateCcw size={16}/> : <Check size={16}/>}</button><div className="punch-fields"><input name="description" required defaultValue={item.description}/><input name="room_location" defaultValue={item.room_location || ""} placeholder="Room / location"/><select name="responsible_party" defaultValue={item.responsible_party}><option value="ironwood">Ironwood</option><option value="subcontractor">Subcontractor</option><option value="customer">Customer</option></select><input name="due_date" type="date" defaultValue={item.due_date || ""}/><select name="priority" defaultValue={item.priority}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select><label className="checkbox"><input type="checkbox" name="customer_visible" defaultChecked={item.customer_visible}/>Customer visible</label></div><button className="icon-button" aria-label="Save changes"><Save size={15}/></button><button type="button" className="icon-button danger" onClick={() => deletePunch(item.id)} aria-label="Delete item"><Trash2 size={15}/></button></form>)}{!items.length && <p className="empty-cell">No punch items. Add anything found during your final walkthrough.</p>}</div>
        </section>
      </div>

      <form onSubmit={saveCloseout} className="panel closeout-checklist"><h2>Final handoff checklist</h2><div className="closeout-progress"><span style={{ width: `${completeCount / workChecklist.length * 100}%` }}/></div>{workChecklist.map(([key, label]) => <label className="closeout-check" key={key}><input type="checkbox" name={key} checked={Boolean(closeout[key])} onChange={(event) => setCloseout((current: any) => ({ ...current, [key]: event.target.checked }))}/><span>{label}</span></label>)}<div className="closeout-payment-step"><strong>Payment & archive</strong><p>Work can reach 100% before the final payment arrives. Keep this unchecked until the balance is actually received.</p><label className="closeout-check"><input type="checkbox" name="final_payment_complete" checked={Boolean(closeout.final_payment_complete)} onChange={(event) => setCloseout((current: any) => ({ ...current, final_payment_complete: event.target.checked }))}/><span>Final payment complete</span></label></div><label>Walkthrough date<input type="date" name="walkthrough_date" defaultValue={closeout.walkthrough_date || ""}/></label><label>Customer walkthrough notes<textarea name="customer_notes" rows={3} defaultValue={closeout.customer_notes || ""}/></label><label>Warranty / care notes<textarea name="warranty_notes" rows={3} defaultValue={closeout.warranty_notes || ""}/></label><label>Private Ironwood closeout notes<textarea name="internal_notes" rows={3} defaultValue={closeout.internal_notes || ""}/></label><button className="button button--gold button--block" disabled={busy}><Save size={16}/>{busy ? "Saving…" : "Save closeout"}</button>{message && <p className="form-message">{message}</p>}</form>
    </div>
  </section>;
}
