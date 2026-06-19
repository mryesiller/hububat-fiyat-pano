import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const querySecret = request.nextUrl.searchParams.get("secret");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseUrl = new URL(request.url).origin;
  const init: RequestInit = {};
  if (cronSecret) {
    init.headers = { Authorization: `Bearer ${cronSecret}` };
  }

  const results: Record<string, unknown> = {};

  try {
    // Run Adana scraper
    const adanaRes = await fetch(`${baseUrl}/api/scrape/adana`, init);
    results.adana = await adanaRes.json();
  } catch (error) {
    results.adana = { error: error instanceof Error ? error.message : "Failed" };
  }

  try {
    // Run TMO scraper
    const tmoRes = await fetch(`${baseUrl}/api/scrape/tmo`, init);
    results.tmo = await tmoRes.json();
  } catch (error) {
    results.tmo = { error: error instanceof Error ? error.message : "Failed" };
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  });
}
