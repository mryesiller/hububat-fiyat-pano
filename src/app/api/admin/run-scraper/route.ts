import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const querySecret = request.nextUrl.searchParams.get("secret");

  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { scraper } = body as { scraper?: string };

  if (!scraper || !["tmo", "adana", "all"].includes(scraper)) {
    return NextResponse.json(
      { error: "Invalid scraper. Use: tmo, adana, or all" },
      { status: 400 }
    );
  }

  const baseUrl = new URL(request.url).origin;
  const init: RequestInit = {};
  if (cronSecret) {
    init.headers = { Authorization: `Bearer ${cronSecret}` };
  }

  const results: Record<string, unknown> = {};

  try {
    if (scraper === "tmo" || scraper === "all") {
      const tmoRes = await fetch(`${baseUrl}/api/scrape/tmo`, init);
      results.tmo = await tmoRes.json();
    }

    if (scraper === "adana" || scraper === "all") {
      const adanaRes = await fetch(`${baseUrl}/api/scrape/adana`, init);
      results.adana = await adanaRes.json();
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      scraper,
      results,
    });
  } catch (error) {
    console.error("Run scraper error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
