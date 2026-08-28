import Link from "next/link";
import { EstimateActions } from "@/components/estimate-actions";
import { PageHeader } from "@/components/page-header";
import { StatusPill } from "@/components/status-pill";
import { money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export default async function DeletedEstimatesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("estimates")
    .select("id,estimate_number,title,status,total,deleted_at,customers(first_name,last_name)")
    .not("deleted_at", "is", null)
    .order("deleted_at", { ascending: false });

  return (
    <div className="page-wrap">
      <PageHeader
        eyebrow="Recoverable estimates"
        title="Trash"
        actions={<Link className="button button--outline" href="/estimates">Back to estimates</Link>}
      />
      <section className="panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>Estimate</th><th>Customer</th><th>Status</th><th>Deleted</th><th>Total</th><th>Manage</th></tr></thead>
            <tbody>
              {(data ?? []).map((estimate: any) => (
                <tr key={estimate.id}>
                  <td>{estimate.estimate_number}<small>{estimate.title}</small></td>
                  <td>{estimate.customers ? `${estimate.customers.first_name} ${estimate.customers.last_name}` : "—"}</td>
                  <td><StatusPill value={estimate.status} /></td>
                  <td>{estimate.deleted_at ? new Date(estimate.deleted_at).toLocaleDateString() : "—"}</td>
                  <td>{money(estimate.total)}</td>
                  <td><EstimateActions estimateId={estimate.id} estimateNumber={estimate.estimate_number} status={estimate.status} deleted /></td>
                </tr>
              ))}
              {!data?.length && <tr><td colSpan={6} className="empty-cell">Trash is empty.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
