import Link from "next/link";
import { ArrowRight, CircleDollarSign, FileCheck2, FileText, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SmartTimeDashboard } from "@/components/smart-time-dashboard";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/money";
import { StatusPill } from "@/components/status-pill";

export default async function DashboardPage() {
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - 8);
  since.setHours(0, 0, 0, 0);

  const [customers, openEstimates, projects, payments, recent, activeProjects, recentTime] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("estimates").select("id,total,status", { count: "exact" }).in("status", ["draft", "sent", "viewed"]),
    supabase.from("projects").select("id", { count: "exact", head: true }).neq("status", "complete"),
    supabase.from("payments").select("amount").gte("received_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from("estimates").select("id,estimate_number,title,status,total,created_at,customers(first_name,last_name)").order("created_at", { ascending: false }).limit(6),
    supabase
      .from("projects")
      .select("id,name,project_address,status,updated_at,estimates(title),customers(first_name,last_name)")
      .neq("status", "complete")
      .order("updated_at", { ascending: false }),
    supabase
      .from("time_entries")
      .select("id,project_id,started_at,ended_at,duration_minutes,projects(name,estimates(title))")
      .gte("started_at", since.toISOString())
      .order("started_at", { ascending: false }),
  ]);

  const pipeline = (openEstimates.data ?? []).reduce((sum, row) => sum + Number(row.total), 0);
  const paid = (payments.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Ironwood command center" title="Good work starts with a clear plan." description="See what needs attention, build the next proposal, and keep every job moving." actions={<Link className="button button--gold" href="/estimates/new">+ New estimate</Link>} />

      <SmartTimeDashboard
        projects={(activeProjects.data ?? []) as any}
        entries={(recentTime.data ?? []) as any}
      />

      <section className="metric-grid">
        <article className="metric"><Users /><span>Customers</span><strong>{customers.count ?? 0}</strong></article>
        <article className="metric"><FileText /><span>Open estimates</span><strong>{openEstimates.count ?? 0}</strong><small>{money(pipeline)} pipeline</small></article>
        <article className="metric"><FileCheck2 /><span>Active projects</span><strong>{projects.count ?? 0}</strong></article>
        <article className="metric"><CircleDollarSign /><span>Paid this month</span><strong>{money(paid)}</strong></article>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h2>Recent estimates</h2><p>Your latest proposals and their customer activity.</p></div><Link href="/estimates">View all <ArrowRight size={16}/></Link></div>
        <div className="table-wrap"><table><thead><tr><th>Estimate</th><th>Customer</th><th>Status</th><th>Total</th></tr></thead><tbody>
          {(recent.data ?? []).map((row: any) => <tr key={row.id}><td><Link className="table-link" href={`/estimates/${row.id}`}>{row.estimate_number}<small>{row.title}</small></Link></td><td>{row.customers ? `${row.customers.first_name} ${row.customers.last_name}` : "—"}</td><td><StatusPill value={row.status}/></td><td>{money(row.total)}</td></tr>)}
          {!recent.data?.length && <tr><td colSpan={4} className="empty-cell">Create your first estimate to begin.</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  );
}
