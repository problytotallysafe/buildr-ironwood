import Link from "next/link";
import { EstimateActions } from "@/components/estimate-actions";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export default async function EstimatesPage(){
 const supabase=await createClient();
 const {data}=await supabase.from("estimates").select("id,estimate_number,title,status,total,created_at,last_viewed_at,view_count,customers(first_name,last_name)").is("archived_at",null).is("deleted_at",null).order("created_at",{ascending:false});
 return <div className="page-wrap"><PageHeader eyebrow="Proposals & bids" title="Estimates" description="Write detailed scopes, price every line, send professional proposals, and track customer activity." actions={<div className="button-row"><Link className="button button--outline" href="/estimates/archived">Archived estimates</Link><Link className="button button--gold" href="/estimates/new">+ New estimate</Link></div>}/>
 <section className="panel"><div className="table-wrap"><table><thead><tr><th>Estimate</th><th>Customer</th><th>Status</th><th>Views</th><th>Total</th><th>Manage</th></tr></thead>
 <tbody>{(data??[]).map((e:any)=><tr key={e.id}><td><Link className="table-link" href={`/estimates/${e.id}`}>{e.estimate_number}<small>{e.title}</small></Link></td><td>{e.customers?`${e.customers.first_name} ${e.customers.last_name}`:"—"}</td><td><StatusPill value={e.status}/></td><td>{e.view_count??0}<small>{e.last_viewed_at?`Last ${new Date(e.last_viewed_at).toLocaleDateString()}`:"Not viewed"}</small></td><td>{money(e.total)}</td><td><EstimateActions estimateId={e.id} estimateNumber={e.estimate_number} status={e.status}/></td></tr>)}
 {!data?.length&&<tr><td colSpan={6} className="empty-cell">No active estimates.</td></tr>}</tbody></table></div></section></div>;
}
