import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/money";
import { getBusinessAccess } from "@/lib/business-access";
import { effectiveHourlyCost, ownerCostIsMissing } from "@/lib/labor-cost";

function pct(value: number) {
  if (!Number.isFinite(value)) return "0.0%";
  return `${value.toFixed(1)}%`;
}

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const query = await searchParams;
  const supabase = await createClient();
  const access = await getBusinessAccess(supabase);

  const { data: projects } = await supabase
    .from("projects")
    .select(`
      id,
      name,
      status,
      contract_total,
      amount_paid,
      created_at,
      customers(
        first_name,
        last_name
      ),
      estimates(
        id,
        estimate_number,
        title,
        subtotal,
        markup_total,
        tax_total,
        total
      )
    `)
    .order("created_at", { ascending: false });

  const projectRows = projects ?? [];

  const estimateIds = projectRows
    .map((project: any) => project.estimates?.id)
    .filter(Boolean);

  const projectIds = projectRows
    .map((project: any) => project.id)
    .filter(Boolean);

  const [{ data: estimateItems }, { data: timeEntries }, { data: settings }] = await Promise.all([
    estimateIds.length
      ? supabase
          .from("estimate_items")
          .select(
            "estimate_id,item_type,quantity,unit_cost,line_subtotal",
          )
          .in("estimate_id", estimateIds)
      : Promise.resolve({ data: [] } as any),

    projectIds.length
      ? supabase
          .from("time_entries")
          .select(
            "project_id,team_member_id,duration_minutes,ended_at,hourly_cost",
          )
          .in("project_id", projectIds)
      : Promise.resolve({ data: [] } as any),
    access
      ? supabase
          .from("business_settings")
          .select("owner_hourly_cost")
          .eq("owner_id", access.ownerId)
          .maybeSingle()
      : Promise.resolve({ data: null } as any),
  ]);
  const ownerHourlyCost = Number(settings?.owner_hourly_cost ?? 0);
  const timeRows = (timeEntries ?? []) as Array<{
    project_id: string;
    team_member_id: string | null;
    duration_minutes: number | null;
    ended_at: string | null;
    hourly_cost: number | string | null;
  }>;
  const incompleteOwnerCost = timeRows.some(
    (entry) => entry.ended_at && ownerCostIsMissing(entry, ownerHourlyCost),
  );

  const laborEstimatedByEstimate = new Map<string, number>();

  for (const item of estimateItems ?? []) {
    if (item.item_type !== "labor") continue;

    const current =
      laborEstimatedByEstimate.get(item.estimate_id) ?? 0;

    const base =
      item.line_subtotal != null
        ? Number(item.line_subtotal)
        : Number(item.quantity ?? 0) *
          Number(item.unit_cost ?? 0);

    laborEstimatedByEstimate.set(
      item.estimate_id,
      current + base,
    );
  }

  const actualLaborByProject = new Map<
    string,
    { hours: number; cost: number }
  >();

  for (const entry of timeRows) {
    if (!entry.ended_at) continue;

    const minutes = Number(
      entry.duration_minutes ?? 0,
    );

    const hours = minutes / 60;

    const current =
      actualLaborByProject.get(
        entry.project_id,
      ) ?? {
        hours: 0,
        cost: 0,
      };

    current.hours += hours;

    current.cost +=
      hours *
      effectiveHourlyCost(entry, ownerHourlyCost);

    actualLaborByProject.set(
      entry.project_id,
      current,
    );
  }

  const analytics = projectRows.map(
    (project: any) => {
      const estimate =
        project.estimates;

      const estimateId =
        estimate?.id ?? "";

      const estimatedBaseCost =
        Number(
          estimate?.subtotal ?? 0,
        );

      const estimatedMarkup =
        Number(
          estimate?.markup_total ?? 0,
        );

      const tax =
        Number(
          estimate?.tax_total ?? 0,
        );

      const preTaxRevenue =
        estimatedBaseCost +
        estimatedMarkup;

      const contractTotal =
        Number(
          project.contract_total ??
            estimate?.total ??
            preTaxRevenue +
              tax,
        );

      const paid =
        Number(
          project.amount_paid ?? 0,
        );

      const estimatedLabor =
        laborEstimatedByEstimate.get(
          estimateId,
        ) ?? 0;

      const actualLabor =
        actualLaborByProject.get(
          project.id,
        ) ?? {
          hours: 0,
          cost: 0,
        };

      const projectedDirectCost =
        Math.max(
          0,
          estimatedBaseCost -
            estimatedLabor +
            Math.max(estimatedLabor, actualLabor.cost),
        );

      const estimatedGrossProfit =
        preTaxRevenue -
        estimatedBaseCost;

      const projectedGrossProfit =
        preTaxRevenue -
        projectedDirectCost;

      const estimatedMargin =
        preTaxRevenue > 0
          ? (estimatedGrossProfit /
              preTaxRevenue) *
            100
          : 0;

      const projectedMargin =
        preTaxRevenue > 0
          ? (projectedGrossProfit /
              preTaxRevenue) *
            100
          : 0;

      const remaining =
        Math.max(
          0,
          contractTotal - paid,
        );

      return {
        id: project.id,
        title:
          estimate?.title ||
          project.name ||
          "Project",
        estimateNumber:
          estimate?.estimate_number ||
          "",
        customer:
          project.customers
            ? `${project.customers.first_name} ${project.customers.last_name}`
            : "",
        status:
          project.status,
        contractTotal,
        paid,
        remaining,
        preTaxRevenue,
        estimatedBaseCost,
        estimatedLabor,
        actualLaborCost:
          actualLabor.cost,
        actualLaborHours:
          actualLabor.hours,
        projectedDirectCost,
        estimatedGrossProfit,
        projectedGrossProfit,
        estimatedMargin,
        projectedMargin,
      };
    },
  );

  const totals = analytics.reduce(
    (sum, row) => {
      sum.contract += row.contractTotal;
      sum.paid += row.paid;
      sum.remaining += row.remaining;
      sum.preTaxRevenue +=
        row.preTaxRevenue;
      sum.estimatedBase +=
        row.estimatedBaseCost;
      sum.projectedDirect +=
        row.projectedDirectCost;
      sum.estimatedProfit +=
        row.estimatedGrossProfit;
      sum.projectedProfit +=
        row.projectedGrossProfit;
      sum.actualLaborCost +=
        row.actualLaborCost;
      sum.actualLaborHours +=
        row.actualLaborHours;
      return sum;
    },
    {
      contract: 0,
      paid: 0,
      remaining: 0,
      preTaxRevenue: 0,
      estimatedBase: 0,
      projectedDirect: 0,
      estimatedProfit: 0,
      projectedProfit: 0,
      actualLaborCost: 0,
      actualLaborHours: 0,
    },
  );

  const overallEstimatedMargin =
    totals.preTaxRevenue > 0
      ? (totals.estimatedProfit /
          totals.preTaxRevenue) *
        100
      : 0;

  const overallProjectedMargin =
    totals.preTaxRevenue > 0
      ? (totals.projectedProfit /
          totals.preTaxRevenue) *
        100
      : 0;

  const sortedByProjectedProfit =
    [...analytics].sort(
      (a, b) =>
        b.projectedGrossProfit -
        a.projectedGrossProfit,
    );

  const bestProject =
    sortedByProjectedProfit[0] ??
    null;

  const worstProject =
    sortedByProjectedProfit[
      sortedByProjectedProfit.length -
        1
    ] ?? null;

  const metricViews = {
    contract: { label: "Contract value", value: (row: (typeof analytics)[number]) => row.contractTotal, format: money },
    revenue: { label: "Pre-tax customer revenue", value: (row: (typeof analytics)[number]) => row.preTaxRevenue, format: money },
    payments: { label: "Payments received", value: (row: (typeof analytics)[number]) => row.paid, format: money },
    outstanding: { label: "Outstanding balance", value: (row: (typeof analytics)[number]) => row.remaining, format: money },
    "estimated-cost": { label: "Estimated direct cost", value: (row: (typeof analytics)[number]) => row.estimatedBaseCost, format: money },
    "estimated-profit": { label: "Estimated gross profit", value: (row: (typeof analytics)[number]) => row.estimatedGrossProfit, format: money },
    "estimated-margin": { label: "Estimated margin", value: (row: (typeof analytics)[number]) => row.estimatedMargin, format: pct },
    "projected-cost": { label: "Projected direct cost", value: (row: (typeof analytics)[number]) => row.projectedDirectCost, format: money },
    profit: { label: "Projected gross profit", value: (row: (typeof analytics)[number]) => row.projectedGrossProfit, format: money },
    margin: { label: "Projected margin", value: (row: (typeof analytics)[number]) => row.projectedMargin, format: pct },
    "labor-cost": { label: "Actual labor cost", value: (row: (typeof analytics)[number]) => row.actualLaborCost, format: money },
    labor: { label: "Tracked labor hours", value: (row: (typeof analytics)[number]) => row.actualLaborHours, format: (value: number) => `${value.toFixed(1)} hr` },
  } as const;
  const selectedView = query.view && query.view in metricViews
    ? query.view as keyof typeof metricViews
    : "profit";
  const selectedMetric = metricViews[selectedView];
  const breakdownRows = [...analytics].sort((a, b) => selectedMetric.value(b) - selectedMetric.value(a));

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Business intelligence"
        title="Analytics"
      />

      {incompleteOwnerCost && (
        <div className="settings-warning">
          <div><strong>Owner labor cost is not set.</strong><span>Tracked hours are complete, but actual labor cost is understated. Profit projections continue using the accepted labor budget until a rate is set.</span></div>
          <Link href="/settings/time">Set owner hourly cost</Link>
        </div>
      )}

      <section className="analytics-summary-grid">
        <Link href="/analytics?view=contract#analytics-breakdown" className={`panel analytics-stat analytics-stat-link ${selectedView === "contract" ? "active" : ""}`}>
          <span>
            Contract value
          </span>
          <strong>
            {money(
              totals.contract,
            )}
          </strong>
        </Link>

        <Link href="/analytics?view=payments#analytics-breakdown" className={`panel analytics-stat analytics-stat-link ${selectedView === "payments" ? "active" : ""}`}>
          <span>
            Payments received
          </span>
          <strong>
            {money(totals.paid)}
          </strong>
        </Link>

        <Link href="/analytics?view=outstanding#analytics-breakdown" className={`panel analytics-stat analytics-stat-link ${selectedView === "outstanding" ? "active" : ""}`}>
          <span>
            Outstanding
          </span>
          <strong>
            {money(
              totals.remaining,
            )}
          </strong>
        </Link>

        <Link href="/analytics?view=profit#analytics-breakdown" className={`panel analytics-stat analytics-stat-link ${selectedView === "profit" ? "active" : ""}`}>
          <span>
            Projected gross profit
          </span>
          <strong>
            {money(
              totals.projectedProfit,
            )}
          </strong>
        </Link>

        <Link href="/analytics?view=margin#analytics-breakdown" className={`panel analytics-stat analytics-stat-link ${selectedView === "margin" ? "active" : ""}`}>
          <span>
            Projected margin
          </span>
          <strong>
            {pct(
              overallProjectedMargin,
            )}
          </strong>
        </Link>

        <Link href="/analytics?view=labor#analytics-breakdown" className={`panel analytics-stat analytics-stat-link ${selectedView === "labor" ? "active" : ""}`}>
          <span>
            Tracked labor
          </span>
          <strong>
            {totals.actualLaborHours.toFixed(
              1,
            )}{" "}
            hr
          </strong>
          <small className="analytics-secondary-value">
            {money(
              totals.actualLaborCost,
            )}{" "}
            internal cost
          </small>
        </Link>
      </section>

      <section className="analytics-insight-grid">
        <article className="panel">
          <h2>
            Estimated plan
          </h2>

          <dl className="analytics-dl">
            <Link href="/analytics?view=revenue#analytics-breakdown">
              <dt>
                Pre-tax customer revenue
              </dt>
              <dd>
                {money(
                  totals.preTaxRevenue,
                )}
              </dd>
            </Link>

            <Link href="/analytics?view=estimated-cost#analytics-breakdown">
              <dt>
                Estimated direct costs
              </dt>
              <dd>
                {money(
                  totals.estimatedBase,
                )}
              </dd>
            </Link>

            <Link href="/analytics?view=estimated-profit#analytics-breakdown">
              <dt>
                Estimated gross profit
              </dt>
              <dd>
                {money(
                  totals.estimatedProfit,
                )}
              </dd>
            </Link>

            <Link href="/analytics?view=estimated-margin#analytics-breakdown">
              <dt>
                Estimated margin
              </dt>
              <dd>
                {pct(
                  overallEstimatedMargin,
                )}
              </dd>
            </Link>
          </dl>
        </article>

        <article className="panel">
          <h2>
            Current projection
          </h2>

          <dl className="analytics-dl">
            <Link href="/analytics?view=projected-cost#analytics-breakdown">
              <dt>
                Projected direct costs
              </dt>
              <dd>
                {money(
                  totals.projectedDirect,
                )}
              </dd>
            </Link>

            <Link href="/analytics?view=labor-cost#analytics-breakdown">
              <dt>
                Actual labor cost
              </dt>
              <dd>
                {money(
                  totals.actualLaborCost,
                )}
              </dd>
            </Link>

            <Link href="/analytics?view=profit#analytics-breakdown">
              <dt>
                Projected gross profit
              </dt>
              <dd>
                {money(
                  totals.projectedProfit,
                )}
              </dd>
            </Link>

            <Link href="/analytics?view=margin#analytics-breakdown">
              <dt>
                Projected margin
              </dt>
              <dd>
                {pct(
                  overallProjectedMargin,
                )}
              </dd>
            </Link>
          </dl>
        </article>

        <article className="panel">
          <h2>
            Quick signals
          </h2>

          <div className="analytics-signal">
            <span>
              Strongest projected profit
            </span>

            {bestProject ? <Link href={`/projects/${bestProject.id}`}><strong>{bestProject.title}</strong><small>{money(bestProject.projectedGrossProfit)}</small></Link> : <strong>—</strong>}
          </div>

          <div className="analytics-signal">
            <span>
              Lowest projected profit
            </span>

            {worstProject ? <Link href={`/projects/${worstProject.id}`}><strong>{worstProject.title}</strong><small>{money(worstProject.projectedGrossProfit)}</small></Link> : <strong>—</strong>}
          </div>
        </article>
      </section>

      <section className="panel analytics-breakdown" id="analytics-breakdown">
        <div className="panel-heading"><div><span className="eyebrow">Breakdown</span><h2>{selectedMetric.label} by project</h2></div><strong>{analytics.length} project{analytics.length === 1 ? "" : "s"}</strong></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Project</th><th>Customer</th><th>Status</th><th>{selectedMetric.label}</th></tr></thead>
            <tbody>
              {breakdownRows.map((row) => <tr key={row.id}><td><Link className="analytics-project-link" href={`/projects/${row.id}`}>{row.title}</Link><small>{row.estimateNumber}</small></td><td>{row.customer || "—"}</td><td className="capitalize">{String(row.status || "").replaceAll("_", " ")}</td><td className={selectedMetric.value(row) < 0 ? "analytics-negative" : ""}><strong>{selectedMetric.format(selectedMetric.value(row))}</strong>{selectedView === "labor" && <small>{money(row.actualLaborCost)} internal cost</small>}</td></tr>)}
              {!breakdownRows.length && <tr><td colSpan={4} className="empty-cell">No project data yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="panel">
        <div className="panel-heading">
          <div>
            <h2>
              Project profitability
            </h2>

          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  Project
                </th>
                <th>
                  Contract
                </th>
                <th>
                  Paid
                </th>
                <th>
                  Est. Cost
                </th>
                <th>
                  Actual Labor
                </th>
                <th>
                  Projected Profit
                </th>
                <th>
                  Margin
                </th>
              </tr>
            </thead>

            <tbody>
              {analytics.map(
                (row) => (
                  <tr key={row.id}>
                    <td>
                      <Link
                        href={`/projects/${row.id}`}
                        className="analytics-project-link"
                      >
                        {row.title}
                      </Link>

                      <small>
                        {[
                          row.estimateNumber,
                          row.customer,
                        ]
                          .filter(Boolean)
                          .join(
                            " · ",
                          )}
                      </small>
                    </td>

                    <td>
                      {money(
                        row.contractTotal,
                      )}
                    </td>

                    <td>
                      {money(
                        row.paid,
                      )}
                    </td>

                    <td>
                      {money(
                        row.estimatedBaseCost,
                      )}
                    </td>

                    <td>
                      {money(
                        row.actualLaborCost,
                      )}

                      <small>
                        {row.actualLaborHours.toFixed(
                          1,
                        )}{" "}
                        hr
                      </small>
                    </td>

                    <td
                      className={
                        row.projectedGrossProfit <
                        0
                          ? "analytics-negative"
                          : ""
                      }
                    >
                      {money(
                        row.projectedGrossProfit,
                      )}
                    </td>

                    <td
                      className={
                        row.projectedMargin <
                        0
                          ? "analytics-negative"
                          : ""
                      }
                    >
                      {pct(
                        row.projectedMargin,
                      )}
                    </td>
                  </tr>
                ),
              )}

              {!analytics.length && (
                <tr>
                  <td
                    colSpan={7}
                    className="empty-cell"
                  >
                    Accepted projects will appear here automatically.
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
