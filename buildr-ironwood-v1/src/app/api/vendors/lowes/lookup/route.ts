import { NextResponse } from "next/server";

export async function GET(request: Request) {
  if (!process.env.LOWES_CLIENT_ID || !process.env.LOWES_CLIENT_SECRET || !process.env.LOWES_API_BASE_URL) {
    return NextResponse.json({
      error: "Lowe's API credentials are not configured yet.",
      next_step: "Apply for Lowe's Developer Hub access, then add the credentials to Vercel environment variables.",
    }, { status: 501 });
  }
  const query = new URL(request.url).searchParams.get("q");
  return NextResponse.json({ error: `Connector ready, but endpoint mapping must be completed for the approved Lowe's API product. Query: ${query ?? ""}` }, { status: 501 });
}
