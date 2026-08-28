import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: customer }, { data: estimates }, { data: projects }] =
    await Promise.all([
      supabase.from("customers").select("*").eq("id", id).single(),
      supabase
        .from("estimates")
        .select("id,estimate_number,title,status,total,created_at")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      supabase
        .from("projects")
        .select(
          "id,name,status,contract_total,amount_paid,created_at,estimates(estimate_number,title,total)",
        )
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
    ]);
  if (!customer) notFound();

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Customer record"
        title={`${customer.first_name} ${customer.last_name}`}
        description={customer.company_name || "Ironwood Remodeling customer"}
        actions={
          <div className="button-row">
            <Link
              className="button button--outline"
              href={`/customers/${customer.id}/edit`}
            >
              Edit customer
            </Link>
            <Link
              className="button button--outline"
              href={`/site-visits/new?customer=${customer.id}`}
            >
              Site visit
            </Link>
            <Link
              className="button button--outline"
              href={`/independence/new?customer=${customer.id}`}
            >
              Independence review
            </Link>
            <Link
              className="button button--gold"
              href={`/estimates/new?customer=${customer.id}`}
            >
              + New estimate
            </Link>
          </div>
        }
      />

      <div className="detail-grid">
        <section className="panel">
          <h2>Contact & property</h2>
          <dl className="details">
            <div>
              <dt>Phone</dt>
              <dd>{customer.phone || "—"}</dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{customer.email || "—"}</dd>
            </div>
            <div>
              <dt>Address</dt>
              <dd>
                {[
                  customer.address_line1,
                  customer.address_line2,
                  customer.city,
                  customer.state,
                  customer.postal_code,
                ]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </dd>
            </div>
            <div>
              <dt>Private notes</dt>
              <dd>{customer.notes || "—"}</dd>
            </div>
          </dl>
        </section>

        <section className="panel">
          <h2>Estimate history</h2>
          <div className="record-list">
            {(estimates ?? []).map((estimate: any) => (
              <Link href={`/estimates/${estimate.id}`} key={estimate.id}>
                <div>
                  <strong>{estimate.estimate_number}</strong>
                  <span>{estimate.title}</span>
                </div>
                <StatusPill value={estimate.status} />
                <b>{money(estimate.total)}</b>
              </Link>
            ))}
            {!estimates?.length && <p className="muted">No estimates yet.</p>}
          </div>
        </section>
      </div>

      <section className="panel customer-project-history">
        <div className="panel-heading">
          <div>
            <h2>Project history</h2>
            <p>Open any accepted job and continue its work, billing, or closeout.</p>
          </div>
          <Link href="/projects" className="button button--outline">
            All projects
          </Link>
        </div>
        <div className="record-list">
          {(projects ?? []).map((project: any) => {
            const total = Number(
              project.contract_total ?? project.estimates?.total ?? 0,
            );
            const balance = Math.max(0, total - Number(project.amount_paid ?? 0));
            const status =
              project.status === "complete" && balance > 0.005
                ? "complete_awaiting_payment"
                : project.status;
            return (
              <Link href={`/projects/${project.id}`} key={project.id}>
                <div>
                  <strong>
                    {project.estimates?.title || project.name || "Project"}
                  </strong>
                  <span>
                    {project.estimates?.estimate_number || "Project record"}
                    {balance > 0.005
                      ? ` · ${money(balance)} remaining`
                      : " · Paid in full"}
                  </span>
                </div>
                <StatusPill value={status} />
                <b>{money(total)}</b>
              </Link>
            );
          })}
          {!projects?.length && (
            <p className="muted">
              No projects yet. Accepted estimates automatically appear here.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
