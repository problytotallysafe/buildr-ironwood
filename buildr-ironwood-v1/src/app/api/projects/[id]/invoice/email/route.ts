import { NextResponse } from "next/server";
import { Resend } from "resend";
import { money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] || character);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const [{ data: project }, { data: changeOrders }, { data: callbackCharges }, { data: payments }] = await Promise.all([
      supabase.from("projects").select("id,name,status,contract_total,customers(first_name,last_name,email),estimates(id,estimate_number,title,total,public_token)").eq("id", id).single(),
      supabase.from("change_orders").select("total").eq("project_id", id).eq("status", "accepted"),
      supabase.from("project_callbacks").select("homeowner_amount").eq("project_id", id).in("status", ["accepted", "completed"]).is("deleted_at", null).gt("homeowner_amount", 0),
      supabase.from("payments").select("amount").eq("project_id", id),
    ]);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    if (!["substantially_complete", "complete"].includes(project.status)) return NextResponse.json({ error: "Mark the project substantially complete or complete before sending its final invoice." }, { status: 400 });
    const customer = Array.isArray(project.customers) ? project.customers[0] : project.customers;
    const estimate = Array.isArray(project.estimates) ? project.estimates[0] : project.estimates;
    if (!estimate?.public_token) return NextResponse.json({ error: "This project does not have a shareable accepted estimate." }, { status: 400 });
    if (!customer?.email) return NextResponse.json({ error: "Add a customer email before sending." }, { status: 400 });
    if (!process.env.RESEND_API_KEY || !process.env.PROPOSAL_FROM_EMAIL) return NextResponse.json({ error: "Email is not configured. Add RESEND_API_KEY and PROPOSAL_FROM_EMAIL." }, { status: 500 });

    const total = Number(estimate.total ?? project.contract_total ?? 0)
      + (changeOrders ?? []).reduce((sum, item) => sum + Number(item.total), 0)
      + (callbackCharges ?? []).reduce((sum, item) => sum + Number(item.homeowner_amount), 0);
    const paid = (payments ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
    const balance = Math.max(0, total - paid);
    const paidInFull = balance <= 0.005 && paid > 0;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const invoiceUrl = `${appUrl}/invoice/${estimate.public_token}?via=email`;
    const resend = new Resend(process.env.RESEND_API_KEY);
    const subject = paidInFull
      ? `Ironwood paid receipt ${estimate.estimate_number}: ${estimate.title || project.name}`
      : `Ironwood final invoice ${estimate.estimate_number}: ${estimate.title || project.name}`;
    const headline = paidInFull ? "Your paid-in-full receipt is ready." : "Your final invoice is ready.";
    const amountLabel = paidInFull ? `Paid in full: ${money(total)}` : `Balance due: ${money(balance)}`;
    const buttonLabel = paidInFull ? "View paid receipt" : "View final invoice";
    const copy = paidInFull
      ? `Thank you for your final payment on <strong>${escapeHtml(estimate.title || project.name)}</strong>. Your receipt shows the completed project total and all payments received.`
      : `Thank you for trusting us with <strong>${escapeHtml(estimate.title || project.name)}</strong>. Your final invoice, including approved changes, customer-paid callback service, and payments received, is ready.`;
    const result = await resend.emails.send({
      from: process.env.PROPOSAL_FROM_EMAIL,
      to: customer.email,
      subject,
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#202722"><div style="background:#183d32;padding:28px;color:white"><div style="color:#c59a52;font-size:12px;letter-spacing:2px">IRONWOOD HOME REMODELING</div><h1 style="margin:8px 0">${headline}</h1></div><div style="padding:28px;border:1px solid #ded8cc"><p>Hello ${escapeHtml(customer.first_name || "there")},</p><p>${copy}</p><p style="font-size:26px;color:#183d32"><strong>${amountLabel}</strong></p><p><a href="${invoiceUrl}" style="display:inline-block;background:#c59a52;color:#172b24;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:bold">${buttonLabel}</a></p><p>${paidInFull ? "Please keep this receipt for your records." : "Please contact us if you have any questions."}</p><p>Thank you,<br><strong>Ironwood Remodeling</strong><br>479.496.7819</p></div></div>`,
    }, { headers: { "Idempotency-Key": `${paidInFull ? "receipt" : "invoice"}-${id}-${Date.now()}` } } as any);
    if (result.error) return NextResponse.json({ error: result.error.message || "The email provider rejected the message." }, { status: 500 });

    await supabase.from("estimate_events").insert({ owner_id: user.id, estimate_id: estimate.id, event_type: paidInFull ? "receipt_sent_email" : "invoice_sent_email", metadata: { project_id: id, email: customer.email, balance, paid, total, resend_id: result.data?.id } });
    return NextResponse.json({ ok: true, document: paidInFull ? "receipt" : "invoice" });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send the document." }, { status: 500 });
  }
}
