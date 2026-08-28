import Link from "next/link";
import { EstimateActions } from "@/components/estimate-actions";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export default async function ArchivedEstimatesPage(){
 const supabase=await createClient();
 const {data}=await supabase.from("estimates").select("id,estimate_number,title,status,total,archived_at,customers(first_name,last_name)").not("archived_at","is",null).is("deleted_at",null).order("archived_at",{ascending:false});
 return <div className="page-wrap"><PageHeader eyebrow="Estimate storage" title="Archived estimates" actions={<Link className="button button--outline" href="/estimates">Back to estimates</Link>}/>
 <section className="panel"><div className="table-wrap"><table><thead><tr><th>Estimate</th><th>Customer</th><th>Status</th><th>Archived</th><th>Total</th><th>Manage</th></tr></thead>
 <tbody>{(data??[]).map((e:any)=><tr key={e.id}><td><Link className="table-link" href={`/estimates/${e.id}`}>{e.estimate_number}<small>{e.title}</small></Link></td><td>{e.customers?`${e.customers.first_name} ${e.customers.last_name}`:"—"}</td><td><StatusPill value={e.status}/></td><td>{e.archived_at?new Date(e.archived_at).toLocaleDateString():"—"}</td><td>{money(e.total)}</td><td><EstimateActions estimateId={e.id} estimateNumber={e.estimate_number} status={e.status} archived/></td></tr>)}
 {!data?.length&&<tr><td colSpan={6} className="empty-cell">No archived estimates.</td></tr>}</tbody></table></div></section></div>;
}
