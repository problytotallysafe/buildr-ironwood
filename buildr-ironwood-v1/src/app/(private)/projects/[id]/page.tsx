import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronRight, Clock3, Pencil, Plus } from "lucide-react";

import { LaborVsActual } from "@/components/labor-vs-actual";
import { PageHeader } from "@/components/page-header";
import { ProjectMedia } from "@/components/project-media";
import { StatusPill } from "@/components/status-pill";
import { money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

async function updateProjectStatus(formData: FormData) {
  "use server";
  const projectId = String(formData.get("project_id") ?? "");
  const status = String(formData.get("status") ?? "");
  const allowedStatuses = ["scheduled", "in_progress", "waiting", "on_hold", "substantially_complete", "complete"];
  if (!projectId || !allowedStatuses.includes(status)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ status }).eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  redirect(`/projects/${projectId}#project-status`);
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select(`*,customers(first_name,last_name),estimates(id,estimate_number,title,total,project_address,scope,payment_schedule)`)
    .eq("id", id)
    .single();

  if (error) console.error("PROJECT LOAD ERROR:", error);
  if (!project) notFound();

  const customer = project.customers as any;
  const estimate = project.estimates as any;
  const estimateId = estimate?.id ?? null;

  const [{ data: mediaRows }, { data: laborItems }, { data: timeEntries }, { data: changeOrders }, { data: payments }] = await Promise.all([
    supabase
      .from("project_media")
      .select("id,storage_path,file_name,category,room_location,caption,customer_visible,created_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    estimateId
      ? supabase
          .from("estimate_items")
          .select("id,description,category,quantity,unit,unit_cost,markup_rate")
          .eq("estimate_id", estimateId)
          .eq("item_type", "labor")
          .order("sort_order")
      : Promise.resolve({ data: [] } as any),
    supabase
      .from("time_entries")
      .select("id,work_category,duration_minutes,ended_at,hourly_cost")
      .eq("project_id", id)
      .order("started_at", { ascending: true }),
    supabase
      .from("change_orders")
      .select("id,change_order_number,title,status,total,created_at,accepted_at")
      .eq("project_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("payments").select("id").eq("project_id", id),
  ]);

  const media = await Promise.all((mediaRows ?? []).map(async (item) => {
    const { data } = await supabase.storage.from("project-media").createSignedUrl(item.storage_path, 3600);
    return { ...item, signed_url: data?.signedUrl ?? null };
  }));

  const title = estimate?.title || project.name || "Project";
  const address = estimate?.project_address || null;
  const contractTotal = Number(project.contract_total ?? estimate?.total ?? 0);
  const amountPaid = Number(project.amount_paid ?? 0);
  const remaining = Math.max(0, contractTotal - amountPaid);
  const baseContract = Number(estimate?.total ?? contractTotal);
  const acceptedChangeOrders = (changeOrders ?? []).filter((co: any) => co.status === "accepted");
  const approvedChangesTotal = acceptedChangeOrders.reduce((sum: number, co: any) => sum + Number(co.total ?? 0), 0);
  const paymentCount = payments?.length ?? 0;

  return (
    <div className="page-wrap">
      <div className="project-detail-back">
        <Link href="/projects"><ArrowLeft size={16}/>Back to projects</Link>
      </div>

      <PageHeader
        eyebrow={estimate?.estimate_number || "Project"}
        title={title}
        description={
          customer
            ? `${customer.first_name} ${customer.last_name}${address ? ` • ${address}` : ""}`
            : address || "Accepted Ironwood project"
        }
      />

      <div style={{ display:"flex", gap:"12px", marginBottom:"18px" }}>
        <Link href={`/time?project=${project.id}`} className="button button--gold">
          <Clock3 size={17}/>Track Time
        </Link>
        <Link href={`/projects/${project.id}/edit`} className="button button--outline">
          <Pencil size={17}/>Edit Project
        </Link>
        <Link href={`/projects/${project.id}/change-orders/new`} className="button button--outline">
          <Plus size={17}/>Add Change Order
        </Link>
      </div>

      <section className="project-overview-grid">
        <Link className="panel project-overview-link" href="#project-status"><span className="project-overview-label">Status</span><div className="project-overview-value"><StatusPill value={project.status}/><ChevronRight size={18}/></div><small>View or change status</small></Link>
        <Link className="panel project-overview-link" href="#contract-details"><span className="project-overview-label">Contract</span><div className="project-overview-value"><strong className="project-overview-number">{money(contractTotal)}</strong><ChevronRight size={18}/></div><small>View contract details</small></Link>
        <Link className="panel project-overview-link" href={`/payments?project=${project.id}`}><span className="project-overview-label">Paid</span><div className="project-overview-value"><strong className="project-overview-number">{money(amountPaid)}</strong><ChevronRight size={18}/></div><small>{paymentCount ? `View ${paymentCount} payment${paymentCount === 1 ? "" : "s"}` : "Open payment log"}</small></Link>
        <Link className="panel project-overview-link" href={`/payments?project=${project.id}`}><span className="project-overview-label">Remaining</span><div className="project-overview-value"><strong className="project-overview-number">{money(remaining)}</strong><ChevronRight size={18}/></div><small>View payments and balance</small></Link>
      </section>

      <section id="project-status" className="panel project-linked-section">
        <div className="panel-heading"><div><h2>Project status</h2><p>Keep the job stage current so it is clear what needs attention next.</p></div><StatusPill value={project.status}/></div>
        <form action={updateProjectStatus} className="project-status-form">
          <input type="hidden" name="project_id" value={project.id}/>
          <label>Change status<select name="status" defaultValue={project.status}><option value="scheduled">Scheduled</option><option value="in_progress">In progress</option><option value="waiting">Waiting on customer, material, or trade</option><option value="on_hold">On hold</option><option value="substantially_complete">Substantially complete</option><option value="complete">Complete</option></select></label>
          <button className="button button--gold">Update status</button>
        </form>
      </section>

      <section id="contract-details" className="panel project-linked-section">
        <div className="panel-heading"><div><h2>Contract details</h2><p>The accepted base proposal plus approved project changes.</p></div>{estimateId && <Link href={`/estimates/${estimateId}`}>View accepted proposal <ChevronRight size={16}/></Link>}</div>
        <dl className="totals totals--right"><div><dt>Base contract</dt><dd>{money(baseContract)}</dd></div><div><dt>Approved change orders ({acceptedChangeOrders.length})</dt><dd>{money(approvedChangesTotal)}</dd></div><div className="grand"><dt>Current contract</dt><dd>{money(contractTotal)}</dd></div></dl>
      </section>

      <LaborVsActual laborItems={(laborItems ?? []) as any} timeEntries={(timeEntries ?? []) as any}/>

      <section className="panel project-change-orders">
        <div className="panel-heading"><div><h2>Change orders</h2><p>Project-linked scope changes with their own customer approval trail.</p></div><Link href={`/projects/${project.id}/change-orders/new`} className="button button--gold"><Plus size={16}/>New change order</Link></div>
        <div className="table-wrap"><table><thead><tr><th>Change order</th><th>Status</th><th>Date</th><th>Price change</th></tr></thead><tbody>{(changeOrders??[]).map((co:any)=><tr key={co.id}><td><Link className="table-link" href={`/change-orders/${co.id}`}>{co.change_order_number}<small>{co.title}</small></Link></td><td><StatusPill value={co.status}/></td><td>{new Date(co.created_at).toLocaleDateString()}</td><td>{money(co.total)}</td></tr>)}{!changeOrders?.length&&<tr><td colSpan={4} className="empty-cell">No change orders for this project.</td></tr>}</tbody></table></div>
      </section>

      {(estimate?.scope || estimate?.payment_schedule) && (
        <section className="panel project-detail-info">
          {estimate?.scope && <div><h2>Scope</h2><p className="pre-line">{estimate.scope}</p></div>}
          {estimate?.payment_schedule && <div><h2>Payment schedule</h2><p className="pre-line">{estimate.payment_schedule}</p></div>}
        </section>
      )}

      <ProjectMedia projectId={project.id} estimateId={estimateId} initialMedia={media}/>
    </div>
  );
}
