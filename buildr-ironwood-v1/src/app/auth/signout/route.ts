import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const url = new URL("/login", request.url);
  if (request.nextUrl.searchParams.get("reason") === "no-access") {
    url.searchParams.set("status", "no-access");
  }
  return NextResponse.redirect(url);
}
