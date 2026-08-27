import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).single();
  if (!lead) notFound();

  async function update(formData: FormData) {
    "use server";
    const client = await createClient();
    await client.from("leads").update({ status: String(formData.get("status")) }).eq("id", id);
    revalidatePath("/leads");
    redirect("/leads");
  }

  async function convertToCustomer() {
    "use server";
    const client = await createClient();
    const { data: { user } } = await client.auth.getUser();
    if (!user) return;
    let existing: { id: string } | null = null;
    if (lead.email) existing = (await client.from("customers").select("id").eq("email", lead.email).limit(1).maybeSingle()).data;
    if (!existing && lead.phone) existing = (await client.from("customers").select("id").eq("phone", lead.phone).limit(1).maybeSingle()).data;
    let customerId = existing?.id;
    if (!customerId) {
      const { data: created, error } = await client.from("customers").insert({
        owner_id: user.id,
        first_name: lead.first_name,
        last_name: lead.last_name || "—",
        email: lead.email || null,
        phone: lead.phone || null,
        notes: [`Converted from ${lead.source || "website"} lead.`, lead.project_type ? `Project: ${lead.project_type}` : "", lead.message || ""].filter(Boolean).join("\n"),
      }).select("id").single();
      if (error) throw new Error(error.message);
      customerId = created.id;
    }
    await client.from("leads").update({ status: "converted" }).eq("id", id);
    revalidatePath("/leads");
    redirect(`/customers/${customerId}`);
  }

  return <div className="page-wrap page-wrap--narrow">
    <PageHeader eyebrow="Website lead" title={`${lead.first_name} ${lead.last_name || ""}`} description={`Received ${new Date(lead.created_at).toLocaleString()}`} actions={<form action={convertToCustomer}><button className="button button--gold">Add as customer</button></form>}/>
    <section className="panel stack">
      <dl className="details"><div><dt>Phone</dt><dd>{lead.phone || "—"}</dd></div><div><dt>Email</dt><dd>{lead.email || "—"}</dd></div><div><dt>Project</dt><dd>{lead.project_type || "—"}</dd></div><div><dt>Message</dt><dd>{lead.message || "—"}</dd></div></dl>
      <form action={update} className="button-row"><select name="status" defaultValue={lead.status}><option value="new">New</option><option value="contacted">Contacted</option><option value="qualified">Qualified</option><option value="converted">Converted</option><option value="closed">Closed</option></select><button className="button button--outline">Save status</button><Link className="button button--outline" href="/intake">Open client intake</Link></form>
    </section>
  </div>;
}
