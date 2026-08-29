import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { hashDeviceSecret } from "@/lib/owntracks";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function signedInUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

function deviceResponse(device: Record<string, unknown> | null) {
  if (!device) return null;
  return {
    label: device.label,
    username: device.username,
    active: device.active,
    last_seen_at: device.last_seen_at,
    created_at: device.created_at,
  };
}

export async function GET() {
  const user = await signedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await createAdminClient()
    .from("android_tracking_devices")
    .select("label,username,active,last_seen_at,created_at")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ device: deviceResponse(data) }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const user = await signedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const label = typeof body.label === "string" && body.label.trim()
    ? body.label.trim().slice(0, 80)
    : "Android phone";
  const username = `iw_${randomBytes(9).toString("base64url").toLowerCase()}`;
  const password = randomBytes(24).toString("base64url");
  const now = new Date().toISOString();
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("android_tracking_devices")
    .upsert({
      owner_id: user.id,
      label,
      username,
      secret_hash: hashDeviceSecret(password),
      active: true,
      last_seen_at: null,
      updated_at: now,
    }, { onConflict: "owner_id" })
    .select("label,username,active,last_seen_at,created_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    device: deviceResponse(data),
    credentials: {
      endpoint: `${new URL(request.url).origin}/api/android-tracking/owntracks`,
      username,
      password,
    },
  }, { status: 201, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
  if (!sameOrigin(request)) {
    return NextResponse.json({ error: "Origin not allowed" }, { status: 403 });
  }

  const user = await signedInUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await createAdminClient()
    .from("android_tracking_devices")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("owner_id", user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
