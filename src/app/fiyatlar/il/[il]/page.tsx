import { supabase } from "@/lib/supabase";
import { PriceEntry, Product, Market } from "@/types";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ il: string }>;
}

type PriceWithProduct = PriceEntry & { product: Product };
type CityData = { market: Market; prices: PriceWithProduct[] } | null;

async function getCityData(slug: string): Promise<CityData> {
  try {
    const { data: market } = await supabase
      .from("markets")
      .select("*")
      .eq("slug", slug)
      .single();

    if (!market) return null;

    const { data: prices } = await supabase
      .from("price_entries")
      .select(`
        *,
        product:products(*)
      `)
      .eq("market_id", market.id)
      .order("date", { ascending: false })
      .limit(50);

    return { market: market as Market, prices: (prices || []) as PriceWithProduct[] };
  } catch {
    return null;
  }
}

function getMockCityData(slug: string): CityData {
  const markets: Record<string, Market> = {
    konya: { id: "1", name: "Konya", city: "Konya", region: "ic-anadolu", slug: "konya", type: "domestic", source: "tmo_pdf", created_at: "" },
    edirne: { id: "2", name: "Edirne", city: "Edirne", region: "marmara", slug: "edirne", type: "domestic", source: "tmo_pdf", created_at: "" },
    eskisehir: { id: "3", name: "Eskişehir", city: "Eskişehir", region: "ic-anadolu", slug: "eskisehir", type: "domestic", source: "tmo_pdf", created_at: "" },
    adana: { id: "4", name: "Adana", city: "Adana", region: "akdeniz", slug: "adana", type: "domestic", source: "adana_api", created_at: "" },
    gaziantep: { id: "5", name: "Gaziantep", city: "Gaziantep", region: "guneydogu-anadolu", slug: "gaziantep", type: "domestic", source: "tmo_pdf", created_at: "" },
    corum: { id: "6", name: "Çorum", city: "Çorum", region: "karadeniz", slug: "corum", type: "domestic", source: "tmo_pdf", created_at: "" },
  };

  const market = markets[slug];
  if (!market) return null;

  const today = new Date().toISOString().split("T")[0];
  const products: Product[] = [
    { id: "1", name: "Buğday", category: "hububat", unit: "TL/ton", slug: "bugday", created_at: "" },
    { id: "2", name: "Arpa", category: "hububat", unit: "TL/ton", slug: "arpa", created_at: "" },
    { id: "3", name: "Mısır", category: "hububat", unit: "TL/ton", slug: "misir", created_at: "" },
    { id: "4", name: "Yulaf", category: "hububat", unit: "TL/ton", slug: "yulaf", created_at: "" },
  ];

  const mockPrices: PriceWithProduct[] = products.map((product, i) => ({
    id: `mock-${i}`,
    product_id: product.id,
    market_id: market.id,
    date: today,
    quantity: Math.floor(Math.random() * 1000),
    price_tl: 13000 + Math.floor(Math.random() * 5000),
    price_min: null,
    price_max: null,
    price_avg: null,
    unit: "TL/ton",
    source: market.source,
    created_at: today,
    product,
  }));

  return { market, prices: mockPrices };
}

export async function generateMetadata({ params }: PageProps) {
  const { il } = await params;
  const data = await getCityData(il) || getMockCityData(il);
  if (!data) return { title: "İl Bulunamadı" };
  
  return {
    title: `${data.market.name} Hububat Fiyatları - Hububat Fiyat Pano`,
    description: `${data.market.name} güncel hububat ve baklagil fiyatları.`,
  };
}

export default async function CityPage({ params }: PageProps) {
  const { il } = await params;
  const data = await getCityData(il) || getMockCityData(il);
  
  if (!data) {
    notFound();
  }

  const { market, prices } = data;
  const today = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/" className="hover:text-emerald-700">Ana Sayfa</Link>
        <span>/</span>
        <span className="text-zinc-900 font-medium">{market.name}</span>
      </div>

      {/* Header */}
      <div className="bg-emerald-800 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">{market.name} Hububat Fiyatları</h1>
        <p className="text-emerald-200">
          {market.name} piyasasındaki güncel hububat ve baklagil fiyatları.
        </p>
        <p className="text-emerald-300 text-sm mt-2">Bölge: {market.region} | Son güncelleme: {today}</p>
      </div>

      {/* Price Table */}
      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-200">
          <h2 className="text-lg font-bold">Günlük Fiyatlar</h2>
        </div>
        <div className="table-container">
          <table className="price-table">
            <thead>
              <tr>
                <th>Ürün</th>
                <th>Fiyat (TL/ton)</th>
                <th>Miktar (ton)</th>
                <th>Kaynak</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">
                    <Link href={`/fiyatlar/${p.product?.slug}`} className="hover:text-emerald-700">
                      {p.product?.name}
                    </Link>
                  </td>
                  <td className="font-semibold text-emerald-700">
                    {p.price_tl?.toLocaleString("tr-TR")}
                  </td>
                  <td className="text-zinc-500">{p.quantity?.toLocaleString("tr-TR") || "-"}</td>
                  <td>
                    <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                      p.source === "tmo_pdf" 
                        ? "bg-blue-100 text-blue-700" 
                        : p.source === "adana_api"
                        ? "bg-orange-100 text-orange-700"
                        : "bg-zinc-100 text-zinc-700"
                    }`}>
                      {p.source === "tmo_pdf" ? "TMO" : p.source === "adana_api" ? "Adana Borsa" : "Manuel"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
