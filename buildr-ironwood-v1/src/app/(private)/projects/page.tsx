import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/money";
import { StatusPill } from "@/components/status-pill";

const projectFilters = [
  { value: "current", label: "Current projects" }, { value: "awaiting_payment", label: "Complete — awaiting payment" },
  { value: "scheduled", label: "Scheduled" },
  { value: "in_progress", label: "In progress" }, { value: "waiting", label: "Waiting" },
  { value: "on_hold", label: "On hold" }, { value: "substantially_complete", label: "Substantially complete" },
  { value: "complete", label: "All completed" }, { value: "paid", label: "Completed & paid" }, { value: "all", label: "See all" },
];

export default async function ProjectsPage({searchParams}:{searchParams:Promise<{status?:string}>}) {
  const query = await searchParams;
  const filter = projectFilters.some((item) => item.value === query.status) ? query.status! : "current";
  const supabase = await createClient();
  let request = supabase
    .from("projects")
    .select(
      "*,customers(first_name,last_name),estimates(estimate_number,title,total)",
    );
  if (["scheduled","in_progress","waiting","on_hold","substantially_complete","complete"].includes(filter)) request = request.eq("status", filter);
  const { data: rows } = await request.order("created_at", { ascending: false });
  const hasBalance = (project: any) => Number(project.amount_paid ?? 0) + 0.005 < Number(project.contract_total ?? project.estimates?.total ?? 0);
  const data = (rows ?? []).filter((project: any) => {
    if (filter === "current") return project.status !== "complete" || hasBalance(project);
    if (filter === "awaiting_payment") return project.status === "complete" && hasBalance(project);
    if (filter === "paid") return project.status === "complete" && !hasBalance(project);
    return true;
  });

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Job tracking"
        title="Projects"
      />

      <section className="panel list-filter-bar"><form method="get" className="button-row"><label>Show<select name="status" defaultValue={filter}>{projectFilters.map((item)=><option key={item.value} value={item.value}>{item.label}</option>)}</select></label><button className="button button--outline">Apply</button></form><small>{data?.length??0} project{data?.length===1?"":"s"}</small></section>

      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Customer</th>
                <th>Status</th>
                <th>Contract</th>
                <th>Paid</th>
                <th>Balance</th>
              </tr>
            </thead>

            <tbody>
              {(data ?? []).map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <Link className="project-table-link" href={`/projects/${p.id}`}>
                      {p.estimates?.title || p.name || "Project"}
                    </Link>

                    <small>{p.estimates?.estimate_number}</small>
                  </td>

                  <td>
                    {p.customers
                      ? `${p.customers.first_name} ${p.customers.last_name}`
                      : "—"}
                  </td>

                  <td>
                    <StatusPill value={p.status === "complete" && hasBalance(p) ? "complete_awaiting_payment" : p.status} />
                  </td>

                  <td>{money(p.contract_total)}</td>
                  <td>{money(p.amount_paid)}</td>
                  <td>{money(Math.max(0, Number(p.contract_total ?? p.estimates?.total ?? 0) - Number(p.amount_paid ?? 0)))}</td>
                </tr>
              ))}

              {!data?.length && (
                <tr>
                  <td colSpan={6} className="empty-cell">
                    No projects match this view. Accepted estimates automatically become projects.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
