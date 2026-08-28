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

    const [{ data: project }, { data: changeOrders }, { data: payments }] = await Promise.all([
      supabase.from("projects").select("id,name,status,contract_total,customers(first_name,last_name,email),estimates(id,estimate_number,title,total,public_token)").eq("id", id).single(),
      supabase.from("change_orders").select("total").eq("project_id", id).neq("status", "declined"),
      supabase.from("payments").select("amount").eq("project_id", id),
    ]);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    if (project.status !== "complete") return NextResponse.json({ error: "Mark the project complete before sending its final invoice." }, { status: 400 });
    const customer = Array.isArray(project.customers) ? project.customers[0] : project.customers;
    const estimate = Array.isArray(project.estimates) ? project.estimates[0] : project.estimates;
    if (!estimate?.public_token) return NextResponse.json({ error: "This project does not have a shareable accepted estimate." }, { status: 400 });
    if (!customer?.email) return NextResponse.json({ error: "Add a customer email before sending." }, { status: 400 });
    if (!process.env.RESEND_API_KEY || !process.env.PROPOSAL_FROM_EMAIL) return NextResponse.json({ error: "Email is not configured. Add RESEND_API_KEY and PROPOSAL_FROM_EMAIL." }, { status: 500 });

    const total = Number(estimate.total ?? project.contract_total ?? 0) + (changeOrders ?? []).reduce((sum, item) => sum + Number(item.total), 0);
    const paid = (payments ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
    const balance = Math.max(0, total - paid);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const invoiceUrl = `${appUrl}/invoice/${estimate.public_token}`;
    const resend = new Resend(process.env.RESEND_API_KEY);
    const result = await resend.emails.send({
      from: process.env.PROPOSAL_FROM_EMAIL,
      to: customer.email,
      subject: `Ironwood final invoice ${estimate.estimate_number}: ${estimate.title || project.name}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:620px;margin:auto;color:#202722"><div style="background:#183d32;padding:28px;color:white"><div style="color:#c59a52;font-size:12px;letter-spacing:2px">IRONWOOD HOME REMODELING</div><h1 style="margin:8px 0">Your final invoice is ready.</h1></div><div style="padding:28px;border:1px solid #ded8cc"><p>Hello ${escapeHtml(customer.first_name || "there")},</p><p>Thank you for trusting us with <strong>${escapeHtml(estimate.title || project.name)}</strong>. Your final invoice, including approved change orders and payments received, is ready.</p><p style="font-size:26px;color:#183d32"><strong>Balance due: ${money(balance)}</strong></p><p><a href="${invoiceUrl}" style="display:inline-block;background:#c59a52;color:#172b24;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:bold">View final invoice</a></p><p>Please contact us if you have any questions.</p><p>Thank you,<br><strong>Ironwood Remodeling</strong><br>479.496.7819</p></div></div>`,
    }, { headers: { "Idempotency-Key": `invoice-${id}-${Date.now()}` } } as any);
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });

    await supabase.from("estimate_events").insert({ owner_id: user.id, estimate_id: estimate.id, event_type: "invoice_sent_email", metadata: { project_id: id, email: customer.email, balance, resend_id: result.data?.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not send the invoice." }, { status: 500 });
  }
}
