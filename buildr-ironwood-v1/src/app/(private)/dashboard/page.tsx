import Link from "next/link";
import { ArrowRight, CircleDollarSign, FileCheck2, FileText, Users } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { SmartTimeDashboard } from "@/components/smart-time-dashboard";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/money";
import { ACTIVE_PROJECT_STATUSES } from "@/lib/projects";
import { StatusPill } from "@/components/status-pill";
import { ProjectTodayContent } from "@/app/(private)/today/page";

const DAILY_QUOTES = [
  "Craftsmanship is care made visible.",
  "Measure twice. Care always.",
  "The details are where trust is built.",
  "Leave every home better than you found it.",
  "Good work makes daily life easier.",
  "Build with patience. Finish with pride.",
  "Clear plans make room for great work.",
  "Small details carry the weight of quality.",
  "Every problem solved is a life improved.",
  "Progress is built one careful step at a time.",
  "The standard is simple: make it last.",
  "Strong work begins with a clear next move.",
  "Quality remains after the tools are packed.",
  "Trust is built one sound step at a time.",
  "Make today’s work worthy of tomorrow.",
  "Useful, beautiful, built to last.",
  "Care shows up in the corners.",
  "Finish strong. Leave no loose ends.",
  "Good builders solve more than construction problems.",
  "Do the work right. Make the result matter.",
  "A clear next step turns intention into progress.",
] as const;

function quoteForToday() {
  const dateKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Chicago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const [year, month, day] = dateKey.split("-").map(Number);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
  return DAILY_QUOTES[dayNumber % DAILY_QUOTES.length];
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - 8);
  since.setHours(0, 0, 0, 0);

  const [customers, openEstimates, projects, payments, recent, activeProjects, recentTime, activeOwnerTime] = await Promise.all([
    supabase.from("customers").select("id", { count: "exact", head: true }),
    supabase.from("estimates").select("id,total,status", { count: "exact" }).in("status", ["draft", "sent", "viewed"]),
    supabase.from("projects").select("id", { count: "exact", head: true }).in("status", [...ACTIVE_PROJECT_STATUSES]),
    supabase.from("payments").select("amount").gte("received_at", new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()),
    supabase.from("estimates").select("id,estimate_number,title,status,total,created_at,customers(first_name,last_name)").order("created_at", { ascending: false }).limit(6),
    supabase
      .from("projects")
      .select("id,name,project_address,status,created_at,estimates(title),customers(first_name,last_name)")
      .in("status", [...ACTIVE_PROJECT_STATUSES])
      .order("created_at", { ascending: false }),
    supabase
      .from("time_entries")
      .select("id,project_id,started_at,ended_at,duration_minutes,projects(name,estimates(title))")
      .is("team_member_id", null)
      .gte("started_at", since.toISOString())
      .order("started_at", { ascending: false }),
    supabase
      .from("time_entries")
      .select("id,project_id,started_at,ended_at,duration_minutes,projects(name,estimates(title))")
      .is("team_member_id", null)
      .is("ended_at", null)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const pipeline = (openEstimates.data ?? []).reduce((sum, row) => sum + Number(row.total), 0);
  const paid = (payments.data ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const timeEntries = [...(recentTime.data ?? [])] as any[];
  if (activeOwnerTime.data && !timeEntries.some((entry) => entry.id === activeOwnerTime.data?.id)) {
    timeEntries.unshift(activeOwnerTime.data as any);
  }

  return (
    <div className="page-wrap">
      <PageHeader eyebrow="Ironwood command center" title={quoteForToday()} actions={<Link className="button button--gold" href="/estimates/new">+ New estimate</Link>} />

      <ProjectTodayContent embedded />

      <SmartTimeDashboard
        projects={(activeProjects.data ?? []) as any}
        entries={timeEntries as any}
      />

      <section className="metric-grid">
        <Link className="metric metric--link" href="/customers"><Users /><span>Customers</span><strong>{customers.count ?? 0}</strong><small>View customers <ArrowRight size={13}/></small></Link>
        <Link className="metric metric--link" href="/estimates"><FileText /><span>Open estimates</span><strong>{openEstimates.count ?? 0}</strong><small>{money(pipeline)} pipeline <ArrowRight size={13}/></small></Link>
        <Link className="metric metric--link" href="/projects"><FileCheck2 /><span>Active projects</span><strong>{projects.count ?? 0}</strong><small>View projects <ArrowRight size={13}/></small></Link>
        <Link className="metric metric--link" href="/payments"><CircleDollarSign /><span>Paid this month</span><strong>{money(paid)}</strong><small>View payments <ArrowRight size={13}/></small></Link>
      </section>
      <section className="panel">
        <div className="panel-heading"><div><h2>Recent estimates</h2></div><Link href="/estimates">View all <ArrowRight size={16}/></Link></div>
        <div className="table-wrap"><table><thead><tr><th>Estimate</th><th>Customer</th><th>Status</th><th>Total</th></tr></thead><tbody>
          {(recent.data ?? []).map((row: any) => <tr key={row.id}><td><Link className="table-link" href={`/estimates/${row.id}`}>{row.estimate_number}<small>{row.title}</small></Link></td><td>{row.customers ? `${row.customers.first_name} ${row.customers.last_name}` : "—"}</td><td><StatusPill value={row.status}/></td><td>{money(row.total)}</td></tr>)}
          {!recent.data?.length && <tr><td colSpan={4} className="empty-cell">Create your first estimate to begin.</td></tr>}
        </tbody></table></div>
      </section>
    </div>
  );
}
