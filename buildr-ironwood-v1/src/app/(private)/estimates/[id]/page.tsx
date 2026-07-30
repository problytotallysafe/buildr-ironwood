import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SendEstimateButton } from "@/components/send-estimate-button";
import { StatusPill } from "@/components/status-pill";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/money";

export default async function EstimatePage({params}:{params:Promise<{id:string}>}){
 const {id}=await params; const supabase=await createClient(); const [{data:e},{data:items},{data:events}]=await Promise.all([supabase.from("estimates").select("*,customers(*)").eq("id",id).single(),supabase.from("estimate_items").select("*").eq("estimate_id",id).order("sort_order"),supabase.from("estimate_events").select("*").eq("estimate_id",id).order("created_at",{ascending:false}).limit(20)]); if(!e)notFound();
 const appUrl=process.env.NEXT_PUBLIC_APP_URL||"http://localhost:3000"; const link=`${appUrl}/p/${e.public_token}`;
 return <div className="page-wrap"><PageHeader eyebrow={e.estimate_number} title={e.title} description={`${e.customers?.first_name??""} ${e.customers?.last_name??""}`} actions={<div className="button-row"><a href={link} target="_blank" className="button button--outline">Preview <ExternalLink size={15}/></a><SendEstimateButton id={id} disabled={!e.customers?.email}/></div>}/>
 <div className="detail-grid detail-grid--wide"><div className="stack"><section className="panel"><div className="panel-heading"><div><h2>Estimate</h2><StatusPill value={e.status}/></div><strong className="big-total">{money(e.total)}</strong></div><div className="table-wrap"><table><thead><tr><th>Description</th><th>Qty</th><th>Unit</th><th>Customer price</th></tr></thead><tbody>{(items??[]).map((i:any)=><tr key={i.id}><td>{i.description}<small>{[i.category,i.vendor,i.vendor_sku].filter(Boolean).join(" · ")}</small></td><td>{i.quantity}</td><td>{i.unit}</td><td>{money(i.line_total)}</td></tr>)}</tbody></table></div><dl className="totals totals--right"><div><dt>Base cost</dt><dd>{money(e.subtotal)}</dd></div><div><dt>Markup</dt><dd>{money(e.markup_total)}</dd></div><div><dt>Tax</dt><dd>{money(e.tax_total)}</dd></div><div className="grand"><dt>Total</dt><dd>{money(e.total)}</dd></div></dl></section>
 <section className="panel proposal-copy"><h2>Proposal content</h2><h3>Scope of work</h3><p>{e.scope||"No scope entered."}</p><h3>Exclusions / owner-supplied</h3><p>{e.exclusions||"None listed."}</p><h3>Payment schedule</h3><p>{e.payment_schedule||"Not entered."}</p><h3>Customer notes</h3><p>{e.customer_notes||"None."}</p></section></div>
 <aside className="stack"><section className="panel"><h2>Customer activity</h2><dl className="details"><div><dt>Email</dt><dd>{e.customers?.email||"No email on file"}</dd></div><div><dt>Sent</dt><dd>{e.sent_at?new Date(e.sent_at).toLocaleString():"Not sent"}</dd></div><div><dt>Views</dt><dd>{e.view_count??0}</dd></div><div><dt>Last viewed</dt><dd>{e.last_viewed_at?new Date(e.last_viewed_at).toLocaleString():"Not viewed"}</dd></div><div><dt>Accepted</dt><dd>{e.accepted_at?`${new Date(e.accepted_at).toLocaleString()} by ${e.accepted_by_name}`:"Not accepted"}</dd></div></dl><label>Proposal link<input readOnly value={link}/></label></section>
 <section className="panel"><h2>Timeline</h2><div className="timeline">{(events??[]).map((event:any)=><div key={event.id}><span></span><p><strong>{event.event_type.replaceAll("_"," ")}</strong><small>{new Date(event.created_at).toLocaleString()}</small></p></div>)}{!events?.length&&<p className="muted">No activity yet.</p>}</div></section>
 <section className="panel private-card"><h2>Private Ironwood notes</h2><p>{e.private_notes||"No private notes."}</p></section></aside></div></div>;
}
