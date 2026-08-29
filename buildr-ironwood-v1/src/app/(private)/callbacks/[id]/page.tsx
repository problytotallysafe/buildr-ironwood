import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";

import { CallbackLifecycleActions } from "@/components/callback-lifecycle-actions";
import { PageHeader } from "@/components/page-header";
import { ProjectCallbackForm } from "@/components/project-callback-form";
import { StatusPill } from "@/components/status-pill";
import { canManageSales, getBusinessAccess } from "@/lib/business-access";
import { formatBusinessDate, formatBusinessDateTime } from "@/lib/date";
import { money } from "@/lib/money";
import {
  callbackAffectsFinancials,
  callbackFormValues,
  callbackInternalCost,
  callbackOptionLabel,
  callbackReadyForAcceptance,
  callbackResponsibilityOptions,
  callbackWarrantyOptions,
  summarizeCallbackFinancials,
} from "@/lib/project-callbacks";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectCallbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; notice?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const supabase = await createClient();
  const access = await getBusinessAccess(supabase);
  if (!access) redirect("/login");

  const { data: callback } = await supabase
    .from("project_callbacks")
    .select("*,projects(id,name,status,customers(first_name,last_name),estimates(title))")
    .eq("id", id)
    .eq("owner_id", access.ownerId)
    .single();
  if (!callback) notFound();

  const project = callback.projects as any;
  const customer = project?.customers as any;
  const estimate = project?.estimates as any;
  const projectTitle = estimate?.title || project?.name || "Completed project";
  const customerName = customer ? `${customer.first_name} ${customer.last_name}` : "Customer";
  const editable = canManageSales(access);
  const financials = summarizeCallbackFinancials([callback]);
  const affectsFinancials = callbackAffectsFinancials(callback);

  async function saveCallback(formData: FormData) {
    "use server";
    const client = await createClient();
    const currentAccess = await getBusinessAccess(client);
    if (!currentAccess || !canManageSales(currentAccess)) redirect(`/callbacks/${id}`);
    const values = callbackFormValues(formData);
    if (!values) throw new Error("Enter a title, reported date, problem description, warranty decision, and cost responsibility.");
    const { data: existing } = await client.from("project_callbacks").select("project_id").eq("id", id).eq("owner_id", currentAccess.ownerId).maybeSingle();
    if (!existing) notFound();
    const { error } = await client.from("project_callbacks").update(values).eq("id", id).eq("owner_id", currentAccess.ownerId);
    if (error) throw new Error(error.message);
    revalidatePath(`/callbacks/${id}`);
    revalidatePath(`/projects/${existing.project_id}`);
    revalidatePath(`/projects/${existing.project_id}/invoice`);
    revalidatePath("/analytics");
    revalidatePath("/today");
    revalidatePath("/dashboard");
    redirect(`/callbacks/${id}?saved=1`);
  }

  async function changeLifecycle(formData: FormData) {
    "use server";
    const client = await createClient();
    const currentAccess = await getBusinessAccess(client);
    if (!currentAccess || !canManageSales(currentAccess)) redirect(`/callbacks/${id}`);
    const callbackId = String(formData.get("id") || "");
    const action = String(formData.get("action") || "");
    if (callbackId !== id) return;
    const { data: existing } = await client.from("project_callbacks").select("project_id,warranty_status,cost_responsibility,repair_plan").eq("id", id).eq("owner_id", currentAccess.ownerId).maybeSingle();
    if (!existing) notFound();
    if (action === "accept" && !callbackReadyForAcceptance(existing)) {
      redirect(`/callbacks/${id}?notice=acceptance-details`);
    }
    const now = new Date().toISOString();
    let values: Record<string, unknown> | null = null;
    if (action === "accept") values = { status: "accepted", accepted_at: now, completed_at: null };
    if (action === "complete") values = { status: "completed", completed_at: now };
    if (action === "reopen") values = { status: "draft", accepted_at: null, completed_at: null };
    if (action === "archive") values = { archived_at: now, deleted_at: null };
    if (action === "delete") values = { deleted_at: now, archived_at: null };
    if (action === "restore") values = { archived_at: null, deleted_at: null };
    if (!values) return;
    const { error } = await client.from("project_callbacks").update(values).eq("id", id).eq("owner_id", currentAccess.ownerId);
    if (error) throw new Error(error.message);
    revalidatePath(`/callbacks/${id}`);
    revalidatePath(`/projects/${existing.project_id}`);
    revalidatePath(`/projects/${existing.project_id}/invoice`);
    revalidatePath("/projects");
    revalidatePath("/dashboard");
    revalidatePath("/today");
    revalidatePath("/analytics");
    redirect(`/callbacks/${id}`);
  }

  return (
    <div className="page-wrap">
      <div className="project-detail-back"><Link href={`/projects/${callback.project_id}#callbacks`}>Back to {projectTitle}</Link></div>
      <PageHeader
        eyebrow={callback.callback_number}
        title={callback.title}
        description={`${customerName} • Reported ${formatBusinessDate(`${callback.reported_at}T12:00:00`)}`}
        actions={editable ? <CallbackLifecycleActions action={changeLifecycle} callback={callback}/> : undefined}
      />

      {query.saved === "1" && <p className="success-box">Callback saved.</p>}
      {query.notice === "acceptance-details" && <p className="error-box">Before accepting, save a warranty decision, cost responsibility, and repair plan.</p>}
      {callback.deleted_at && <div className="settings-warning"><div><strong>This callback is in Trash.</strong><span>Its revenue and cost are excluded from the project until it is restored.</span></div></div>}
      {!callback.deleted_at && callback.archived_at && <div className="settings-warning"><div><strong>This callback is archived.</strong><span>Accepted financial history still remains in the project totals.</span></div></div>}

      <section className="callback-summary-grid">
        <article className="panel"><span>Status</span><StatusPill value={callback.status}/><small>{callback.accepted_at ? `Accepted ${formatBusinessDateTime(callback.accepted_at)}` : "Not accepted yet"}</small></article>
        <article className="panel"><span>Warranty</span><strong>{callbackOptionLabel(callbackWarrantyOptions, callback.warranty_status)}</strong><small>{callbackOptionLabel(callbackResponsibilityOptions, callback.cost_responsibility)}</small></article>
        <article className="panel"><span>Customer charge</span><strong>{money(Number(callback.homeowner_amount ?? 0))}</strong><small>{affectsFinancials ? "Included in contract" : "Pending acceptance"}</small></article>
        <article className="panel"><span>Ironwood cost</span><strong>{money(callbackInternalCost(callback))}</strong><small>{callback.actual_internal_cost == null ? "Estimated" : "Actual"}</small></article>
        <article className="panel"><span>Profit impact</span><strong className={financials.net < 0 ? "analytics-negative" : ""}>{affectsFinancials ? money(financials.net) : "Pending"}</strong><small>Customer charge minus Ironwood cost</small></article>
      </section>

      <ProjectCallbackForm action={saveCallback} project={{ id: callback.project_id, title: projectTitle, customerName }} callback={callback} editable={editable}/>
    </div>
  );
}
