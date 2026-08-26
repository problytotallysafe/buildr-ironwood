import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).single(); if (!lead) notFound();
  async function update(formData: FormData) { "use server"; const client = await createClient(); await client.from("leads").update({ status: String(formData.get("status")) }).eq("id", id); revalidatePath("/leads"); redirect("/leads"); }
  return <div className="page-wrap page-wrap--narrow"><PageHeader eyebrow="Website lead" title={`${lead.first_name} ${lead.last_name || ""}`} description={`Received ${new Date(lead.created_at).toLocaleString()}`}/><section className="panel stack"><dl className="details"><div><dt>Phone</dt><dd>{lead.phone || "—"}</dd></div><div><dt>Email</dt><dd>{lead.email || "—"}</dd></div><div><dt>Project</dt><dd>{lead.project_type || "—"}</dd></div><div><dt>Message</dt><dd>{lead.message || "—"}</dd></div></dl><form action={update} className="button-row"><select name="status" defaultValue={lead.status}><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="converted">Converted</option><option value="closed">Closed</option></select><button className="button button--gold">Save status</button></form></section></div>;
}
