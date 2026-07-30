import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const supabase = await createClient();

  if (code) await supabase.auth.exchangeCodeForSession(code);
  else if (tokenHash && type) await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

  return NextResponse.redirect(new URL("/dashboard", request.url));
}
