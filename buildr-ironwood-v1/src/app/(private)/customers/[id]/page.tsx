import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { canManageSettings, getBusinessAccess } from "@/lib/business-access";
import { money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

async function setCustomerDeleted(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const access = await getBusinessAccess(supabase);
  if (!access || !canManageSettings(access)) redirect("/customers");
  const id = String(formData.get("id") || "");
  const restore = String(formData.get("restore") || "") === "1";
  if (!id) redirect("/customers");
  await supabase.from("customers").update({ deleted_at: restore ? null : new Date().toISOString() }).eq("id", id).eq("owner_id", access.ownerId);
  revalidatePath("/customers");
  revalidatePath(`/customers/${id}`);
  redirect(restore ? `/customers/${id}` : "/customers");
}

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const access = await getBusinessAccess(supabase);
  const [{ data: customer }, { data: estimates }, { data: projects }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", id).single(),
    supabase.from("estimates").select("id,estimate_number,title,status,total,created_at").eq("customer_id", id).order("created_at", { ascending: false }),
    supabase.from("projects").select("id,name,status,contract_total,amount_paid,created_at,estimates(estimate_number,title,total)").eq("customer_id", id).order("created_at", { ascending: false }),
  ]);
  if (!customer) notFound();
  const canManage = Boolean(access && canManageSettings(access));

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow={customer.deleted_at ? "Deleted customer record" : "Customer record"}
        title={`${customer.first_name} ${customer.last_name}`}
        description={customer.company_name || "Ironwood Remodeling customer"}
        actions={<div className="button-row">
          {!customer.deleted_at && <Link className="button button--outline" href={`/customers/${customer.id}/edit`}>Edit customer</Link>}
          {!customer.deleted_at && <Link className="button button--outline" href={`/site-visits/new?customer=${customer.id}`}>Site visit</Link>}
          {!customer.deleted_at && <Link className="button button--outline" href={`/independence/new?customer=${customer.id}`}>Independence review</Link>}
          {!customer.deleted_at && <Link className="button button--gold" href={`/estimates/new?customer=${customer.id}`}>+ New estimate</Link>}
          {canManage && <form action={setCustomerDeleted}>
            <input type="hidden" name="id" value={customer.id} />
            {customer.deleted_at && <input type="hidden" name="restore" value="1" />}
            <button className="button button--outline" type="submit">{customer.deleted_at ? "Restore customer" : "Delete customer"}</button>
          </form>}
        </div>}
      />

      {customer.deleted_at && <p className="settings-warning"><strong>This customer is deleted.</strong> The record is preserved so project, estimate, payment, and warranty history are not destroyed.</p>}

      <div className="detail-grid">
        <section className="panel"><h2>Contact & property</h2><dl className="details">
          <div><dt>Phone</dt><dd>{customer.phone || "—"}</dd></div>
          <div><dt>Email</dt><dd>{customer.email || "—"}</dd></div>
          <div><dt>Address</dt><dd>{[customer.address_line1, customer.address_line2, customer.city, customer.state, customer.postal_code].filter(Boolean).join(", ") || "—"}</dd></div>
          <div><dt>Private notes</dt><dd>{customer.notes || "—"}</dd></div>
        </dl></section>

        <section className="panel"><h2>Estimate history</h2><div className="record-list">
          {(estimates ?? []).map((estimate: any) => <Link href={`/estimates/${estimate.id}`} key={estimate.id}><div><strong>{estimate.estimate_number}</strong><span>{estimate.title}</span></div><StatusPill value={estimate.status} /><b>{money(estimate.total)}</b></Link>)}
          {!estimates?.length && <p className="muted">No estimates yet.</p>}
        </div></section>
      </div>

      <section className="panel customer-project-history">
        <div className="panel-heading"><div><h2>Project history</h2><p>Open any accepted job and continue its work, billing, or closeout.</p></div><Link href="/projects" className="button button--outline">All projects</Link></div>
        <div className="record-list">
          {(projects ?? []).map((project: any) => {
            const total = Number(project.contract_total ?? project.estimates?.total ?? 0);
            const balance = Math.max(0, total - Number(project.amount_paid ?? 0));
            const status = project.status === "complete" && balance > 0.005 ? "complete_awaiting_payment" : project.status;
            return <Link href={`/projects/${project.id}`} key={project.id}><div><strong>{project.estimates?.title || project.name || "Project"}</strong><span>{project.estimates?.estimate_number || "Project record"}{balance > 0.005 ? ` · ${money(balance)} remaining` : " · Paid in full"}</span></div><StatusPill value={status} /><b>{money(total)}</b></Link>;
          })}
          {!projects?.length && <p className="muted">No projects yet. Accepted estimates automatically appear here.</p>}
        </div>
      </section>
    </div>
  );
}
