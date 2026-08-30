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

    const { data: changeOrder, error } = await supabase
      .from("change_orders")
      .select("id,change_order_number,title,total,public_token,status,customers(first_name,phone),projects(name,estimates(title))")
      .eq("id", id)
      .single();
    if (error || !changeOrder) return NextResponse.json({ error: "Change order not found." }, { status: 404 });
    if (changeOrder.status === "accepted") return NextResponse.json({ error: "This change order is already accepted." }, { status: 400 });

    const customer = Array.isArray(changeOrder.customers) ? changeOrder.customers[0] : changeOrder.customers;
    const phone = normalizeUsPhone(customer?.phone || "");
    if (!phone) return NextResponse.json({ error: "Add a valid 10-digit mobile number to the customer record." }, { status: 400 });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const approvalUrl = `${appUrl}/co/${changeOrder.public_token}?via=text`;
    const message = `Hi ${customer?.first_name || "there"}, Ironwood Remodeling change order ${changeOrder.change_order_number} for ${changeOrder.title} (${money(changeOrder.total)}) is ready. Review and approve it here: ${approvalUrl}`;
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    let mode = "composer";
    let eventType = "text_composer_opened";
    let metadata: Record<string, unknown> = { phone, approval_url: approvalUrl, delivery: "device_composer" };

    if (accountSid && authToken && from) {
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ To: phone, From: from, Body: message }),
      });
      const result = await response.json();
      if (!response.ok) return NextResponse.json({ error: result.message || "The text message could not be sent." }, { status: 500 });
      mode = "sent";
      eventType = "sent_via_text";
      metadata = { ...metadata, delivery: "twilio", message_sid: result.sid };
    }

    const now = new Date().toISOString();
    await supabase.from("change_orders").update({ status: "sent", sent_at: now }).eq("id", id);
    await supabase.from("change_order_events").insert({ owner_id: user.id, change_order_id: id, event_type: eventType, metadata });
    return NextResponse.json({ ok: true, mode, phone, smsUrl: `sms:${phone}?body=${encodeURIComponent(message)}` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not prepare the change-order text." }, { status: 500 });
  }
}
