"use client";

import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { money } from "@/lib/money";
import { IronwoodLogo } from "./ironwood-logo";

const labels: Record<string, string> = {
  allowance: "Allowance",
  customer_supplied: "Customer supplied",
  undecided: "Selection needed",
  excluded: "Not included",
};

function selectionDetails(item: any) {
  return [
    labels[item.selection_status],
    item.selection_responsibility === "customer" ? "Customer responsible" : null,
    item.selected_product,
    item.selection_deadline ? `Decide by ${new Date(`${item.selection_deadline}T12:00:00`).toLocaleDateString()}` : null,
    item.selection_notes,
  ].filter(Boolean);
}

export function PublicProposal({ token, proposal, via }: { token: string; proposal: any; via?: string }) {
  const { estimate, customer } = proposal;
  const business = proposal.business || {};
  const [accepted, setAccepted] = useState(Boolean(estimate.accepted_at));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const supabase = createClient();

  useEffect(() => {
    supabase.rpc("record_estimate_view", { p_token: token, p_user_agent: navigator.userAgent });
  }, [supabase, token]);

  async function accept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const contact = String(form.get("contact") || "").trim();
    const isEmail = contact.includes("@");
    const { error: acceptError } = await supabase.rpc("accept_public_estimate_v2", {
      p_token: token,
      p_name: String(form.get("name") || ""),
      p_email: isEmail ? contact : null,
      p_phone: isEmail ? null : contact,
      p_note: String(form.get("note") || ""),
      p_method: via === "text" ? "online_text_link" : "online_email_link",
    });
    setBusy(false);
    if (acceptError) setError(acceptError.message);
    else setAccepted(true);
  }

  const defaultContact = via === "text" ? customer.phone || customer.email || "" : customer.email || customer.phone || "";
  const selectionItems = proposal.items.filter((item: any) => item.selection_status && item.selection_status !== "final");

  return <main className="proposal-page">
    <header className="proposal-header"><div className="proposal-header-inner"><IronwoodLogo/><div><small>PROPOSAL{estimate.revision_number ? ` • REVISION ${estimate.revision_number}` : ""}</small><strong>{estimate.estimate_number}</strong></div></div></header>
    <article className="proposal-sheet">
      <section className="proposal-hero"><div className="eyebrow">Prepared for {customer.first_name} {customer.last_name}</div><h1>{estimate.title}</h1><p>{estimate.project_address}</p><div className="proposal-total"><span>Project investment</span><strong>{money(estimate.total)}</strong></div></section>
      <section className="proposal-section"><h2>Scope of work</h2><div className="preline">{estimate.scope || "Scope not entered."}</div></section>
      <section className="proposal-section"><h2>Investment details</h2><div className="table-wrap"><table><thead><tr><th>Description</th><th>Quantity</th><th>Amount</th></tr></thead><tbody>{proposal.items.map((item: any) => <tr key={item.id}><td>{item.description}<small>{item.category}</small>{selectionDetails(item).length > 0 && <small className="selection-summary">{selectionDetails(item).join(" · ")}</small>}</td><td>{item.quantity} {item.unit}</td><td>{money(item.line_total)}</td></tr>)}</tbody></table></div><dl className="totals totals--right"><div><dt>Subtotal</dt><dd>{money(Number(estimate.subtotal) + Number(estimate.markup_total))}</dd></div><div><dt>Tax</dt><dd>{money(estimate.tax_total)}</dd></div><div className="grand"><dt>Total</dt><dd>{money(estimate.total)}</dd></div></dl></section>
      {selectionItems.length > 0 && <section className="proposal-section proposal-selections"><h2>Selections and allowances</h2><p>These items are included here so the budget, responsibility, and decisions are clear before work begins.</p><div className="selection-card-list">{selectionItems.map((item: any) => <article key={item.id}><div><strong>{item.description}</strong><span>{labels[item.selection_status] || item.selection_status}</span></div>{item.selection_status === "allowance" && <b>{money(item.line_total)} allowance</b>}<small>{selectionDetails(item).slice(1).join(" · ") || "Details to be confirmed"}</small></article>)}</div></section>}
      {estimate.exclusions && <section className="proposal-section"><h2>Exclusions and owner-supplied items</h2><div className="preline">{estimate.exclusions}</div></section>}
      {estimate.payment_schedule && <section className="proposal-section"><h2>Payment schedule</h2><div className="preline">{estimate.payment_schedule}</div></section>}
      {estimate.customer_notes && <section className="proposal-section"><h2>Additional notes</h2><div className="preline">{estimate.customer_notes}</div></section>}
      <section className="proposal-section acceptance acceptance--simple"><div className="easy-accept-heading"><ShieldCheck size={32}/><div><h2>Ready to approve?</h2><p>Review the information above, then complete the short confirmation below.</p></div></div>{accepted ? <div className="accepted-box"><CheckCircle2/><div><strong>Estimate accepted</strong><p>Thank you. Ironwood Remodeling has received your approval and will contact you about scheduling and next steps.</p></div></div> : <form onSubmit={accept} className="easy-accept-form"><div className="accept-total"><span>You are approving</span><strong>{money(estimate.total)}</strong></div><label>Full name<input name="name" required autoComplete="name" defaultValue={`${customer.first_name || ""} ${customer.last_name || ""}`.trim()}/></label><label>Email or mobile number<input name="contact" required autoComplete="email" inputMode="email" defaultValue={defaultContact} placeholder="Used only to identify your approval"/></label><label className="easy-confirm"><input type="checkbox" required/><span>I reviewed and approve this estimate, including the scope of work, total price, selections and allowances, exclusions, and payment schedule.</span></label><details><summary>Add a note (optional)</summary><textarea name="note" rows={3} placeholder="Questions, scheduling notes, or other comments"/></details>{error && <p className="error-box">{error}</p>}<button className="button button--gold easy-accept-button" disabled={busy}>{busy ? "Recording your approval…" : "Approve this estimate"}</button><p className="fine-print">This button records the name, contact information, date, and time of approval.</p></form>}</section>
    </article>
    <footer className="proposal-footer"><strong>{business.business_name || "Ironwood Remodeling"}</strong><span>{business.phone || "479.496.7819"} · {business.website || "www.ironwood-remodeling.com"}</span></footer>
  </main>;
}
