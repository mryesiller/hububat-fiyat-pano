import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const ADANA_API_URL = "https://adanatb.org.tr/bulten/api.php";

const HUBUBAT_PRODUCTS: Record<string, string> = {
  "Arpa": "arpa",
  "Mısır": "misir",
  "Mısır (Kırık)": "misir",
  "Buğday": "bugday",
  "Yulaf": "yulaf",
  "Soya": "soya",
};

interface AdanaEntry {
  maladi: string;
  urungrubu: string;
  satissekliaciklama: string;
  fiyat: number;
  fiyat2: number;
  miktar: number;
}

interface ParsedPrice {
  product_slug: string;
  market_slug: string;
  quantity: number | null;
  price_tl: number;
  price_min: number | null;
  price_max: number | null;
  unit: string;
  source: string;
  date: string;
}

function parseAdanaPrices(data: AdanaEntry[], dateStr: string): ParsedPrice[] {
  const prices: ParsedPrice[] = [];

  for (const entry of data) {
    // Skip export entries
    if (entry.satissekliaciklama?.trim() === "İhracat") continue;

    const malAdi = entry.maladi;
    const urunGrubu = entry.urungrubu;

    // Only process hububat products
    if (urunGrubu !== "HUBUBAT" && urunGrubu !== "HUBUBAT MAMÜLLERİ") continue;

    const productSlug = HUBUBAT_PRODUCTS[malAdi];
    if (!productSlug) continue;

    // Parse price - Adana API uses Kg, convert to TL/ton
    const fiyat = entry.fiyat || 0;
    const fiyat2 = entry.fiyat2 || 0;
    const miktar = entry.miktar || 0;

    let priceTl: number | null = null;
    if (fiyat > 0) {
      priceTl = fiyat * 1000;
    } else if (fiyat2 > 0) {
      priceTl = fiyat2 * 1000;
    }

    if (!priceTl) continue;

    // Convert quantity from Kg to ton
    const quantityTon = miktar ? miktar / 1000 : null;

    prices.push({
      product_slug: productSlug,
      market_slug: "adana",
      quantity: quantityTon,
      price_tl: priceTl,
      price_min: fiyat > 0 ? fiyat * 1000 : null,
      price_max: fiyat2 > 0 ? fiyat2 * 1000 : null,
      unit: "TL/ton",
      source: "adana_api",
      date: dateStr,
    });
  }

  return prices;
}

async function saveToSupabase(prices: ParsedPrice[]) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log("Supabase not configured");
    return { saved: 0, prices };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: products } = await supabase.from("products").select("id, slug");
  const { data: markets } = await supabase.from("markets").select("id, slug");

  const productMap = new Map(products?.map((p) => [p.slug, p.id]) ?? []);
  const marketMap = new Map(markets?.map((m) => [m.slug, m.id]) ?? []);

  const entries = [];
  for (const price of prices) {
    const productId = productMap.get(price.product_slug);
    const marketId = marketMap.get(price.market_slug);

    if (!productId || !marketId) {
      console.log(`Skipping: product=${price.product_slug}, market=${price.market_slug}`);
      continue;
    }

    entries.push({
      product_id: productId,
      market_id: marketId,
      date: price.date,
      price_tl: price.price_tl,
      price_min: price.price_min,
      price_max: price.price_max,
      quantity: price.quantity,
      unit: price.unit,
      source: price.source,
    });
  }

  if (entries.length === 0) {
    return { saved: 0, prices };
  }

  // Remove duplicates
  const seen = new Set<string>();
  const uniqueEntries = [];
  for (const entry of entries) {
    const key = `${entry.product_id}-${entry.market_id}-${entry.date}-${entry.source}`;
    if (!seen.has(key)) {
      seen.add(key);
      uniqueEntries.push(entry);
    }
  }

  const { error } = await supabase.from("price_entries").upsert(uniqueEntries, {
    onConflict: "product_id,market_id,date,source",
  });

  if (error) {
    console.error("Error saving to Supabase:", error);
    return { saved: 0, error: error.message, prices };
  }

  return { saved: uniqueEntries.length, prices };
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get yesterday's date (Adana API may not have today's data yet)
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().split("T")[0];

  try {
    const url = new URL(ADANA_API_URL);
    url.searchParams.set("start", dateStr);
    url.searchParams.set("end", dateStr);

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch Adana data: ${response.status}` },
        { status: 500 }
      );
    }

    const data = (await response.json()) as AdanaEntry[];
    console.log(`Received ${data.length} total entries from API`);

    const prices = parseAdanaPrices(data, dateStr);
    console.log(`Parsed ${prices.length} hububat price entries`);

    const result = await saveToSupabase(prices);

    return NextResponse.json({
      success: true,
      date: dateStr,
      parsed: prices.length,
      saved: result.saved,
      prices: prices.map((p) => ({
        product: p.product_slug,
        market: p.market_slug,
        price: p.price_tl,
        quantity: p.quantity,
      })),
    });
  } catch (error) {
    console.error("Adana scraper error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
