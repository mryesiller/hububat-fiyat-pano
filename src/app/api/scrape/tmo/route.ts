import { NextRequest, NextResponse } from "next/server";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.js";
import { createClient } from "@supabase/supabase-js";
import fetch from "node-fetch";
import https from "https";
import path from "path";

const TMO_PDF_URL = "https://www.tmo.gov.tr/Upload/Document/piyasabulteni/piyasabulteni_tr.pdf";

// Custom agent for TMO SSL issues
const tmoAgent = new https.Agent({
  rejectUnauthorized: false,
});

// Set pdfjs worker
const workerPath = path.join(process.cwd(), "node_modules", "pdfjs-dist", "legacy", "build", "pdf.worker.js");
(pdfjs as any).GlobalWorkerOptions.workerSrc = workerPath;

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const data = new Uint8Array(buffer);
  const doc = await pdfjs.getDocument({ data }).promise;
  let text = "";

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    let lastX: number | null = null;
    let pageText = "";

    for (const item of content.items as any[]) {
      const x = item.transform[4];
      const y = item.transform[5];

      if (lastY !== null && Math.abs(lastY - y) > 2) {
        pageText += "\n" + item.str;
      } else if (lastX !== null && x - lastX > 6) {
        pageText += " " + item.str;
      } else {
        pageText += item.str;
      }

      lastY = y;
      lastX = x + (item.width || 0);
    }

    text += pageText + "\n";
    page.cleanup();
  }

  doc.destroy();
  return text;
}

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

  // Default to bugday for the first section (EKMEKLİK BUĞDAY header is often not extractable as text)
  let currentProductSlug: string | null = "bugday";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLower = line.toLowerCase();

    // Detect product section headers
    // Use startsWith for more precise matching to avoid false positives
    // in lines that mention products as descriptions (e.g., "Ukrayna Ekmeklik Buğday")
    for (const header of PRODUCT_HEADERS) {
      // Normalize spaces for comparison
      const normalizedLine = lineLower.replace(/\s+/g, ' ').trim();
      if ((normalizedLine.startsWith(header) || normalizedLine === header) && line.length < 60) {
        const slug = getProductSlug(header);
        if (slug) {
          currentProductSlug = slug;
        }
        break;
      }
    }

    // Try to parse market lines - check if line starts with a domestic market name
    if (currentProductSlug) {
      for (const marketName of DOMESTIC_MARKETS) {
        if (lineLower.startsWith(marketName + " ") || lineLower === marketName) {
          const marketSlug = TMO_MARKETS[marketName];
          if (!marketSlug) continue;

          // Extract values from the rest of the line
          const restOfLine = line.slice(marketName.length).trim();
          const values: (number | null)[] = [];

          // Split by spaces and parse each token
          const tokens = restOfLine.split(/\s+/);
          for (const token of tokens) {
            if (token === "-") {
              values.push(null);
            } else if (/^\d{1,3}(?:\.\d{3})*(?:,\d+)?$/.test(token)) {
              const numStr = token.replace(/\./g, "").replace(",", ".");
              const val = parseFloat(numStr);
              values.push(isNaN(val) ? null : val);
            } else if (/^[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(token)) {
              // Hit text, stop parsing numbers for this market
              break;
            }
            // Stop after we have 8 values
            if (values.length >= 8) break;
          }

          // Parse numbers based on TMO format
          // Format: qty1, tl1, usd1, qty2, tl2, usd2, last_year, change%
          let priceTl: number | null = null;
          let quantity: number | null = null;

          if (values.length >= 6) {
            // Two columns of data - use the second TL price (most recent)
            if (values[4] !== null && values[4] > 0) {
              priceTl = values[4];
              quantity = (values[3] !== null && values[3] > 0) ? values[3] : null;
            } else if (values[1] !== null && values[1] > 0) {
              priceTl = values[1];
              quantity = (values[0] !== null && values[0] > 0) ? values[0] : null;
            }
          } else if (values.length >= 3) {
            if (values[1] !== null && values[1] > 0) {
              priceTl = values[1];
              quantity = (values[0] !== null && values[0] > 0) ? values[0] : null;
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

          break; // Only process the first matching market per line
        }
      }
    }
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
      agent: tmoAgent,
    } as any);

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to download PDF: ${response.status}` },
        { status: 500 }
      );
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    console.log(`PDF downloaded: ${buffer.length} bytes`);

    // Parse PDF with custom renderer to preserve spacing
    const text = await extractTextFromPDF(buffer);

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
    if (error instanceof Error && 'cause' in error) {
      console.error("Error cause:", (error as any).cause);
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error", cause: error instanceof Error && 'cause' in error ? String((error as any).cause) : undefined },
      { status: 500 }
    );
  }
}
