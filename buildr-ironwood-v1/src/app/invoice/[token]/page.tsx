import { notFound } from "next/navigation";
import { IronwoodLogo } from "@/components/ironwood-logo";
import { PrintInvoiceButton } from "@/components/print-invoice-button";
import { PublicInvoiceViewTracker } from "@/components/public-invoice-view-tracker";
import { money } from "@/lib/money";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function PublicInvoicePage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ via?: string }> }) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const supabase = createAdminClient();
  const { data: estimate } = await supabase.from("estimates").select("id,estimate_number,title,total,scope,project_address,customers(first_name,last_name,email,phone,address_line1,address_line2,city,state,postal_code)").eq("public_token", token).single();
  if (!estimate) notFound();
  const { data: project } = await supabase.from("projects").select("id,name,status,contract_total,project_address").eq("estimate_id", estimate.id).single();
  if (!project || !["substantially_complete", "complete"].includes(project.status)) notFound();
  const [{ data: changeOrders }, { data: callbackCharges }, { data: payments }, { data: settings }] = await Promise.all([
    supabase.from("change_orders").select("id,change_order_number,title,status,total,scope_changes,created_at").eq("project_id", project.id).eq("status", "accepted").order("created_at"),
    supabase.from("project_callbacks").select("id,callback_number,title,status,homeowner_amount,issue_description,reported_at").eq("project_id", project.id).in("status", ["accepted", "completed"]).is("deleted_at", null).gt("homeowner_amount", 0).order("reported_at"),
    supabase.from("payments").select("amount").eq("project_id", project.id),
    supabase.from("business_settings").select("business_name,phone,email,website,address,license_number").maybeSingle(),
  ]);
  const customer = Array.isArray(estimate.customers) ? estimate.customers[0] : estimate.customers;
  const baseTotal = Number(estimate.total ?? project.contract_total ?? 0);
  const changeTotal = (changeOrders ?? []).reduce((sum, item) => sum + Number(item.total), 0);
  const callbackTotal = (callbackCharges ?? []).reduce((sum, item) => sum + Number(item.homeowner_amount), 0);
  const invoiceTotal = baseTotal + changeTotal + callbackTotal;
  const paid = (payments ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
  const balance = Math.max(0, invoiceTotal - paid);
  const customerAddress = [customer?.address_line1, customer?.address_line2, customer?.city, customer?.state, customer?.postal_code].filter(Boolean).join(", ");

  return <div className="invoice-screen">
    <PublicInvoiceViewTracker token={token} via={query.via}/>
    <div className="invoice-toolbar invoice-toolbar--public no-print"><span>Ironwood final invoice</span><PrintInvoiceButton/></div>
    <article className="invoice-sheet">
      <header className="invoice-header"><div><IronwoodLogo/><p>{settings?.address}</p><p>{[settings?.phone, settings?.email].filter(Boolean).join(" · ")}</p></div><div><span>FINAL INVOICE</span><h1>{estimate.estimate_number || "Project invoice"}</h1><p>{new Date().toLocaleDateString()}</p></div></header>
      <section className="invoice-parties"><div><span>Bill to</span><strong>{customer?.first_name} {customer?.last_name}</strong><p>{customerAddress}</p><p>{[customer?.phone, customer?.email].filter(Boolean).join(" · ")}</p></div><div><span>Project</span><strong>{estimate.title || project.name}</strong><p>{estimate.project_address || project.project_address}</p></div></section>
      <section className="invoice-lines"><div className="invoice-line invoice-line--head"><span>Description</span><span>Type / status</span><strong>Amount</strong></div><div className="invoice-line"><span><b>Original accepted estimate</b><small>{estimate.estimate_number}</small></span><span>Base contract</span><strong>{money(baseTotal)}</strong></div>{(changeOrders ?? []).map((changeOrder)=><div className="invoice-line invoice-line--change" key={changeOrder.id}><span><b>Change order: {changeOrder.title}</b><small>{changeOrder.change_order_number}{changeOrder.scope_changes ? ` · ${changeOrder.scope_changes}` : ""}</small></span><span className="capitalize">Change order · {String(changeOrder.status).replaceAll("_", " ")}</span><strong>+ {money(changeOrder.total)}</strong></div>)}{(callbackCharges ?? []).map((callback)=><div className="invoice-line invoice-line--change" key={callback.id}><span><b>Callback service: {callback.title}</b><small>{callback.callback_number}{callback.issue_description ? ` · ${callback.issue_description}` : ""}</small></span><span className="capitalize">Callback · {String(callback.status).replaceAll("_", " ")}</span><strong>+ {money(callback.homeowner_amount)}</strong></div>)}</section>
      <section className="invoice-summary"><dl><div><dt>Original estimate</dt><dd>{money(baseTotal)}</dd></div><div><dt>Change orders</dt><dd>{money(changeTotal)}</dd></div><div><dt>Customer-paid callbacks</dt><dd>{money(callbackTotal)}</dd></div><div><dt>Total completed work</dt><dd>{money(invoiceTotal)}</dd></div><div><dt>Payments received</dt><dd>− {money(paid)}</dd></div><div className="invoice-balance"><dt>Balance due</dt><dd>{money(balance)}</dd></div></dl></section>
      {estimate.scope && <section className="invoice-scope"><h2>Original scope</h2><p className="pre-line">{estimate.scope}</p></section>}
      <footer className="invoice-footer"><strong>Thank you for trusting Ironwood Remodeling with your home.</strong><p>Final payment is due at substantial completion unless another written payment arrangement applies.</p>{settings?.license_number && <small>License {settings.license_number}</small>}</footer>
    </article>
  </div>;
}
