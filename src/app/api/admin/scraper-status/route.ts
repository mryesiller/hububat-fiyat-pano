import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Get latest entries by source
    const { data: tmoEntries } = await supabase
      .from("price_entries")
      .select("*, product:products(name, slug), market:markets(name, slug)")
      .eq("source", "tmo_pdf")
      .order("date", { ascending: false })
      .limit(20);

    const { data: adanaEntries } = await supabase
      .from("price_entries")
      .select("*, product:products(name, slug), market:markets(name, slug)")
      .eq("source", "adana_api")
      .order("date", { ascending: false })
      .limit(20);

    const { data: manualEntries } = await supabase
      .from("price_entries")
      .select("*, product:products(name, slug), market:markets(name, slug)")
      .eq("source", "manual")
      .order("date", { ascending: false })
      .limit(20);

    // Get unique dates
    const { data: dates } = await supabase
      .from("price_entries")
      .select("date")
      .order("date", { ascending: false })
      .limit(10);

    const uniqueDates = [...new Set(dates?.map((d) => d.date) ?? [])];

    // Count entries per date
    const dateCounts: Record<string, Record<string, number>> = {};
    for (const date of uniqueDates) {
      dateCounts[date] = {};
      const { count: tmoCount } = await supabase
        .from("price_entries")
        .select("*", { count: "exact", head: true })
        .eq("date", date)
        .eq("source", "tmo_pdf");
      const { count: adanaCount } = await supabase
        .from("price_entries")
        .select("*", { count: "exact", head: true })
        .eq("date", date)
        .eq("source", "adana_api");
      dateCounts[date] = {
        tmo_pdf: tmoCount ?? 0,
        adana_api: adanaCount ?? 0,
      };
    }

    // Data quality checks
    const qualityIssues = [];

    // Check for zero or very low prices
    const { data: zeroPrices } = await supabase
      .from("price_entries")
      .select("*, product:products(name), market:markets(name)")
      .lte("price_tl", 0)
      .order("date", { ascending: false })
      .limit(10);

    if (zeroPrices && zeroPrices.length > 0) {
      qualityIssues.push({
        type: "zero_price",
        message: `${zeroPrices.length} kayıtta 0 veya negatif fiyat`,
        entries: zeroPrices,
      });
    }

    // Check for very high prices (possible data error)
    const { data: highPrices } = await supabase
      .from("price_entries")
      .select("*, product:products(name), market:markets(name)")
      .gte("price_tl", 100000)
      .order("date", { ascending: false })
      .limit(10);

    if (highPrices && highPrices.length > 0) {
      qualityIssues.push({
        type: "high_price",
        message: `${highPrices.length} kayıtta 100.000 TL/ton üzeri fiyat (hatalı olabilir)`,
        entries: highPrices,
      });
    }

    // Check for missing quantities
    const { data: missingQty } = await supabase
      .from("price_entries")
      .select("*, product:products(name), market:markets(name)")
      .is("quantity", null)
      .order("date", { ascending: false })
      .limit(10);

    if (missingQty && missingQty.length > 0) {
      qualityIssues.push({
        type: "missing_quantity",
        message: `${missingQty.length} kayıtta miktar bilgisi eksik`,
        entries: missingQty,
      });
    }

    return NextResponse.json({
      success: true,
      latestDates: uniqueDates,
      dateCounts,
      sources: {
        tmo_pdf: {
          latestDate: tmoEntries && tmoEntries.length > 0 ? tmoEntries[0].date : null,
          totalEntries: tmoEntries?.length ?? 0,
          latestEntries: tmoEntries?.slice(0, 5) ?? [],
        },
        adana_api: {
          latestDate: adanaEntries && adanaEntries.length > 0 ? adanaEntries[0].date : null,
          totalEntries: adanaEntries?.length ?? 0,
          latestEntries: adanaEntries?.slice(0, 5) ?? [],
        },
        manual: {
          latestDate: manualEntries && manualEntries.length > 0 ? manualEntries[0].date : null,
          totalEntries: manualEntries?.length ?? 0,
          latestEntries: manualEntries?.slice(0, 5) ?? [],
        },
      },
      qualityIssues,
      totalEntries: (tmoEntries?.length ?? 0) + (adanaEntries?.length ?? 0) + (manualEntries?.length ?? 0),
    });
  } catch (error) {
    console.error("Admin scraper status error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
