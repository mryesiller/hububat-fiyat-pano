import { supabase } from "@/lib/supabase";
import { PriceEntry, Product, Market } from "@/types";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ bolge: string }>;
}

const regions: Record<string, { name: string; cities: string[] }> = {
  "marmara": { name: "Marmara", cities: ["Tekirdağ", "Edirne", "Kırklareli"] },
  "ege": { name: "Ege", cities: ["İzmir", "Manisa", "Aydın"] },
  "akdeniz": { name: "Akdeniz", cities: ["Adana", "Mersin", "Antalya"] },
  "ic-anadolu": { name: "İç Anadolu", cities: ["Konya", "Eskişehir", "Ankara"] },
  "karadeniz": { name: "Karadeniz", cities: ["Samsun", "Çorum", "Tokat"] },
  "dogu-anadolu": { name: "Doğu Anadolu", cities: ["Diyarbakır", "Elazığ", "Malatya"] },
  "guneydogu-anadolu": { name: "Güneydoğu Anadolu", cities: ["Şanlıurfa", "Gaziantep", "Mardin"] },
};

type PriceWithRelations = PriceEntry & { product: Product; market: Market };
type RegionData = { markets: Market[]; prices: PriceWithRelations[] } | null;

async function getRegionData(regionSlug: string): Promise<RegionData> {
  try {
    const { data: markets } = await supabase
      .from("markets")
      .select("*")
      .eq("region", regionSlug);

    if (!markets || markets.length === 0) return null;

    const marketIds = (markets as Market[]).map((m: Market) => m.id);

    const { data: prices } = await supabase
      .from("price_entries")
      .select(`
        *,
        product:products(*),
        market:markets(*)
      `)
      .in("market_id", marketIds)
      .order("date", { ascending: false })
      .limit(100);

    return { markets: markets as Market[], prices: (prices || []) as PriceWithRelations[] };
  } catch {
    return null;
  }
}

function getMockRegionData(regionSlug: string): RegionData {
  const region = regions[regionSlug];
  if (!region) return null;

  const today = new Date().toISOString().split("T")[0];
  const markets: Market[] = region.cities.map((city, i) => ({
    id: `mock-${i}`,
    name: city,
    city,
    region: regionSlug,
    slug: city.toLowerCase().replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s").replace(/ö/g, "o").replace(/ç/g, "c"),
    type: "domestic",
    source: "tmo_pdf",
    created_at: today,
  }));

  const products: Product[] = [
    { id: "1", name: "Buğday", category: "hububat", unit: "TL/ton", slug: "bugday", created_at: today },
    { id: "2", name: "Arpa", category: "hububat", unit: "TL/ton", slug: "arpa", created_at: today },
    { id: "3", name: "Mısır", category: "hububat", unit: "TL/ton", slug: "misir", created_at: today },
  ];

  const mockPrices: PriceWithRelations[] = markets.flatMap((market, mi) => 
    products.map((product, pi) => ({
      id: `mock-${mi}-${pi}`,
      product_id: product.id,
      market_id: market.id,
      date: today,
      quantity: Math.floor(Math.random() * 1000),
      price_tl: 13000 + Math.floor(Math.random() * 5000),
      price_min: null,
      price_max: null,
      price_avg: null,
      unit: "TL/ton",
      source: "tmo_pdf",
      created_at: today,
      product,
      market,
    }))
  );

  return { markets, prices: mockPrices };
}

export async function generateMetadata({ params }: PageProps) {
  const { bolge } = await params;
  const region = regions[bolge];
  if (!region) return { title: "Bölge Bulunamadı" };
  
  return {
    title: `${region.name} Bölgesi Hububat Fiyatları - Hububat Fiyat Pano`,
    description: `${region.name} bölgesi güncel hububat ve baklagil fiyatları.`,
  };
}

export default async function RegionPage({ params }: PageProps) {
  const { bolge } = await params;
  const region = regions[bolge];
  
  if (!region) {
    notFound();
  }

  const data = await getRegionData(bolge) || getMockRegionData(bolge);
  if (!data) {
    notFound();
  }

  const { prices } = data;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/" className="hover:text-emerald-700">Ana Sayfa</Link>
        <span>/</span>
        <span className="text-zinc-900 font-medium">{region.name} Bölgesi</span>
      </div>

      <div className="bg-emerald-800 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">{region.name} Bölgesi Hububat Fiyatları</h1>
        <p className="text-emerald-200">
          {region.cities.join(", ")} piyasalarındaki güncel hububat ve baklagil fiyatları.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-200">
          <h2 className="text-lg font-bold">Günlük Fiyatlar</h2>
        </div>
        <div className="table-container">
          <table className="price-table">
            <thead>
              <tr>
                <th>Şehir</th>
                <th>Ürün</th>
                <th>Fiyat (TL/ton)</th>
                <th>Miktar (ton)</th>
                <th>Kaynak</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((p: PriceEntry & { product: Product; market: Market }) => (
                <tr key={p.id}>
                  <td className="font-medium">
                    <Link href={`/fiyatlar/il/${p.market?.slug}`} className="hover:text-emerald-700">
                      {p.market?.name}
                    </Link>
                  </td>
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
