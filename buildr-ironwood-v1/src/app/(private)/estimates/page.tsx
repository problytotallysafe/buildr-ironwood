import Link from "next/link";
import { EstimateActions } from "@/components/estimate-actions";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

const estimateFilters = [
 { value: "current", label: "Current — waiting to send or approve" },
 { value: "pending", label: "Pending customer approval" },
 { value: "draft", label: "Draft — waiting to send" },
 { value: "accepted", label: "Accepted" },
 { value: "declined", label: "Declined / expired" },
 { value: "archived", label: "Archived" },
 { value: "all", label: "See all" },
];

export default async function EstimatesPage({searchParams}:{searchParams:Promise<{status?:string}>}){
 const query=await searchParams;
 const filter=estimateFilters.some((item)=>item.value===query.status)?query.status!:"current";
 const supabase=await createClient();
 let request=supabase.from("estimates").select("id,estimate_number,title,status,total,created_at,last_viewed_at,view_count,archived_at,customers(first_name,last_name)").is("deleted_at",null).order("created_at",{ascending:false});
 if(filter==="current") request=request.is("archived_at",null).in("status",["draft","sent","viewed"]);
 if(filter==="pending") request=request.is("archived_at",null).in("status",["sent","viewed"]);
 if(filter==="draft") request=request.is("archived_at",null).eq("status","draft");
 if(filter==="accepted") request=request.is("archived_at",null).eq("status","accepted");
 if(filter==="declined") request=request.is("archived_at",null).in("status",["declined","expired"]);
 if(filter==="archived") request=request.not("archived_at","is",null);
 const {data}=await request;
 return <div className="page-wrap"><PageHeader eyebrow="Proposals & bids" title="Estimates" description="Current estimates stay focused on work waiting to be sent or approved. Accepted work continues under Projects." actions={<div className="button-row"><Link className="button button--outline" href="/estimates/deleted">Trash</Link><Link className="button button--gold" href="/estimates/new">+ New estimate</Link></div>}/>
 <section className="panel list-filter-bar"><form method="get" className="button-row"><label>Show<select name="status" defaultValue={filter}>{estimateFilters.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label><button className="button button--outline">Apply</button></form><small>{data?.length??0} estimate{data?.length===1?"":"s"}</small></section>
 <section className="panel"><div className="table-wrap"><table><thead><tr><th>Estimate</th><th>Customer</th><th>Status</th><th>Views</th><th>Total</th><th>Manage</th></tr></thead>
 <tbody>{(data??[]).map((e:any)=><tr key={e.id}><td><Link className="table-link" href={`/estimates/${e.id}`}>{e.estimate_number}<small>{e.title}</small></Link></td><td>{e.customers?`${e.customers.first_name} ${e.customers.last_name}`:"—"}</td><td><StatusPill value={e.status}/></td><td>{e.view_count??0}<small>{e.last_viewed_at?`Last ${new Date(e.last_viewed_at).toLocaleDateString()}`:"Not viewed"}</small></td><td>{money(e.total)}</td><td><EstimateActions estimateId={e.id} estimateNumber={e.estimate_number} status={e.status}/></td></tr>)}
 {!data?.length&&<tr><td colSpan={6} className="empty-cell">No estimates match this view.</td></tr>}</tbody></table></div></section></div>;
}
