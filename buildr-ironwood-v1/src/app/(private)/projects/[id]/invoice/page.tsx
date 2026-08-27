import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { IronwoodLogo } from "@/components/ironwood-logo";
import { PrintInvoiceButton } from "@/components/print-invoice-button";
import { money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export default async function FinalInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: project }, { data: changeOrders }, { data: payments }, { data: settings }] = await Promise.all([
    supabase.from("projects").select("*,customers(*),estimates(id,estimate_number,title,total,scope,project_address)").eq("id", id).single(),
    supabase.from("change_orders").select("id,change_order_number,title,status,total,scope_changes,created_at").eq("project_id", id).neq("status", "declined").order("created_at"),
    supabase.from("payments").select("amount").eq("project_id", id),
    supabase.from("business_settings").select("business_name,phone,email,website,address,license_number").maybeSingle(),
  ]);
  if (!project) notFound();
  const estimate = project.estimates as any;
  const customer = project.customers as any;
  const baseTotal = Number(estimate?.total ?? project.contract_total ?? 0);
  const changeTotal = (changeOrders ?? []).reduce((sum, item) => sum + Number(item.total), 0);
  const invoiceTotal = baseTotal + changeTotal;
  const paid = (payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const balance = Math.max(0, invoiceTotal - paid);
  const customerAddress = [customer?.address_line1, customer?.address_line2, customer?.city, customer?.state, customer?.postal_code].filter(Boolean).join(", ");

  return <div className="invoice-screen">
    <div className="invoice-toolbar no-print"><Link href={`/projects/${id}`}><ArrowLeft size={16}/>Back to project</Link><PrintInvoiceButton/></div>
    <article className="invoice-sheet">
      <header className="invoice-header"><div><IronwoodLogo/><p>{settings?.address}</p><p>{[settings?.phone, settings?.email].filter(Boolean).join(" · ")}</p></div><div><span>FINAL INVOICE</span><h1>{estimate?.estimate_number || "Project invoice"}</h1><p>{new Date().toLocaleDateString()}</p></div></header>
      <section className="invoice-parties"><div><span>Bill to</span><strong>{customer?.first_name} {customer?.last_name}</strong><p>{customerAddress}</p><p>{[customer?.phone, customer?.email].filter(Boolean).join(" · ")}</p></div><div><span>Project</span><strong>{estimate?.title || project.name}</strong><p>{estimate?.project_address || project.project_address}</p></div></section>
      <section className="invoice-lines"><div className="invoice-line invoice-line--head"><span>Description</span><span>Type / status</span><strong>Amount</strong></div><div className="invoice-line"><span><b>Original accepted estimate</b><small>{estimate?.estimate_number}</small></span><span>Base contract</span><strong>{money(baseTotal)}</strong></div>{(changeOrders ?? []).map((changeOrder: any)=><div className="invoice-line invoice-line--change" key={changeOrder.id}><span><b>Change order: {changeOrder.title}</b><small>{changeOrder.change_order_number}{changeOrder.scope_changes ? ` · ${changeOrder.scope_changes}` : ""}</small></span><span className="capitalize">Change order · {String(changeOrder.status).replaceAll("_", " ")}</span><strong>+ {money(changeOrder.total)}</strong></div>)}</section>
      <section className="invoice-summary"><dl><div><dt>Original estimate</dt><dd>{money(baseTotal)}</dd></div><div><dt>Change orders</dt><dd>{money(changeTotal)}</dd></div><div><dt>Total completed work</dt><dd>{money(invoiceTotal)}</dd></div><div><dt>Payments received</dt><dd>− {money(paid)}</dd></div><div className="invoice-balance"><dt>Balance due</dt><dd>{money(balance)}</dd></div></dl></section>
      {estimate?.scope && <section className="invoice-scope"><h2>Original scope</h2><p className="pre-line">{estimate.scope}</p></section>}
      <footer className="invoice-footer"><strong>Thank you for trusting Ironwood Remodeling with your home.</strong><p>Final payment is due at substantial completion unless another written payment arrangement applies.</p>{settings?.license_number && <small>License {settings.license_number}</small>}</footer>
    </article>
  </div>;
}
