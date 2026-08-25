import Link from "next/link";
import { revalidatePath } from "next/cache";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

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
  revalidatePath(`/projects/${projectId}`);
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ edit?: string; project?: string }> }) {
  const query = await searchParams;
  const supabase = await createClient();
  let paymentsQuery = supabase.from("payments").select("*,projects(name,customers(first_name,last_name))").order("received_at", { ascending: false });
  if (query.project) paymentsQuery = paymentsQuery.eq("project_id", query.project);

  const [{ data: payments }, { data: projects }, { data: editing }] = await Promise.all([
    paymentsQuery,
    supabase.from("projects").select("id,name,customers(first_name,last_name)").order("created_at", { ascending: false }),
    query.edit ? supabase.from("payments").select("*").eq("id", query.edit).maybeSingle() : Promise.resolve({ data: null } as any),
  ]);

  const selectedProject = (projects ?? []).find((project: any) => project.id === query.project);
  const selectedProjectName = selectedProject?.name ?? "This project";
  const filteredTotal = (payments ?? []).reduce((sum: number, payment: any) => sum + Number(payment.amount ?? 0), 0);

  return <div className="page-wrap">
    {query.project && <div className="project-detail-back"><Link href={`/projects/${query.project}`}><ArrowLeft size={16}/>Back to project</Link></div>}
    <PageHeader eyebrow="Money received" title={query.project ? `${selectedProjectName} payments` : "Payments"} description={query.project ? `${payments?.length ?? 0} recorded payment${payments?.length === 1 ? "" : "s"} totaling ${money(filteredTotal)}.` : "Record deposits, progress draws, and final payments; reopen any entry to correct it later."} actions={query.project ? <Link className="button button--outline" href="/payments">View all projects</Link> : undefined}/>
    <div className="detail-grid detail-grid--wide">
      <section className="panel"><h2>{query.project ? "Project payment log" : "Payment history"}</h2><div className="table-wrap"><table><thead><tr><th>Date</th><th>Project</th><th>Method</th><th>Amount</th><th></th></tr></thead><tbody>{(payments ?? []).map((p: any) => <tr key={p.id}><td>{new Date(p.received_at).toLocaleDateString()}</td><td>{p.projects?.name}<small>{p.projects?.customers ? `${p.projects.customers.first_name} ${p.projects.customers.last_name}` : ""}</small></td><td>{p.payment_method}</td><td>{money(p.amount)}</td><td><Link className="button button--outline button--small" href={`/payments?${query.project ? `project=${query.project}&` : ""}edit=${p.id}`}>Edit</Link></td></tr>)}{!payments?.length && <tr><td colSpan={5} className="empty-cell">No payments recorded for {query.project ? "this project" : "any project"}.</td></tr>}</tbody></table></div></section>
      <aside className="panel"><h2>{editing ? "Edit payment" : "Record payment"}</h2><form action={savePayment} className="stack"><input type="hidden" name="id" value={editing?.id ?? ""}/><label>Project<select name="project_id" required defaultValue={editing?.project_id ?? query.project ?? ""}><option value="">Choose project…</option>{(projects ?? []).map((p: any) => <option key={p.id} value={p.id}>{p.name} — {p.customers?.first_name} {p.customers?.last_name}</option>)}</select></label><label>Amount<input name="amount" type="number" min="0" step="0.01" required defaultValue={editing?.amount ?? ""}/></label><label>Date received<input name="received_at" type="date" required defaultValue={editing ? new Date(editing.received_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)}/></label><label>Method<select name="payment_method" defaultValue={editing?.payment_method ?? "other"}><option>check</option><option>cash</option><option>card</option><option>bank transfer</option><option>other</option></select></label><label>Reference / check #<input name="reference_number" defaultValue={editing?.reference_number ?? ""}/></label><label>Notes<textarea name="notes" rows={3} defaultValue={editing?.notes ?? ""}/></label><div className="button-row"><button className="button button--gold">{editing ? "Save payment changes" : "Record payment"}</button>{editing && <Link className="button button--outline" href={query.project ? `/payments?project=${query.project}` : "/payments"}>Cancel</Link>}</div></form></aside>
    </div>
  </div>;
}
