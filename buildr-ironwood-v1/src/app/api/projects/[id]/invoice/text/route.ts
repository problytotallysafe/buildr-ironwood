import { NextResponse } from "next/server";
import { money } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";

function normalizeUsPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const [{ data: project }, { data: changeOrders }, { data: callbackCharges }, { data: payments }] = await Promise.all([
      supabase.from("projects").select("id,name,status,contract_total,customers(first_name,last_name,phone),estimates(id,estimate_number,title,total,public_token)").eq("id", id).single(),
      supabase.from("change_orders").select("total").eq("project_id", id).eq("status", "accepted"),
      supabase.from("project_callbacks").select("homeowner_amount").eq("project_id", id).in("status", ["accepted", "completed"]).is("deleted_at", null).gt("homeowner_amount", 0),
      supabase.from("payments").select("amount").eq("project_id", id),
    ]);
    if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });
    if (!["substantially_complete", "complete"].includes(project.status)) return NextResponse.json({ error: "Mark the project substantially complete or complete before sending its final invoice." }, { status: 400 });
    const customer = Array.isArray(project.customers) ? project.customers[0] : project.customers;
    const estimate = Array.isArray(project.estimates) ? project.estimates[0] : project.estimates;
    if (!estimate?.public_token) return NextResponse.json({ error: "This project does not have a shareable accepted estimate." }, { status: 400 });
    const phone = normalizeUsPhone(customer?.phone || "");
    if (!phone) return NextResponse.json({ error: "Add a valid 10-digit mobile number to the customer record." }, { status: 400 });

    const total = Number(estimate.total ?? project.contract_total ?? 0)
      + (changeOrders ?? []).reduce((sum, item) => sum + Number(item.total), 0)
      + (callbackCharges ?? []).reduce((sum, item) => sum + Number(item.homeowner_amount), 0);
    const paid = (payments ?? []).reduce((sum, item) => sum + Number(item.amount), 0);
    const balance = Math.max(0, total - paid);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const invoiceUrl = `${appUrl}/invoice/${estimate.public_token}?via=text`;
    const message = `Hi ${customer?.first_name || "there"}, your Ironwood Remodeling final invoice for ${estimate.title || project.name} is ready. Balance due: ${money(balance)}. View it here: ${invoiceUrl}`;
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    let mode = "composer";
    let eventType = "invoice_text_composer_opened";
    let metadata: Record<string, unknown> = { project_id: id, phone, balance, invoice_url: invoiceUrl, delivery: "device_composer" };

    if (accountSid && authToken && from) {
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, { method: "POST", headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ To: phone, From: from, Body: message }) });
      const result = await response.json();
      if (!response.ok) return NextResponse.json({ error: result.message || "The text message could not be sent." }, { status: 500 });
      mode = "sent";
      eventType = "invoice_sent_via_text";
      metadata = { ...metadata, delivery: "twilio", message_sid: result.sid };
    }

    await supabase.from("estimate_events").insert({ owner_id: user.id, estimate_id: estimate.id, event_type: eventType, metadata });
    return NextResponse.json({ ok: true, mode, phone, smsUrl: `sms:${phone}?body=${encodeURIComponent(message)}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not prepare the invoice text." }, { status: 500 });
  }
}
