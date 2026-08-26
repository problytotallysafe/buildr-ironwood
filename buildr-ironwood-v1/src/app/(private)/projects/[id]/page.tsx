import Link from "next/link";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { ArrowLeft, ChevronRight, Clock3, CreditCard, FileText, Pencil, Plus } from "lucide-react";

import { LaborVsActual } from "@/components/labor-vs-actual";
import { PageHeader } from "@/components/page-header";
import { ProjectMedia } from "@/components/project-media";
import { ProjectCloseout } from "@/components/project-closeout";
import { StatusPill } from "@/components/status-pill";
import { money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

async function updateProjectStatus(formData: FormData) {
  "use server";
  const projectId = String(formData.get("project_id") || "");
  const status = String(formData.get("status") || "");
  const allowedStatuses = ["scheduled", "in_progress", "waiting", "substantially_complete", "complete", "on_hold"];
  if (!projectId || !allowedStatuses.includes(status)) return;
  const supabase = await createClient();
  const { error } = await supabase.from("projects").update({ status }).eq("id", projectId);
  if (error) throw new Error(error.message);
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  revalidatePath("/dashboard");
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

  const [{ data: mediaRows }, { data: laborItems }, { data: paymentMilestones }, { data: selectionItems }, { data: timeEntries }, { data: changeOrders }, { data: payments }, { data: closeout }, { data: punchItems }] = await Promise.all([
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
    estimateId
      ? supabase
          .from("estimate_payment_milestones")
          .select("*")
          .eq("estimate_id", estimateId)
          .order("sort_order")
      : Promise.resolve({ data: [] } as any),
    estimateId
      ? supabase
          .from("estimate_items")
          .select("id,description,line_total,selection_status,selection_responsibility,selection_deadline,selected_product,selection_notes")
          .eq("estimate_id", estimateId)
          .neq("selection_status", "final")
          .order("selection_deadline", { ascending: true, nullsFirst: false })
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
    supabase
      .from("payments")
      .select("id,amount,payment_method,reference_number,notes,received_at,milestone_id")
      .eq("project_id", id)
      .order("received_at", { ascending: false }),
    supabase
      .from("project_closeouts")
      .select("*")
      .eq("project_id", id)
      .maybeSingle(),
    supabase
      .from("project_punch_items")
      .select("*")
      .eq("project_id", id)
      .order("created_at"),
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
        <Link className="panel project-overview-link" href="#status"><span className="project-overview-label">Status</span><div className="project-overview-value"><StatusPill value={project.status}/><ChevronRight size={18}/></div></Link>
        <Link className="panel project-overview-link" href="#contract"><span className="project-overview-label">Contract</span><div className="project-overview-value"><strong className="project-overview-number">{money(contractTotal)}</strong><ChevronRight size={18}/></div></Link>
        <Link className="panel project-overview-link" href="#payments"><span className="project-overview-label">Paid</span><div className="project-overview-value"><strong className="project-overview-number">{money(amountPaid)}</strong><ChevronRight size={18}/></div></Link>
        <Link className="panel project-overview-link" href="#payments"><span className="project-overview-label">Remaining</span><div className="project-overview-value"><strong className="project-overview-number">{money(remaining)}</strong><ChevronRight size={18}/></div></Link>
        <Link className="panel project-overview-link" href="#closeout"><span className="project-overview-label">Punch list</span><div className="project-overview-value"><strong className="project-overview-number">{(punchItems ?? []).filter((item: any) => item.status !== "complete").length} open</strong><ChevronRight size={18}/></div></Link>
      </section>

      <section id="status" className="panel project-status-panel project-section-anchor">
        <div><span className="project-overview-label">Project status</span><h2>Keep the job’s current stage clear</h2><p>Change the status here as the project moves forward. The projects list and dashboard update with it.</p></div>
        <form action={updateProjectStatus} className="project-status-form"><input type="hidden" name="project_id" value={project.id}/><label>Status<select name="status" defaultValue={project.status}><option value="scheduled">Scheduled</option><option value="in_progress">In progress</option><option value="waiting">Waiting</option><option value="on_hold">On hold</option><option value="substantially_complete">Substantially complete</option><option value="complete">Complete</option></select></label><button className="button button--gold">Update status</button></form>
      </section>

      <section id="contract" className="panel project-contract-panel project-section-anchor">
        <div className="panel-heading"><div><span className="project-overview-label">Contract details</span><h2>{money(contractTotal)} contract total</h2><p>Review the accepted estimate, scope, and agreed payment schedule.</p></div>{estimateId && <Link href={`/estimates/${estimateId}`} className="button button--outline"><FileText size={16}/>View accepted estimate</Link>}</div>
        <div className="project-contract-grid"><div><span>Base estimate</span><strong>{money(Number(estimate?.total ?? 0))}</strong></div><div><span>Approved changes</span><strong>{money(Math.max(0, contractTotal - Number(estimate?.total ?? 0)))}</strong></div><div><span>Current contract</span><strong>{money(contractTotal)}</strong></div></div>
        {estimate?.scope && <div className="project-contract-copy"><h3>Scope of work</h3><p className="pre-line">{estimate.scope}</p></div>}
        {estimate?.payment_schedule && <div className="project-contract-copy"><h3>Payment schedule</h3><p className="pre-line">{estimate.payment_schedule}</p></div>}
      </section>

      {(selectionItems ?? []).length > 0 && <section id="selections" className="panel project-section-anchor">
        <div className="panel-heading"><div><span className="project-overview-label">Selections & allowances</span><h2>Decisions to keep the job moving</h2><p>These responsibilities and deadlines came directly from the accepted estimate.</p></div><strong>{selectionItems?.length} open</strong></div>
        <div className="selection-card-list">{selectionItems?.map((item: any) => <article key={item.id}><div><strong>{item.description}</strong><span>{String(item.selection_status).replaceAll("_", " ")}</span></div>{item.selection_status === "allowance" && <b>{money(item.line_total)} allowance</b>}<small>{[item.selection_responsibility === "customer" ? "Customer responsible" : "Ironwood responsible", item.selected_product, item.selection_deadline ? `Decide by ${new Date(`${item.selection_deadline}T12:00:00`).toLocaleDateString()}` : null, item.selection_notes].filter(Boolean).join(" · ")}</small></article>)}</div>
      </section>}

      <section id="payments" className="panel project-payments-panel project-section-anchor">
        <div className="panel-heading"><div><span className="project-overview-label">Payments</span><h2>{money(amountPaid)} received · {money(remaining)} remaining</h2><p>Every payment recorded for this project is shown below.</p></div><Link href={`/payments?project=${project.id}`} className="button button--gold"><CreditCard size={16}/>Open payment log</Link></div>
        {(paymentMilestones ?? []).length > 0 && <div className="payment-milestone-summary">{paymentMilestones?.map((milestone: any) => { const expected = milestone.amount_type === "percentage" ? contractTotal * Number(milestone.amount_value) / 100 : Number(milestone.amount_value); const received = (payments ?? []).filter((payment: any) => payment.milestone_id === milestone.id).reduce((sum: number, payment: any) => sum + Number(payment.amount), 0); return <article key={milestone.id}><div><strong>{milestone.title}</strong><b>{money(received)} / {money(expected)}</b></div><small>{received >= expected ? "Paid" : milestone.due_trigger || "Upcoming"}{milestone.due_date ? ` · Due ${new Date(`${milestone.due_date}T12:00:00`).toLocaleDateString()}` : ""}</small></article>; })}</div>}
        <div className="table-wrap"><table><thead><tr><th>Date</th><th>Method</th><th>Reference</th><th>Notes</th><th>Amount</th></tr></thead><tbody>{(payments ?? []).map((payment: any) => <tr key={payment.id}><td>{new Date(payment.received_at).toLocaleDateString()}</td><td className="capitalize">{payment.payment_method}</td><td>{payment.reference_number || "—"}</td><td>{payment.notes || "—"}</td><td><strong>{money(Number(payment.amount))}</strong></td></tr>)}{!payments?.length && <tr><td colSpan={5} className="empty-cell">No payments have been recorded for this project yet.</td></tr>}</tbody></table></div>
      </section>

      <LaborVsActual laborItems={(laborItems ?? []) as any} timeEntries={(timeEntries ?? []) as any}/>

      <section className="panel project-change-orders">
        <div className="panel-heading"><div><h2>Change orders</h2><p>Project-linked scope changes with their own customer approval trail.</p></div><Link href={`/projects/${project.id}/change-orders/new`} className="button button--gold"><Plus size={16}/>New change order</Link></div>
        <div className="table-wrap"><table><thead><tr><th>Change order</th><th>Status</th><th>Date</th><th>Price change</th></tr></thead><tbody>{(changeOrders??[]).map((co:any)=><tr key={co.id}><td><Link className="table-link" href={`/change-orders/${co.id}`}>{co.change_order_number}<small>{co.title}</small></Link></td><td><StatusPill value={co.status}/></td><td>{new Date(co.created_at).toLocaleDateString()}</td><td>{money(co.total)}</td></tr>)}{!changeOrders?.length&&<tr><td colSpan={4} className="empty-cell">No change orders for this project.</td></tr>}</tbody></table></div>
      </section>

      <ProjectCloseout projectId={project.id} initialCloseout={closeout} initialItems={punchItems ?? []}/>

      <ProjectMedia projectId={project.id} estimateId={estimateId} initialMedia={media}/>
    </div>
  );
}
