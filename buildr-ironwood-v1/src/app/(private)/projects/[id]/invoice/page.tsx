import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { IronwoodLogo } from "@/components/ironwood-logo";
import { PrintInvoiceButton } from "@/components/print-invoice-button";
import { InvoiceSendControls } from "@/components/invoice-send-controls";
import { money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

export default async function FinalInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data: project }, { data: changeOrders }, { data: callbackCharges }, { data: payments }, { data: settings }] = await Promise.all([
    supabase.from("projects").select("*,customers(*),estimates(id,estimate_number,title,total,scope,project_address)").eq("id", id).single(),
    supabase.from("change_orders").select("id,change_order_number,title,status,total,scope_changes,created_at").eq("project_id", id).eq("status", "accepted").order("created_at"),
    supabase.from("project_callbacks").select("id,callback_number,title,status,homeowner_amount,issue_description,reported_at").eq("project_id", id).in("status", ["accepted", "completed"]).is("deleted_at", null).gt("homeowner_amount", 0).order("reported_at"),
    supabase.from("payments").select("amount,received_at,payment_method,reference_number").eq("project_id", id).order("received_at"),
    supabase.from("business_settings").select("business_name,phone,email,website,address,license_number").maybeSingle(),
  ]);
  if (!project) notFound();
  const estimate = project.estimates as any;
  const customer = project.customers as any;
  const { data: invoiceEvents } = estimate?.id
    ? await supabase.from("estimate_events").select("event_type,metadata,created_at").eq("estimate_id", estimate.id).in("event_type", ["invoice_sent_email", "invoice_sent_via_text", "invoice_viewed", "receipt_sent_email", "receipt_sent_via_text"]).order("created_at", { ascending: false })
    : { data: [] };
  const sentEvents = (invoiceEvents ?? []).filter((event: any) => ["invoice_sent_email","invoice_sent_via_text","receipt_sent_email","receipt_sent_via_text"].includes(event.event_type));
  const viewEvents = (invoiceEvents ?? []).filter((event: any) => event.event_type === "invoice_viewed");
  const lastSent = sentEvents[0] as any;
  const lastViewed = viewEvents[0] as any;
  const baseTotal = Number(estimate?.total ?? project.contract_total ?? 0);
  const changeTotal = (changeOrders ?? []).reduce((sum, item) => sum + Number(item.total), 0);
  const callbackTotal = (callbackCharges ?? []).reduce((sum, item) => sum + Number(item.homeowner_amount), 0);
  const invoiceTotal = baseTotal + changeTotal + callbackTotal;
  const paid = (payments ?? []).reduce((sum, payment) => sum + Number(payment.amount), 0);
  const balance = Math.max(0, invoiceTotal - paid);
  const paidInFull = balance <= 0.005 && paid > 0;
  const finalPayment = paidInFull ? (payments ?? []).at(-1) : null;
  const customerAddress = [customer?.address_line1, customer?.address_line2, customer?.city, customer?.state, customer?.postal_code].filter(Boolean).join(", ");

  return <div className="invoice-screen">
    <div className="invoice-toolbar no-print"><Link href={`/projects/${id}`}><ArrowLeft size={16}/>Back to project</Link><div className="invoice-toolbar-actions"><InvoiceSendControls projectId={id} enabled={["substantially_complete", "complete"].includes(project.status)} paid={paidInFull}/><PrintInvoiceButton/></div></div>
    <section className="invoice-activity no-print" aria-label="Invoice delivery activity">
      <div><span>Sent</span><strong>{lastSent ? new Date(lastSent.created_at).toLocaleString() : "Not sent"}</strong><small>{lastSent?.event_type?.includes("text") ? "Text message" : lastSent ? "Email" : paidInFull ? "Send the paid receipt by email or text" : "Send by email or text to begin tracking"}</small></div>
      <div><span>Customer views</span><strong>{viewEvents.length ? `${viewEvents.length} ${viewEvents.length === 1 ? "view" : "views"}` : "Not viewed"}</strong><small>{lastViewed ? `Last viewed ${new Date(lastViewed.created_at).toLocaleString()} · ${String(lastViewed.metadata?.channel || "direct")}` : "Updates when the shared document link is opened"}</small></div>
    </section>
    <article className="invoice-sheet">
      <header className="invoice-header"><div><IronwoodLogo/><p>{settings?.address}</p><p>{[settings?.phone, settings?.email].filter(Boolean).join(" · ")}</p></div><div><span>{paidInFull ? "PAID RECEIPT" : "FINAL INVOICE"}</span><h1>{estimate?.estimate_number || "Project invoice"}</h1><p>{new Date().toLocaleDateString()}</p></div></header>
      <section className="invoice-parties"><div><span>{paidInFull ? "Receipt for" : "Bill to"}</span><strong>{customer?.first_name} {customer?.last_name}</strong><p>{customerAddress}</p><p>{[customer?.phone, customer?.email].filter(Boolean).join(" · ")}</p></div><div><span>Project</span><strong>{estimate?.title || project.name}</strong><p>{estimate?.project_address || project.project_address}</p></div></section>
      <section className="invoice-lines"><div className="invoice-line invoice-line--head"><span>Description</span><span>Type / status</span><strong>Amount</strong></div><div className="invoice-line"><span><b>Original accepted estimate</b><small>{estimate?.estimate_number}</small></span><span>Base contract</span><strong>{money(baseTotal)}</strong></div>{(changeOrders ?? []).map((changeOrder: any)=><div className="invoice-line invoice-line--change" key={changeOrder.id}><span><b>Change order: {changeOrder.title}</b><small>{changeOrder.change_order_number}{changeOrder.scope_changes ? ` · ${changeOrder.scope_changes}` : ""}</small></span><span className="capitalize">Change order · {String(changeOrder.status).replaceAll("_", " ")}</span><strong>+ {money(changeOrder.total)}</strong></div>)}{(callbackCharges ?? []).map((callback: any)=><div className="invoice-line invoice-line--change" key={callback.id}><span><b>Callback service: {callback.title}</b><small>{callback.callback_number}{callback.issue_description ? ` · ${callback.issue_description}` : ""}</small></span><span className="capitalize">Callback · {String(callback.status).replaceAll("_", " ")}</span><strong>+ {money(callback.homeowner_amount)}</strong></div>)}</section>
      <section className="invoice-summary"><dl><div><dt>Original estimate</dt><dd>{money(baseTotal)}</dd></div><div><dt>Change orders</dt><dd>{money(changeTotal)}</dd></div><div><dt>Customer-paid callbacks</dt><dd>{money(callbackTotal)}</dd></div><div><dt>Total completed work</dt><dd>{money(invoiceTotal)}</dd></div><div><dt>Payments received</dt><dd>− {money(paid)}</dd></div><div className="invoice-balance"><dt>{paidInFull ? "Balance" : "Balance due"}</dt><dd>{paidInFull ? "PAID IN FULL" : money(balance)}</dd></div></dl></section>
      {paidInFull && finalPayment && <section className="invoice-scope"><h2>Final payment</h2><p>{money(finalPayment.amount)} received {new Date(finalPayment.received_at).toLocaleDateString()}{finalPayment.payment_method ? ` · ${finalPayment.payment_method}` : ""}{finalPayment.reference_number ? ` · Ref ${finalPayment.reference_number}` : ""}</p></section>}
      {estimate?.scope && <section className="invoice-scope"><h2>Original scope</h2><p className="pre-line">{estimate.scope}</p></section>}
      <footer className="invoice-footer"><strong>{paidInFull ? "Thank you. This project is paid in full." : "Thank you for trusting Ironwood Remodeling with your home."}</strong><p>{paidInFull ? "Please keep this receipt for your records." : "Final payment is due at substantial completion unless another written payment arrangement applies."}</p>{settings?.license_number && <small>License {settings.license_number}</small>}</footer>
    </article>
  </div>;
}
