import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AlertTriangle, CalendarDays, Check, CircleDollarSign, ClipboardCheck, Clock3, ExternalLink, Plus, RotateCcw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/money";

function localDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function refreshToday() {
  revalidatePath("/today");
  revalidatePath("/dashboard");
}

async function addTask(formData: FormData) {
  "use server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const title = String(formData.get("title") || "").trim();
  const projectId = String(formData.get("project_id") || "");
  if (!title || !projectId) return;
  await supabase.from("project_tasks").insert({ owner_id: user.id, project_id: projectId, title, notes: String(formData.get("notes") || "").trim() || null, due_date: String(formData.get("due_date") || "") || null, priority: String(formData.get("priority") || "normal") });
  refreshToday();
}

async function setTaskStatus(formData: FormData) {
  "use server";
  const id = String(formData.get("id") || "");
  const status = String(formData.get("status") || "") === "complete" ? "complete" : "open";
  const supabase = await createClient();
  await supabase.from("project_tasks").update({ status, completed_at: status === "complete" ? new Date().toISOString() : null }).eq("id", id);
  refreshToday();
}

async function deleteTask(formData: FormData) {
  "use server";
  const supabase = await createClient();
  await supabase.from("project_tasks").delete().eq("id", String(formData.get("id") || ""));
  refreshToday();
}

export async function ProjectTodayContent({ embedded = false }: { embedded?: boolean } = {}) {
  const supabase = await createClient();
  const today = localDateKey();
  const [{ data: projects }, { data: completedProjects }, { data: tasks }, { data: selections }, { data: milestones }, { data: punchItems }, { data: activeTime }, { data: milestonePayments }] = await Promise.all([
    supabase.from("projects").select("id,name,status,project_address,customers(first_name,last_name),estimates(id,estimate_number,total)").in("status", ["scheduled", "in_progress", "waiting", "on_hold"]).order("created_at", { ascending: false }),
    supabase.from("projects").select("id,name,status,updated_at,contract_total,customers(first_name,last_name),estimates(id,estimate_number,total)").eq("status", "complete").order("updated_at", { ascending: false }),
    supabase.from("project_tasks").select("*,projects(id,name)").order("status").order("due_date", { ascending: true, nullsFirst: false }).order("priority", { ascending: false }),
    supabase.from("estimate_items").select("id,estimate_id,description,selection_status,selection_responsibility,selection_deadline,estimates(projects(id,name))").in("selection_status", ["allowance", "undecided", "customer_supplied"]).not("selection_deadline", "is", null).lte("selection_deadline", today).order("selection_deadline"),
    supabase.from("estimate_payment_milestones").select("id,estimate_id,title,amount_type,amount_value,due_trigger,due_date,estimates(total,projects(id,name,status))").not("due_date", "is", null).lte("due_date", today).order("due_date"),
    supabase.from("project_punch_items").select("id,project_id,description,room_location,responsible_party,due_date,priority,projects(name)").eq("status", "open").or(`due_date.lte.${today},priority.in.(high,urgent)`).order("due_date", { ascending: true, nullsFirst: false }),
    supabase.from("time_entries").select("id,project_id,started_at,projects(name)").is("ended_at", null).maybeSingle(),
    supabase.from("payments").select("project_id,milestone_id,amount").not("milestone_id", "is", null),
  ]);

  const completedIds = (completedProjects ?? []).map((project: any) => project.id);
  const [{ data: completedChangeOrders }, { data: completedPayments }] = completedIds.length ? await Promise.all([
    supabase.from("change_orders").select("project_id,total,status").in("project_id", completedIds).neq("status", "declined"),
    supabase.from("payments").select("project_id,amount").in("project_id", completedIds),
  ]) : [{ data: [] }, { data: [] }];

  const overdueInvoices = (completedProjects ?? []).map((project: any) => {
    const estimate = Array.isArray(project.estimates) ? project.estimates[0] : project.estimates;
    const base = Number(estimate?.total ?? project.contract_total ?? 0);
    const changes = (completedChangeOrders ?? []).filter((item: any) => item.project_id === project.id).reduce((sum: number, item: any) => sum + Number(item.total), 0);
    const paid = (completedPayments ?? []).filter((item: any) => item.project_id === project.id).reduce((sum: number, item: any) => sum + Number(item.amount), 0);
    return { ...project, estimate, balance: Math.max(0, base + changes - paid) };
  }).filter((project: any) => project.balance > 0.005);

  const milestonePaid = new Map<string, number>();
  for (const payment of milestonePayments ?? []) milestonePaid.set((payment as any).milestone_id, (milestonePaid.get((payment as any).milestone_id) ?? 0) + Number((payment as any).amount));
  const paymentMilestones = (milestones ?? []).map((milestone: any) => {
    const total = Number(milestone.estimates?.total ?? 0);
    const expected = milestone.amount_type === "percentage" ? total * Number(milestone.amount_value) / 100 : Number(milestone.amount_value);
    return { ...milestone, expected, balance: Math.max(0, expected - (milestonePaid.get(milestone.id) ?? 0)) };
  }).filter((milestone: any) => milestone.balance > 0.005 && milestone.estimates?.projects?.status !== "complete");
  const overdueMilestones = paymentMilestones.filter((milestone: any) => milestone.due_date < today);
  const dueMilestones = paymentMilestones.filter((milestone: any) => milestone.due_date >= today);

  const openTasks = (tasks ?? []).filter((task: any) => task.status === "open");
  const completedTasks = (tasks ?? []).filter((task: any) => task.status === "complete").slice(0, 8);
  const urgent = openTasks.filter((task: any) => task.priority === "urgent" || task.priority === "high" || (task.due_date && task.due_date <= today));
  const later = openTasks.filter((task: any) => !urgent.includes(task));
  const taskCard = (task: any) => <article className={`today-task today-task--${task.priority}`} key={task.id}><form action={setTaskStatus}><input type="hidden" name="id" value={task.id}/><input type="hidden" name="status" value="complete"/><button className="today-check" aria-label="Mark complete"><Check size={17}/></button></form><div><strong>{task.title}</strong><span>{task.projects?.name}{task.due_date ? ` · ${task.due_date < today ? "Overdue " : "Due "}${new Date(`${task.due_date}T12:00:00`).toLocaleDateString()}` : ""}</span>{task.notes && <p>{task.notes}</p>}</div><Link href={`/projects/${task.project_id}`}>Open job</Link><form action={deleteTask}><input type="hidden" name="id" value={task.id}/><button className="icon-button danger" aria-label="Delete task"><Trash2 size={15}/></button></form></article>;

  return <section className={embedded ? "dashboard-today" : undefined}>
    {embedded
      ? <div className="dashboard-today-heading"><div><span>Today in the field</span><h2>Project Today</h2><p>Tasks, overdue balances, decisions, and active jobs—up front.</p></div><Link href="/today">Open full page <ExternalLink size={15}/></Link></div>
      : <PageHeader eyebrow={new Date(`${today}T12:00:00`).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })} title="Project Today" description="One field-ready view of what needs attention now—tasks, deadlines, decisions, payments, and the clock." actions={<Link href="/time" className="button button--gold"><Clock3 size={17}/>{activeTime ? "Clock is running" : "Track time"}</Link>}/>
    }
    {activeTime && <section className="today-clock panel"><Clock3/><div><span>Currently clocked in</span><strong>{(activeTime as any).projects?.name}</strong><small>Started {new Date(activeTime.started_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</small></div><Link href="/time" className="button button--outline">Open time clock</Link></section>}
    <div className="today-grid"><div className="stack">
      {(overdueInvoices.length > 0 || overdueMilestones.length > 0) && <section className="panel today-overdue"><div className="panel-heading"><div><h2><AlertTriangle size={20}/> Overdue payments</h2><p>Completed work and past-due milestones that still have a balance.</p></div><strong className="today-count">{overdueInvoices.length + overdueMilestones.length}</strong></div><div className="today-overdue-list">
        {overdueInvoices.map((project: any) => <article key={`invoice-${project.id}`}><CircleDollarSign/><div><strong>{project.customers?.first_name} {project.customers?.last_name} · {project.name}</strong><span>Completed final invoice · {project.estimate?.estimate_number}</span></div><b>{money(project.balance)}</b><Link className="button button--gold button--small" href={`/projects/${project.id}/invoice`}>Send invoice</Link></article>)}
        {overdueMilestones.map((milestone: any) => <article key={`milestone-${milestone.id}`}><CalendarDays/><div><strong>{milestone.title} · {milestone.estimates?.projects?.name}</strong><span>Due {new Date(`${milestone.due_date}T12:00:00`).toLocaleDateString()}</span></div><b>{money(milestone.balance)}</b>{milestone.estimates?.projects?.id && <Link href={`/projects/${milestone.estimates.projects.id}`}>Open</Link>}</article>)}
      </div></section>}
      <section className="panel"><div className="panel-heading"><div><h2>Needs attention</h2><p>Overdue, due today, or marked high priority.</p></div><strong className="today-count">{urgent.length}</strong></div><div className="today-task-list">{urgent.map(taskCard)}{!urgent.length && <p className="today-clear"><Check/>Nothing urgent. You’re clear to focus on the work.</p>}</div></section>
      <section className="panel"><div className="panel-heading"><div><h2>Coming up</h2><p>Open job tasks without an immediate warning.</p></div><strong className="today-count">{later.length}</strong></div><div className="today-task-list">{later.map(taskCard)}{!later.length && <p className="muted">No additional tasks queued.</p>}</div></section>
      {((selections ?? []).length > 0 || dueMilestones.length > 0 || (punchItems ?? []).length > 0) && <section className="panel"><div className="panel-heading"><div><h2>Automatic second set of eyes</h2><p>Buildr found dated commitments in estimates and projects.</p></div><AlertTriangle/></div><div className="today-watch-list">{(punchItems ?? []).map((item: any) => <article key={item.id}><ClipboardCheck/><div><strong>{item.description}</strong><span>Punch list{item.room_location ? ` · ${item.room_location}` : ""} · {item.responsible_party}{item.due_date ? ` · Due ${new Date(`${item.due_date}T12:00:00`).toLocaleDateString()}` : ""}</span></div><Link href={`/projects/${item.project_id}#closeout`}>Open</Link></article>)}{(selections ?? []).map((item: any) => <article key={item.id}><CalendarDays/><div><strong>{item.description}</strong><span>{String(item.selection_status).replaceAll("_", " ")} · {item.selection_responsibility === "customer" ? "Customer decision" : "Ironwood decision"} · Due {new Date(`${item.selection_deadline}T12:00:00`).toLocaleDateString()}</span></div>{item.estimates?.projects?.id && <Link href={`/projects/${item.estimates.projects.id}`}>Open</Link>}</article>)}{dueMilestones.map((milestone: any) => <article key={milestone.id}><CalendarDays/><div><strong>{milestone.title} · {money(milestone.balance)} remaining</strong><span>{milestone.due_trigger || "Payment milestone"} · Due today</span></div>{milestone.estimates?.projects?.id && <Link href={`/projects/${milestone.estimates.projects.id}`}>Open</Link>}</article>)}</div></section>}
    </div><aside className="stack">
      <section className="panel"><h2><Plus size={20}/> Add today’s task</h2><form action={addTask} className="stack"><label>Project<select name="project_id" required><option value="">Choose project…</option>{(projects ?? []).map((project: any) => <option key={project.id} value={project.id}>{project.name} — {project.customers?.first_name} {project.customers?.last_name}</option>)}</select></label><label>What needs done?<input name="title" required placeholder="Pick up vanity and faucet"/></label><label>Details<textarea name="notes" rows={3} placeholder="Measurements, materials, person to call…"/></label><div className="field-pair"><label>Due date<input type="date" name="due_date" defaultValue={today}/></label><label>Priority<select name="priority" defaultValue="normal"><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label></div><button className="button button--gold">Add to Project Today</button></form></section>
      <section className="panel"><h2>Active jobs</h2><div className="record-list">{(projects ?? []).map((project: any) => <Link href={`/projects/${project.id}`} key={project.id}><div><strong>{project.name}</strong><span>{project.customers?.first_name} {project.customers?.last_name}</span></div><span className="capitalize">{String(project.status).replaceAll("_", " ")}</span></Link>)}</div></section>
      {completedTasks.length > 0 && <details className="panel today-completed"><summary>Recently completed ({completedTasks.length})</summary>{completedTasks.map((task: any) => <div key={task.id}><span>{task.title}</span><form action={setTaskStatus}><input type="hidden" name="id" value={task.id}/><input type="hidden" name="status" value="open"/><button className="button button--outline button--small"><RotateCcw size={14}/>Reopen</button></form></div>)}</details>}
    </aside></div>
  </section>;
}

export default function TodayPage() {
  return <div className="page-wrap"><ProjectTodayContent/></div>;
}
