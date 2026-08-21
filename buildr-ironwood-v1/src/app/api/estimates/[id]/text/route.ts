import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/money";

function normalizeUsPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: estimate, error } = await supabase
      .from("estimates")
      .select("id,estimate_number,revision_number,title,total,public_token,status,customers(first_name,last_name,phone)")
      .eq("id", id)
      .single();
    if (error || !estimate) return NextResponse.json({ error: "Estimate not found." }, { status: 404 });
    if (estimate.status === "accepted") return NextResponse.json({ error: "This estimate is already accepted." }, { status: 400 });

    const customer = Array.isArray(estimate.customers) ? estimate.customers[0] : estimate.customers;
    const phone = normalizeUsPhone(customer?.phone || "");
    if (!phone) return NextResponse.json({ error: "Add a valid 10-digit mobile number to the customer record." }, { status: 400 });

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;
    const directDelivery = Boolean(accountSid && authToken && from);
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const proposalUrl = `${appUrl}/p/${estimate.public_token}?via=text`;
    const revision = estimate.revision_number ? ` revision ${estimate.revision_number}` : "";
    const replyOption = directDelivery
      ? "If the link is difficult to use, call Ironwood at 479-496-7819 and we will help."
      : "If you reviewed it another way and cannot use the link, reply APPROVE and Ironwood will document your confirmation.";
    const message = `Hi ${customer?.first_name || "there"}, your Ironwood Remodeling estimate${revision} for ${estimate.title} (${money(estimate.total)}) is ready. Review the full scope and approve it here: ${proposalUrl} ${replyOption}`;

    let eventType = "text_composer_opened";
    let metadata: Record<string, unknown> = {
      phone,
      message,
      proposal_url: proposalUrl,
      delivery: "device_composer",
    };
    let mode = "composer";

    if (accountSid && authToken && from) {
      const body = new URLSearchParams({ To: phone, From: from, Body: message });
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body,
        },
      );
      const result = await response.json();
      if (!response.ok) return NextResponse.json({ error: result.message || "The text message could not be sent." }, { status: 500 });
      eventType = "sent_via_text";
      metadata = { ...metadata, delivery: "twilio", message_sid: result.sid };
      mode = "sent";
    }

    const now = new Date().toISOString();
    await supabase.from("estimates").update({ status: "sent", sent_at: now }).eq("id", id);
    await supabase.from("estimate_events").insert({
      owner_id: user.id,
      estimate_id: id,
      event_type: eventType,
      metadata,
    });

    return NextResponse.json({
      ok: true,
      mode,
      phone,
      message,
      smsUrl: `sms:${phone}?body=${encodeURIComponent(message)}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not prepare the text message." },
      { status: 500 },
    );
  }
}
