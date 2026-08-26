import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { createClient } from "@/lib/supabase/server";

export default async function LeadsPage() {
  const supabase = await createClient();
  const { data: leads } = await supabase.from("leads").select("id,first_name,last_name,email,phone,project_type,status,source,created_at").order("created_at", { ascending: false });
  return <div className="page-wrap"><PageHeader eyebrow="Lead inbox" title="New opportunities" description="Website inquiries land here automatically so every homeowner gets a timely response."/><section className="panel"><div className="table-wrap"><table><thead><tr><th>Homeowner</th><th>Project</th><th>Contact</th><th>Status</th><th>Received</th></tr></thead><tbody>
    {(leads ?? []).map((lead) => <tr key={lead.id}><td><Link className="table-link" href={`/leads/${lead.id}`}>{lead.first_name} {lead.last_name || ""}<small>{lead.source}</small></Link></td><td>{lead.project_type || "—"}</td><td>{lead.phone || lead.email || "—"}</td><td><StatusPill value={lead.status}/></td><td>{new Date(lead.created_at).toLocaleDateString()}</td></tr>)}
    {!leads?.length && <tr><td colSpan={5} className="empty-cell">Website leads will appear here.</td></tr>}
  </tbody></table></div></section></div>;
}
