import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Archive, ClipboardList, FilePlus2, Mail, Phone, Trash2, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { leadCategories, leadPriorities, leadStatuses } from "@/lib/leads";
import { createClient } from "@/lib/supabase/server";

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).single();
  if (!lead) notFound();

  async function update(formData: FormData) {
    "use server";
    const client = await createClient();
    const status = String(formData.get("status") ?? "new");
    const values = {
      status,
      category: String(formData.get("category") ?? "uncategorized"),
      priority: String(formData.get("priority") ?? "normal"),
      project_type: String(formData.get("project_type") ?? "").trim() || null,
      notes: String(formData.get("notes") ?? "").trim() || null,
      last_contacted_at: status === "new" ? lead.last_contacted_at : lead.last_contacted_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { error } = await client.from("leads").update(values).eq("id", id);
    if (error) throw new Error(error.message);
    if (status !== "new") {
      await client.from("notifications").update({ read_at: new Date().toISOString() }).eq("href", `/leads/${id}`).is("read_at", null);
    }
    revalidatePath(`/leads/${id}`);
    revalidatePath("/leads");
    revalidatePath("/notifications");
  }

  async function move(formData: FormData) {
    "use server";
    const client = await createClient();
    const action = String(formData.get("action") ?? "");
    if (action === "archive") {
      await client.from("leads").update({ archived_at: new Date().toISOString(), deleted_at: null }).eq("id", id);
      await client.from("notifications").update({ read_at: new Date().toISOString() }).eq("href", `/leads/${id}`).is("read_at", null);
      redirect("/leads?view=archived");
    }
    await client.from("leads").update({ deleted_at: new Date().toISOString(), archived_at: null }).eq("id", id);
    await client.from("notifications").update({ read_at: new Date().toISOString() }).eq("href", `/leads/${id}`).is("read_at", null);
    redirect("/leads?view=trash");
  }

  async function convertToCustomer(formData: FormData) {
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
        notes: [
          `Converted from ${lead.source || "website"} lead.`,
          lead.project_type ? `Project: ${lead.project_type}` : "",
          lead.message || "",
          lead.notes || "",
        ].filter(Boolean).join("\n"),
      }).select("id").single();
      if (error) throw new Error(error.message);
      customerId = created.id;
    }
    await client.from("leads").update({ status: "converted", archived_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", id);
    await client.from("notifications").update({ read_at: new Date().toISOString() }).eq("href", `/leads/${id}`).is("read_at", null);
    revalidatePath("/leads");
    const next = String(formData.get("next") || "customer");
    if (next === "site_visit") redirect(`/site-visits/new?customer=${customerId}`);
    if (next === "estimate") redirect(`/estimates/new?customer=${customerId}`);
    redirect(`/customers/${customerId}`);
  }

  return (
    <div className="page-wrap page-wrap--narrow">
      <PageHeader
        eyebrow={`${lead.source || "Lead"} · ${new Date(lead.created_at).toLocaleString()}`}
        title={`${lead.first_name} ${lead.last_name || ""}`}
        actions={<form action={convertToCustomer} className="button-row"><button name="next" value="customer" className="button button--gold"><UserPlus size={16}/>Add as customer</button><button name="next" value="site_visit" className="button button--outline"><ClipboardList size={16}/>Add & site visit</button><button name="next" value="estimate" className="button button--outline"><FilePlus2 size={16}/>Add & estimate</button></form>}
      />

      <section className="panel stack">
        <div className="lead-contact-actions">
          {lead.phone && <a className="button button--outline" href={`tel:${lead.phone}`}><Phone size={16} />Call</a>}
          {lead.phone && <a className="button button--outline" href={`sms:${lead.phone}`}><Phone size={16} />Text</a>}
          {lead.email && <a className="button button--outline" href={`mailto:${lead.email}`}><Mail size={16} />Email</a>}
        </div>

        <dl className="details">
          <div><dt>Phone</dt><dd>{lead.phone || "—"}</dd></div>
          <div><dt>Email</dt><dd>{lead.email || "—"}</dd></div>
          <div><dt>Message</dt><dd>{lead.message || "—"}</dd></div>
          {lead.last_contacted_at && <div><dt>Last contacted</dt><dd>{new Date(lead.last_contacted_at).toLocaleString()}</dd></div>}
        </dl>

        <form action={update} className="form-grid">
          <label>Status<select name="status" defaultValue={lead.status}>{leadStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Priority<select name="priority" defaultValue={lead.priority || "normal"}>{leadPriorities.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Category<select name="category" defaultValue={lead.category || "uncategorized"}>{leadCategories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Project type<input name="project_type" defaultValue={lead.project_type || ""} /></label>
          <label className="span-2">Lead notes<textarea name="notes" rows={5} defaultValue={lead.notes || ""} placeholder="Follow-up details, budget, timing, and next step" /></label>
          <div className="form-actions span-2"><button className="button button--gold">Save lead</button></div>
        </form>

        <form action={move} className="lead-danger-actions">
          <button name="action" value="archive" className="button button--outline"><Archive size={16} />Archive</button>
          <button name="action" value="delete" className="button button--danger"><Trash2 size={16} />Move to trash</button>
        </form>
      </section>
    </div>
  );
}
