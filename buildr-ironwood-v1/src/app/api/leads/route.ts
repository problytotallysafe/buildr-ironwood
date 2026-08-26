import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";

const allowedOrigin = process.env.WEBSITE_ORIGIN || "https://ironwood-remodeling.com";
const cors = { "Access-Control-Allow-Origin": allowedOrigin, "Access-Control-Allow-Headers": "Content-Type, X-Buildr-Lead-Key", "Access-Control-Allow-Methods": "POST, OPTIONS" };
export function OPTIONS() { return new NextResponse(null, { status: 204, headers: cors }); }

export async function POST(request: Request) {
  try {
    if (!process.env.BUILDR_LEAD_INGEST_KEY || request.headers.get("x-buildr-lead-key") !== process.env.BUILDR_LEAD_INGEST_KEY) return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: cors });
    if (request.headers.get("origin") && request.headers.get("origin") !== allowedOrigin) return NextResponse.json({ error: "Origin not allowed" }, { status: 403, headers: cors });
    const ownerId = process.env.BUILDR_OWNER_ID;
    if (!ownerId) return NextResponse.json({ error: "Lead owner is not configured" }, { status: 500, headers: cors });
    const body = await request.json();
    const firstName = String(body.first_name || body.name || "").trim().split(/\s+/)[0];
    if (!firstName) return NextResponse.json({ error: "Name is required" }, { status: 400, headers: cors });
    const values = { owner_id: ownerId, first_name: firstName, last_name: String(body.last_name || "").trim() || null, email: String(body.email || "").trim() || null, phone: String(body.phone || "").trim() || null, project_type: String(body.project_type || "").trim() || null, message: String(body.message || body.details || "").trim() || null, source: "website" };
    const admin = createAdminClient();
    const { data: lead, error } = await admin.from("leads").insert(values).select("id").single();
    if (error || !lead) return NextResponse.json({ error: error?.message || "Could not save lead" }, { status: 500, headers: cors });
    await admin.from("notifications").insert({ owner_id: ownerId, title: `New website lead: ${values.first_name}${values.last_name ? ` ${values.last_name}` : ""}`, body: values.project_type || values.message || "A homeowner submitted the contact form.", href: `/leads/${lead.id}`, kind: "lead" });
    if (process.env.RESEND_API_KEY && process.env.PROPOSAL_FROM_EMAIL && process.env.LEAD_NOTIFICATION_EMAIL) {
      await new Resend(process.env.RESEND_API_KEY).emails.send({ from: process.env.PROPOSAL_FROM_EMAIL, to: process.env.LEAD_NOTIFICATION_EMAIL, subject: `New Ironwood website lead: ${values.first_name}`, text: `Name: ${values.first_name} ${values.last_name || ""}\nPhone: ${values.phone || "—"}\nEmail: ${values.email || "—"}\nProject: ${values.project_type || "—"}\n\n${values.message || ""}` });
    }
    return NextResponse.json({ ok: true }, { status: 201, headers: cors });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Could not capture lead" }, { status: 500, headers: cors }); }
}
