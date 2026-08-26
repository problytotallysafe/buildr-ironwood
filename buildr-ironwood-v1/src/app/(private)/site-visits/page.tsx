import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { createClient } from "@/lib/supabase/server";

export default async function SiteVisitsPage() {
  const supabase = await createClient();
  const { data: worksheets } = await supabase.from("site_visit_worksheets").select("id,visit_date,project_type,status,updated_at,customers(first_name,last_name),projects(name),estimates(estimate_number,title)").order("visit_date", { ascending: false });
  return <div className="page-wrap"><PageHeader eyebrow="Before the estimate" title="Site visit worksheets" description="Capture the details in the home while they are fresh, then return later to finish the estimate without relying on memory." actions={<Link href="/site-visits/new" className="button button--gold"><Plus size={16}/>New site visit</Link>}/><section className="panel"><div className="table-wrap"><table><thead><tr><th>Visit</th><th>Customer / job</th><th>Type</th><th>Status</th><th></th></tr></thead><tbody>{(worksheets ?? []).map((worksheet: any) => <tr key={worksheet.id}><td>{new Date(`${worksheet.visit_date}T12:00:00`).toLocaleDateString()}</td><td><strong>{worksheet.customers?.first_name} {worksheet.customers?.last_name}</strong><small>{worksheet.projects?.name || worksheet.estimates?.title || "Not linked to a job yet"}</small></td><td>{worksheet.project_type || "Not entered"}</td><td><StatusPill value={worksheet.status}/></td><td><Link className="button button--outline button--small" href={`/site-visits/${worksheet.id}/edit`}><ClipboardList size={15}/>Open worksheet</Link></td></tr>)}{!worksheets?.length && <tr><td colSpan={5} className="empty-cell">No site visits yet. Start one before your next walkthrough.</td></tr>}</tbody></table></div></section></div>;
}
