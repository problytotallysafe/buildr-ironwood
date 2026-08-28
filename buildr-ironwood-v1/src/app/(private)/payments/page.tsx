import Link from "next/link";
import { revalidatePath } from "next/cache";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/money";

async function savePayment(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const id = String(formData.get("id") || "");
  const projectId = String(formData.get("project_id"));
  let priorProject: string | null = null;
  if (id) {
    const { data } = await supabase.from("payments").select("project_id").eq("id", id).single();
    priorProject = data?.project_id ?? null;
  }
  const values = {
    project_id: projectId,
    milestone_id: String(formData.get("milestone_id") || "") || null,
    amount: Number(formData.get("amount") || 0),
    payment_method: String(formData.get("payment_method") || "other"),
    reference_number: String(formData.get("reference_number") || "") || null,
    notes: String(formData.get("notes") || "") || null,
    received_at: new Date(`${String(formData.get("received_at"))}T12:00:00`).toISOString(),
  };
  if (id) await supabase.from("payments").update(values).eq("id", id);
  else await supabase.from("payments").insert({ owner_id: user.id, ...values });
  await supabase.rpc("refresh_project_paid_total", { p_project_id: projectId });
  if (priorProject && priorProject !== projectId) await supabase.rpc("refresh_project_paid_total", { p_project_id: priorProject });
  revalidatePath("/payments");
  revalidatePath("/projects");
  revalidatePath("/today");
  revalidatePath("/dashboard");
  revalidatePath(`/projects/${projectId}`);
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ edit?: string; project?: string; milestone?: string; amount?: string }> }) {
  const query = await searchParams;
  const supabase = await createClient();
  let paymentQuery = supabase.from("payments").select("*,projects(name,customers(first_name,last_name)),estimate_payment_milestones(title)").order("received_at", { ascending: false });
  if (query.project) paymentQuery = paymentQuery.eq("project_id", query.project);
  const [{ data: payments }, { data: projects }, { data: editing }] = await Promise.all([
    paymentQuery,
    supabase.from("projects").select("id,name,estimate_id,customers(first_name,last_name)").order("created_at", { ascending: false }),
    query.edit ? supabase.from("payments").select("*").eq("id", query.edit).maybeSingle() : Promise.resolve({ data: null } as any),
  ]);
  const estimateIds = (projects ?? []).map((project: any) => project.estimate_id).filter(Boolean);
  const { data: milestones } = estimateIds.length
    ? await supabase.from("estimate_payment_milestones").select("id,estimate_id,title,amount_type,amount_value,sort_order").in("estimate_id", estimateIds).order("sort_order")
    : { data: [] };
  const selectedProject = (projects ?? []).find((project: any) => project.id === query.project);
  const suggestedAmount = Number(query.amount);
  const amountDefault = !editing && Number.isFinite(suggestedAmount) && suggestedAmount > 0 ? suggestedAmount.toFixed(2) : "";

  return <div className="page-wrap">
    <PageHeader eyebrow="Money received" title={selectedProject ? `${selectedProject.name} payments` : "Payments"} description={selectedProject ? "Showing this project’s payment history. Record the next deposit, draw, or final payment here." : "Record deposits, progress draws, and final payments; reopen any entry to correct it later."}/>
    {selectedProject && <div className="payment-filter-bar"><Link href={`/projects/${selectedProject.id}`}>← Back to project</Link><Link href="/payments">Show all payments</Link></div>}
    <div className="detail-grid detail-grid--wide">
      <section className="panel"><h2>Payment history</h2><div className="table-wrap"><table><thead><tr><th>Date</th><th>Project</th><th>Milestone</th><th>Method</th><th>Amount</th><th></th></tr></thead><tbody>
        {(payments ?? []).map((payment: any) => <tr key={payment.id}><td>{new Date(payment.received_at).toLocaleDateString()}</td><td><Link className="table-link" href={`/projects/${payment.project_id}`}>{payment.projects?.name}</Link><small>{payment.projects?.customers ? `${payment.projects.customers.first_name} ${payment.projects.customers.last_name}` : ""}</small></td><td>{payment.estimate_payment_milestones?.title || "Unassigned"}</td><td>{payment.payment_method}</td><td>{money(payment.amount)}</td><td><Link className="button button--outline button--small" href={`/payments?edit=${payment.id}${query.project ? `&project=${query.project}` : ""}`}>Edit</Link></td></tr>)}
        {!payments?.length && <tr><td colSpan={6} className="empty-cell">No payments recorded.</td></tr>}
      </tbody></table></div></section>
      <aside className="panel"><h2>{editing ? "Edit payment" : "Record payment"}</h2><form action={savePayment} className="stack">
        <input type="hidden" name="id" value={editing?.id ?? ""}/>
        <label>Project<select name="project_id" required defaultValue={editing?.project_id ?? query.project ?? ""}><option value="">Choose project…</option>{(projects ?? []).map((project: any) => <option key={project.id} value={project.id}>{project.name} — {project.customers?.first_name} {project.customers?.last_name}</option>)}</select></label>
        <label>Payment milestone<select name="milestone_id" defaultValue={editing?.milestone_id ?? query.milestone ?? ""}><option value="">Unassigned / other payment</option>{(milestones ?? []).map((milestone: any) => { const project = (projects ?? []).find((item: any) => item.estimate_id === milestone.estimate_id); return <option key={milestone.id} value={milestone.id}>{project?.name ? `${project.name} — ` : ""}{milestone.title} ({milestone.amount_type === "percentage" ? `${milestone.amount_value}%` : money(milestone.amount_value)})</option>; })}</select><small>Choose the deposit, draw, or final payment this satisfies.</small></label>
        <label>Amount<input name="amount" type="number" min="0" step="0.01" required defaultValue={editing?.amount ?? amountDefault}/></label>
        <label>Date received<input name="received_at" type="date" required defaultValue={editing ? new Date(editing.received_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)}/></label>
        <label>Method<select name="payment_method" defaultValue={editing?.payment_method ?? "other"}><option>check</option><option>cash</option><option>card</option><option>bank transfer</option><option>other</option></select></label>
        <label>Reference / check #<input name="reference_number" defaultValue={editing?.reference_number ?? ""}/></label>
        <label>Notes<textarea name="notes" rows={3} defaultValue={editing?.notes ?? ""}/></label>
        <div className="button-row"><button className="button button--gold">{editing ? "Save payment changes" : "Record payment"}</button>{editing && <Link className="button button--outline" href={query.project ? `/payments?project=${query.project}` : "/payments"}>Cancel</Link>}</div>
      </form></aside>
    </div>
  </div>;
}
