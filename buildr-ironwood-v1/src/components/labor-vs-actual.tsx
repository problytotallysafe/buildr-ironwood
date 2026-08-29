"use client";

import Link from "next/link";

import { effectiveHourlyCost, ownerCostIsMissing } from "@/lib/labor-cost";

type LaborEstimateItem = {
  id: string;
  description: string;
  category: string | null;
  quantity: number | string;
  unit: string | null;
  unit_cost: number | string;
  markup_rate: number | string;
};

type TimeEntry = {
  id: string;
  team_member_id: string | null;
  work_category: string;
  duration_minutes: number | null;
  ended_at: string | null;
  hourly_cost: number | string | null;
};

const money = (n:number) => new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"}).format(n);
const hours = (n:number) => n.toFixed(2);
const isHourly = (u:string|null) => ["hr","hrs","hour","hours","labor hour","labor hours"].includes((u??"").trim().toLowerCase());

export function LaborVsActual({
  laborItems,
  timeEntries,
  ownerHourlyCost,
}: {
  laborItems: LaborEstimateItem[];
  timeEntries: TimeEntry[];
  ownerHourlyCost: number;
}) {
  const estimatedBase = laborItems.reduce((s,i)=>s+Number(i.quantity||0)*Number(i.unit_cost||0),0);
  const estimatedCustomer = laborItems.reduce((s,i)=>{
    const base=Number(i.quantity||0)*Number(i.unit_cost||0);
    return s+base*(1+Number(i.markup_rate||0)/100);
  },0);
  const estimatedHours = laborItems.filter(i=>isHourly(i.unit)).reduce((s,i)=>s+Number(i.quantity||0),0);

  const completed = timeEntries.filter(e=>e.ended_at && e.duration_minutes != null);
  const actualMinutes = completed.reduce((s,e)=>s+Number(e.duration_minutes||0),0);
  const actualHours = actualMinutes/60;
  const actualCost = completed.reduce((s,e)=>s+(Number(e.duration_minutes||0)/60)*effectiveHourlyCost(e,ownerHourlyCost),0);
  const incompleteOwnerCost = completed.some((entry)=>ownerCostIsMissing(entry,ownerHourlyCost));
  const costVariance = incompleteOwnerCost ? null : actualCost-estimatedBase;
  const hoursVariance = estimatedHours>0 ? actualHours-estimatedHours : null;

  const categories = Object.values(completed.reduce((acc,e)=>{
    const key=e.work_category||"General";
    if(!acc[key]) acc[key]={category:key,minutes:0,cost:0};
    const mins=Number(e.duration_minutes||0);
    acc[key].minutes+=mins;
    acc[key].cost+=(mins/60)*effectiveHourlyCost(e,ownerHourlyCost);
    return acc;
  },{} as Record<string,{category:string;minutes:number;cost:number}>)).sort((a,b)=>b.minutes-a.minutes);

  return (
    <section className="panel labor-analytics">
      <div className="panel-heading">
        <div>
          <h2>Estimated vs actual labor</h2>
          <p>Compare the accepted estimate against real time recorded on this project.</p>
        </div>
      </div>

      {incompleteOwnerCost && (
        <div className="settings-warning">
          <div><strong>Owner labor cost is not set.</strong><span>Actual cost below is incomplete until the internal owner rate is added.</span></div>
          <Link href="/settings/time">Set rate</Link>
        </div>
      )}

      <div className="labor-summary-grid">
        <article className="labor-stat">
          <span>Estimated labor cost</span>
          <strong>{money(estimatedBase)}</strong>
          <small>Internal/base estimate before markup</small>
        </article>

        <article className="labor-stat">
          <span>Actual labor cost</span>
          <strong>{money(actualCost)}</strong>
          <small>Tracked time × internal hourly cost</small>
        </article>

        <article className="labor-stat">
          <span>Cost variance</span>
          <strong className={costVariance==null?"":costVariance>0?"labor-bad":costVariance<0?"labor-good":""}>
            {costVariance==null?"—":`${costVariance>0?"+":""}${money(costVariance)}`}
          </strong>
          <small>{costVariance==null?"Set the owner rate to compare":costVariance>0?"Over estimate":costVariance<0?"Under estimate":"On target"}</small>
        </article>

        <article className="labor-stat">
          <span>Customer labor price</span>
          <strong>{money(estimatedCustomer)}</strong>
          <small>Accepted labor lines including markup</small>
        </article>

        <article className="labor-stat">
          <span>Estimated hours</span>
          <strong>{estimatedHours>0?`${hours(estimatedHours)} hr`:"—"}</strong>
          <small>Shown only for labor lines entered in hours</small>
        </article>

        <article className="labor-stat">
          <span>Actual hours</span>
          <strong>{hours(actualHours)} hr</strong>
          <small>Completed tracked time</small>
        </article>

        <article className="labor-stat">
          <span>Hours variance</span>
          <strong className={hoursVariance==null?"":hoursVariance>0?"labor-bad":hoursVariance<0?"labor-good":""}>
            {hoursVariance==null?"—":`${hoursVariance>0?"+":""}${hours(hoursVariance)} hr`}
          </strong>
          <small>{hoursVariance==null?"Estimate did not use hourly quantities":hoursVariance>0?"More hours than estimated":hoursVariance<0?"Fewer hours than estimated":"On target"}</small>
        </article>
      </div>

      {laborItems.length>0 && (
        <div className="labor-section">
          <h3>Accepted labor estimate</h3>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Labor item</th><th>Qty</th><th>Unit</th><th>Base</th><th>Customer</th></tr></thead>
              <tbody>
                {laborItems.map(item=>{
                  const base=Number(item.quantity||0)*Number(item.unit_cost||0);
                  const customer=base*(1+Number(item.markup_rate||0)/100);
                  return <tr key={item.id}>
                    <td>{item.description}{item.category&&<small>{item.category}</small>}</td>
                    <td>{Number(item.quantity||0)}</td>
                    <td>{item.unit||"—"}</td>
                    <td>{money(base)}</td>
                    <td>{money(customer)}</td>
                  </tr>
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {categories.length>0 && (
        <div className="labor-section">
          <h3>Actual time by work category</h3>
          <div className="labor-category-list">
            {categories.map(item=><div className="labor-category-row" key={item.category}>
              <div><strong>{item.category}</strong><small>{hours(item.minutes/60)} hours</small></div>
              <strong>{money(item.cost)}</strong>
            </div>)}
          </div>
        </div>
      )}
    </section>
  );
}
