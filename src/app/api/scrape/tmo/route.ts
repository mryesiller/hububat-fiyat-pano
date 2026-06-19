import { NextRequest, NextResponse } from "next/server";
import { PDFParse } from "pdf-parse";
import { createClient } from "@supabase/supabase-js";

const TMO_PDF_URL = "https://www.tmo.gov.tr/Upload/Document/piyasabulteni/piyasabulteni_tr.pdf";

const PRODUCT_HEADERS = [
  "ekmeklik buğday", "kırmızı sert buğday", "diğer beyaz buğdaylar",
  "diğer kırmızı buğdaylar", "düşük vasıflı ekmeklik buğday",
  "arpa", "mısır", "yulaf", "soya fasulyesi", "ayçiçeği",
  "kepekler", "bakliyat", "mercimek", "fasulye", "nohut", "pirinç"
];

const TMO_MARKETS: Record<string, string> = {
  "konya": "konya",
  "edirne": "edirne",
  "eskisehir": "eskisehir",
  "adana": "adana",
  "gaziantep": "gaziantep",
  "corum": "corum",
  "çorum": "corum",
  "polatlı": "polatli",
  "ankara": "ankara",
  "tekirdağ": "tekirdag",
  "izmir": "izmir",
  "manisa": "manisa",
  "aydın": "aydin",
  "mersin": "mersin",
  "antalya": "antalya",
  "samsun": "samsun",
  "tokat": "tokat",
  "diyarbakır": "diyarbakir",
  "elazığ": "elazig",
  "malatya": "malatya",
  "şanlıurfa": "sanliurfa",
  "mardin": "mardin",
};

const DOMESTIC_MARKETS = [
  "konya", "edirne", "eskisehir", "adana", "gaziantep", "corum", "çorum",
  "polatlı", "ankara", "tekirdağ", "izmir", "manisa", "aydın", "mersin",
  "antalya", "samsun", "tokat", "diyarbakır", "elazığ", "malatya", "şanlıurfa", "mardin"
];

interface ParsedPrice {
  product_slug: string;
  market_slug: string;
  quantity: number | null;
  price_tl: number;
  unit: string;
  source: string;
  date: string;
}

function getProductSlug(header: string): string | null {
  const lower = header.toLowerCase();
  if (lower.includes("buğday") && !lower.includes("kepeği")) return "bugday";
  if (lower.includes("arpa") && !lower.includes("kepeği")) return "arpa";
  if (lower.includes("mısır") && !lower.includes("kepeği") && !lower.includes("gluteni")) return "misir";
  if (lower.includes("yulaf")) return "yulaf";
  if (lower.includes("soya")) return "soya";
  if (lower.includes("ayçiçeği") && !lower.includes("yağı")) return "aycicegi";
  if (lower.includes("pirinç")) return "pirinc";
  if (lower.includes("mercimek")) return "mercimek";
  if (lower.includes("fasulye")) return "fasulye";
  if (lower.includes("nohut")) return "nohut";
  return null;
}

function parsePrices(text: string, date: string): ParsedPrice[] {
  const prices: ParsedPrice[] = [];
  const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  let currentProductSlug: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    // Detect product section headers
    for (const header of PRODUCT_HEADERS) {
      if (lineLower.includes(header) && line.length < 60) {
        const slug = getProductSlug(header);
        if (slug) {
          currentProductSlug = slug;
        }
        break;
      }
    }

    // Try to parse market lines - only exact matches for domestic markets
    if (currentProductSlug && DOMESTIC_MARKETS.includes(lineLower)) {
      const marketSlug = TMO_MARKETS[lineLower];
      if (!marketSlug) {
        i++;
        continue;
      }

      // Collect numbers from next lines (up to 8 values max)
      const numbers: (number | null)[] = [];
      let j = i + 1;
      while (j < lines.length && numbers.length < 8) {
        const nextLine = lines[j];
        const nextLower = nextLine.toLowerCase();

        // Stop if we hit another domestic market
        if (DOMESTIC_MARKETS.includes(nextLower)) break;
        // Stop if we hit a product header
        if (PRODUCT_HEADERS.some((h) => nextLower.includes(h))) break;
        // Stop if line contains text (not just numbers/dashes)
        if (/[a-zA-ZğüşıöçĞÜŞİÖÇ]{3,}/.test(nextLine)) break;

        if (nextLine === "-") {
          numbers.push(null);
        } else {
          const found = nextLine.match(/\d{1,3}(?:\.\d{3})*(?:,\d+)?/);
          if (found) {
            const numStr = found[0].replace(/\./g, "").replace(",", ".");
            const val = parseFloat(numStr);
            numbers.push(isNaN(val) ? null : val);
          } else {
            numbers.push(null);
          }
        }
        j++;
      }

      // Parse numbers based on TMO format
      // Format: qty1, tl1, usd1, qty2, tl2, usd2, last_year, change%
      let priceTl: number | null = null;
      let quantity: number | null = null;

      if (numbers.length >= 6) {
        // Two columns of data - use the second TL price (most recent)
        if (numbers[4] !== null && numbers[4] > 0) {
          priceTl = numbers[4];
          quantity = (numbers[3] !== null && numbers[3] > 0) ? numbers[3] : null;
        } else if (numbers[1] !== null && numbers[1] > 0) {
          priceTl = numbers[1];
          quantity = (numbers[0] !== null && numbers[0] > 0) ? numbers[0] : null;
        }
      } else if (numbers.length >= 3) {
        if (numbers[1] !== null && numbers[1] > 0) {
          priceTl = numbers[1];
          quantity = (numbers[0] !== null && numbers[0] > 0) ? numbers[0] : null;
        }
      }

      // Only add if we have a valid price (> 1000 TL/ton for grains)
      if (priceTl !== null && priceTl > 1000) {
        prices.push({
          product_slug: currentProductSlug,
          market_slug: marketSlug,
          quantity,
          price_tl: priceTl,
          unit: "TL/ton",
          source: "tmo_pdf",
          date,
        });
      }
    }

    i++;
  }

  return prices;
}

async function saveToSupabase(prices: ParsedPrice[]) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.log("Supabase not configured, returning prices");
    return { saved: 0, prices };
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Get product and market IDs
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
  const querySecret = request.nextUrl.searchParams.get("secret");

  // Allow Vercel cron or manual trigger with secret
  if (cronSecret && authHeader !== `Bearer ${cronSecret}` && querySecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date().toISOString().split("T")[0];

  try {
    // Download PDF
    const response = await fetch(TMO_PDF_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to download PDF: ${response.status}` },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    console.log(`PDF downloaded: ${buffer.length} bytes`);

    // Parse PDF
    const parser = new PDFParse({ data: buffer });
    const pdfData = await parser.getText();
    await parser.destroy();
    const text = pdfData.text;

    if (!text) {
      return NextResponse.json({ error: "Failed to extract text from PDF" }, { status: 500 });
    }

    // Parse prices
    const prices = parsePrices(text, today);
    console.log(`Parsed ${prices.length} price entries`);

    // Save to Supabase
    const result = await saveToSupabase(prices);

    return NextResponse.json({
      success: true,
      date: today,
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
    console.error("TMO scraper error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
