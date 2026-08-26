import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Pencil } from "lucide-react";
import { AcceptanceEvidence } from "@/components/acceptance-evidence";
import { EstimateActions } from "@/components/estimate-actions";
import { EstimateRevisionComparison } from "@/components/estimate-revision-comparison";
import { OfflineAcceptance } from "@/components/offline-acceptance";
import { PageHeader } from "@/components/page-header";
import { SendEstimateButton } from "@/components/send-estimate-button";
import { StatusPill } from "@/components/status-pill";
import { TextEstimateButton } from "@/components/text-estimate-button";
import { getEstimateSendWarnings } from "@/lib/estimate-readiness";
import { money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export default async function EstimatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: estimate }, { data: items }, { data: milestones }, { data: events }, { data: revisions }, { data: evidenceRows }] = await Promise.all([
    supabase.from("estimates").select("*,customers(*)").eq("id", id).single(),
    supabase.from("estimate_items").select("*").eq("estimate_id", id).order("sort_order"),
    supabase.from("estimate_payment_milestones").select("*").eq("estimate_id", id).order("sort_order"),
    supabase.from("estimate_events").select("*").eq("estimate_id", id).order("created_at", { ascending: false }).limit(20),
    supabase.from("estimate_revisions").select("id,revision_number,reason,prior_status,prior_accepted_at,prior_accepted_by_name,created_at,estimate_snapshot,items_snapshot").eq("estimate_id", id).order("revision_number", { ascending: false }),
    supabase.from("estimate_acceptance_evidence").select("*").eq("estimate_id", id).order("created_at", { ascending: false }),
  ]);
  if (!estimate) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const link = `${appUrl}/p/${estimate.public_token}`;
  const sendWarnings = getEstimateSendWarnings(estimate, items ?? []);
  const selectionItems = (items ?? []).filter((item: any) => item.selection_status && item.selection_status !== "final");
  const evidence = await Promise.all((evidenceRows ?? []).map(async (row: any) => {
    if (!row.storage_path) return { ...row, signed_url: null };
    const { data } = await supabase.storage.from("acceptance-evidence").createSignedUrl(row.storage_path, 3600);
    return { ...row, signed_url: data?.signedUrl ?? null };
  }));

  return <div className="page-wrap">
    <PageHeader eyebrow={`${estimate.estimate_number}${estimate.revision_number ? ` • Revision ${estimate.revision_number}` : ""}`} title={estimate.title} description={`${estimate.customers?.first_name ?? ""} ${estimate.customers?.last_name ?? ""}`} actions={<div className="button-row"><Link href={`/estimates/${id}/edit`} className="button button--outline"><Pencil size={15}/>Edit</Link><EstimateActions estimateId={id} estimateNumber={estimate.estimate_number} status={estimate.status} redirectAfterDelete/><a href={link} target="_blank" rel="noreferrer" className="button button--outline">Preview <ExternalLink size={15}/></a><TextEstimateButton id={id} disabled={!estimate.customers?.phone || estimate.status === "accepted"} warnings={sendWarnings}/><SendEstimateButton id={id} disabled={!estimate.customers?.email || estimate.status === "accepted"} warnings={sendWarnings}/></div>}/>
    <div className="detail-grid detail-grid--wide">
      <div className="stack">
        <section className="panel"><div className="panel-heading"><div><h2>Estimate</h2><StatusPill value={estimate.status}/></div><strong className="big-total">{money(estimate.total)}</strong></div><div className="table-wrap"><table><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Customer price</th></tr></thead><tbody>{(items ?? []).map((item: any) => <tr key={item.id}><td>{item.description}<small>{[item.category, item.vendor, item.vendor_sku].filter(Boolean).join(" · ")}</small></td><td>{item.quantity}</td><td>{item.unit}</td><td>{money(item.line_total)}</td></tr>)}</tbody></table></div><dl className="totals totals--right"><div><dt>Base cost</dt><dd>{money(estimate.subtotal)}</dd></div><div><dt>Markup</dt><dd>{money(estimate.markup_total)}</dd></div><div><dt>Tax</dt><dd>{money(estimate.tax_total)}</dd></div><div className="grand"><dt>Total</dt><dd>{money(estimate.total)}</dd></div></dl></section>
        {selectionItems.length > 0 && <section className="panel"><div className="panel-heading"><div><h2>Selections & allowances</h2><p>Open decisions and responsibilities that follow this estimate into the project.</p></div><strong>{selectionItems.length} item{selectionItems.length === 1 ? "" : "s"}</strong></div><div className="selection-card-list">{selectionItems.map((item: any) => <article key={item.id}><div><strong>{item.description}</strong><span>{String(item.selection_status).replaceAll("_", " ")}</span></div>{item.selection_status === "allowance" && <b>{money(item.line_total)} allowance</b>}<small>{[item.selection_responsibility === "customer" ? "Customer responsible" : "Ironwood responsible", item.selected_product, item.selection_deadline ? `Decide by ${new Date(`${item.selection_deadline}T12:00:00`).toLocaleDateString()}` : null, item.selection_notes].filter(Boolean).join(" · ")}</small></article>)}</div></section>}
        {(milestones ?? []).length > 0 && <section className="panel"><h2>Payment milestones</h2><div className="payment-milestone-summary">{milestones?.map((milestone: any) => { const amount = milestone.amount_type === "percentage" ? Number(estimate.total) * Number(milestone.amount_value) / 100 : Number(milestone.amount_value); return <article key={milestone.id}><div><strong>{milestone.title}</strong><b>{money(amount)}</b></div><small>{milestone.amount_type === "percentage" ? `${milestone.amount_value}%` : "Fixed amount"}{milestone.due_trigger ? ` · ${milestone.due_trigger}` : ""}</small></article>; })}</div></section>}
        <section className="panel proposal-copy"><h2>Proposal content</h2><h3>Scope of work</h3><p>{estimate.scope || "No scope entered."}</p><h3>Exclusions / owner-supplied</h3><p>{estimate.exclusions || "None listed."}</p><h3>Payment schedule</h3><p>{estimate.payment_schedule || "Not entered."}</p><h3>Customer notes</h3><p>{estimate.customer_notes || "None."}</p></section>
        <EstimateRevisionComparison currentEstimate={estimate} currentItems={items ?? []} revisions={(revisions ?? []) as any}/>
        <AcceptanceEvidence estimateId={id} revisionNumber={Number(estimate.revision_number ?? 0)} initialEvidence={evidence as any}/>
      </div>
      <aside className="stack">
        <section className="panel"><h2>Customer activity</h2><dl className="details"><div><dt>Email</dt><dd>{estimate.customers?.email || "No email on file"}</dd></div><div><dt>Mobile</dt><dd>{estimate.customers?.phone || "No mobile number on file"}</dd></div><div><dt>Sent</dt><dd>{estimate.sent_at ? new Date(estimate.sent_at).toLocaleString() : "Not sent"}</dd></div><div><dt>Views</dt><dd>{estimate.view_count ?? 0}</dd></div><div><dt>Last viewed</dt><dd>{estimate.last_viewed_at ? new Date(estimate.last_viewed_at).toLocaleString() : "Not viewed"}</dd></div><div><dt>Accepted</dt><dd>{estimate.accepted_at ? `${new Date(estimate.accepted_at).toLocaleString()} by ${estimate.accepted_by_name}` : "Not accepted"}{estimate.acceptance_method && <small>{estimate.acceptance_method.replaceAll("_", " ")}</small>}</dd></div></dl><label>Proposal link<input readOnly value={link}/></label><div className="offline-acceptance-wrap"><OfflineAcceptance estimateId={id} customerName={`${estimate.customers?.first_name ?? ""} ${estimate.customers?.last_name ?? ""}`.trim()} disabled={estimate.status === "accepted"}/></div></section>
        <section className="panel"><h2>Revision audit trail</h2>{(revisions ?? []).map((revision: any) => <article className="revision-entry" key={revision.id}><strong>Revision {revision.revision_number}</strong><span>Preserved {revision.prior_status} version • {new Date(revision.created_at).toLocaleString()}</span>{revision.prior_accepted_at && <small>Previously accepted {new Date(revision.prior_accepted_at).toLocaleString()} by {revision.prior_accepted_by_name}</small>}<p>{revision.reason || "No revision reason entered."}</p><b>{money(revision.estimate_snapshot?.total ?? 0)}</b></article>)}{!revisions?.length && <p className="muted">Original version—no revisions yet.</p>}</section>
        <section className="panel"><h2>Timeline</h2><div className="timeline">{(events ?? []).map((event: any) => <div key={event.id}><span></span><p><strong>{event.event_type.replaceAll("_", " ")}</strong><small>{new Date(event.created_at).toLocaleString()}</small></p></div>)}{!events?.length && <p className="muted">No activity yet.</p>}</div></section>
        <section className="panel private-card"><h2>Private Ironwood notes</h2><p>{estimate.private_notes || "No private notes."}</p></section>
      </aside>
    </div>
  </div>;
}
