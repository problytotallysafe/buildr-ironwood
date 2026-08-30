import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const token = typeof body?.token === "string" ? body.token : "";
    if (!uuidPattern.test(token)) return NextResponse.json({ ok: true });

    const channel = body?.channel === "email" || body?.channel === "text" ? body.channel : "direct";
    const admin = createAdminClient();
    const { data: estimate } = await admin
      .from("estimates")
      .select("id,owner_id")
      .eq("public_token", token)
      .maybeSingle();
    if (!estimate) return NextResponse.json({ ok: true });

    const { data: project } = await admin
      .from("projects")
      .select("id,status")
      .eq("estimate_id", estimate.id)
      .in("status", ["substantially_complete", "complete"])
      .maybeSingle();
    if (!project) return NextResponse.json({ ok: true });

    const userAgent = request.headers.get("user-agent")?.slice(0, 500) || "";
    const { error } = await admin.from("estimate_events").insert({
      owner_id: estimate.owner_id,
      estimate_id: estimate.id,
      event_type: "invoice_viewed",
      metadata: { project_id: project.id, channel, user_agent: userAgent },
    });
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("INVOICE VIEW TRACKING ERROR:", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
