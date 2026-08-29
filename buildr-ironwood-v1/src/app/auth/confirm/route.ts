import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const requestedNext = searchParams.get("next") || "/dashboard";
  const isRecovery = type === "recovery" || requestedNext === "/update-password";
  const safeNext = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/dashboard";
  const next = isRecovery ? "/update-password" : safeNext;

  // Implicit recovery links keep their short-lived tokens in the URL fragment,
  // which is intentionally invisible to the server. Bridge that fragment to the
  // password page so a link requested in one browser can be opened on another.
  if (isRecovery && !code && !tokenHash) {
    return new NextResponse(
      `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="robots" content="noindex">
    <title>Opening password reset…</title>
  </head>
  <body>
    <p>Opening the Buildr password reset…</p>
    <script>
      window.location.replace(
        window.location.hash
          ? "/update-password" + window.location.hash
          : "/update-password?status=invalid"
      );
    </script>
    <noscript><a href="/update-password?status=invalid">Continue to password reset</a></noscript>
  </body>
</html>`,
      {
        headers: {
          "Cache-Control": "private, no-store",
          "Content-Security-Policy": "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'",
          "Content-Type": "text/html; charset=utf-8",
          "Referrer-Policy": "no-referrer",
        },
      },
    );
  }

  const supabase = await createClient();

  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("Missing authentication code") };

  const destination = result.error
    ? isRecovery
      ? "/update-password?status=invalid"
      : "/login?status=invalid"
    : next;
  const response = NextResponse.redirect(new URL(destination, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
