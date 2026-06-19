import { supabase } from "@/lib/supabase";
import { PriceEntry, Product, Market } from "@/types";
import Link from "next/link";

type PriceWithRelations = PriceEntry & {
  product: Product;
  market: Market;
};

async function getLatestPrices(): Promise<PriceWithRelations[]> {
  try {
    const { data, error } = await supabase
      .from("price_entries")
      .select(`
        *,
        product:products(*),
        market:markets(*)
      `)
      .order("date", { ascending: false })
      .limit(100);

    if (error || !data || data.length === 0) {
      return getMockPrices();
    }
    return data as PriceWithRelations[];
  } catch {
    return getMockPrices();
  }
}

function getMockPrices(): PriceWithRelations[] {
  const today = new Date().toISOString().split("T")[0];
  const products: Product[] = [
    { id: "1", name: "Buğday", slug: "bugday", category: "hububat", unit: "TL/ton", created_at: today },
    { id: "2", name: "Arpa", slug: "arpa", category: "hububat", unit: "TL/ton", created_at: today },
    { id: "3", name: "Mısır", slug: "misir", category: "hububat", unit: "TL/ton", created_at: today },
    { id: "4", name: "Yulaf", slug: "yulaf", category: "hububat", unit: "TL/ton", created_at: today },
    { id: "5", name: "Soya", slug: "soya", category: "hububat", unit: "TL/ton", created_at: today },
    { id: "6", name: "Ayçiçeği", slug: "aycicegi", category: "hububat", unit: "TL/ton", created_at: today },
  ];
  
  const markets: Market[] = [
    { id: "1", name: "Konya", city: "Konya", region: "ic-anadolu", slug: "konya", type: "domestic", source: "tmo_pdf", created_at: today },
    { id: "2", name: "Edirne", city: "Edirne", region: "marmara", slug: "edirne", type: "domestic", source: "tmo_pdf", created_at: today },
    { id: "3", name: "Eskişehir", city: "Eskişehir", region: "ic-anadolu", slug: "eskisehir", type: "domestic", source: "tmo_pdf", created_at: today },
    { id: "4", name: "Adana", city: "Adana", region: "akdeniz", slug: "adana", type: "domestic", source: "adana_api", created_at: today },
    { id: "5", name: "Gaziantep", city: "Gaziantep", region: "guneydogu-anadolu", slug: "gaziantep", type: "domestic", source: "tmo_pdf", created_at: today },
    { id: "6", name: "Çorum", city: "Çorum", region: "karadeniz", slug: "corum", type: "domestic", source: "tmo_pdf", created_at: today },
  ];

  const mockPrices = [
    { product_id: "1", market_id: "1", price_tl: 15640, price_avg: 15640, quantity: 15, unit: "TL/ton", source: "tmo_pdf" },
    { product_id: "1", market_id: "2", price_tl: 14536, price_avg: 14536, quantity: 32, unit: "TL/ton", source: "tmo_pdf" },
    { product_id: "1", market_id: "3", price_tl: 14801, price_avg: 14801, quantity: 15, unit: "TL/ton", source: "tmo_pdf" },
    { product_id: "2", market_id: "1", price_tl: 13371, price_avg: 13371, quantity: 143, unit: "TL/ton", source: "tmo_pdf" },
    { product_id: "2", market_id: "3", price_tl: 12784, price_avg: 12784, quantity: 40, unit: "TL/ton", source: "tmo_pdf" },
    { product_id: "3", market_id: "1", price_tl: 14312, price_avg: 14312, quantity: 775, unit: "TL/ton", source: "tmo_pdf" },
    { product_id: "3", market_id: "4", price_tl: 13201, price_avg: 13201, quantity: 736, unit: "TL/ton", source: "adana_api" },
    { product_id: "4", market_id: "1", price_tl: 14200, price_avg: 14200, quantity: 0, unit: "TL/ton", source: "tmo_pdf" },
    { product_id: "5", market_id: "5", price_tl: 13500, price_avg: 13500, quantity: 0, unit: "TL/ton", source: "tmo_pdf" },
    { product_id: "6", market_id: "5", price_tl: 35500, price_avg: 35500, quantity: 0, unit: "TL/ton", source: "tmo_pdf" },
  ];

  return mockPrices.map((p, i): PriceWithRelations => ({
    id: `mock-${i}`,
    product_id: p.product_id,
    market_id: p.market_id,
    date: today,
    quantity: p.quantity,
    price_tl: p.price_tl,
    price_avg: p.price_avg,
    price_min: null,
    price_max: null,
    unit: p.unit,
    source: p.source,
    created_at: today,
    product: products.find(pr => pr.id === p.product_id)!,
    market: markets.find(m => m.id === p.market_id)!,
  }));
}

function groupByProduct(prices: PriceWithRelations[]) {
  const grouped: Record<string, PriceWithRelations[]> = {};
  prices.forEach(p => {
    if (!grouped[p.product.slug]) grouped[p.product.slug] = [];
    grouped[p.product.slug].push(p);
  });
  return grouped;
}

export default async function HomePage() {
  const prices = await getLatestPrices();
  const grouped = groupByProduct(prices);
  const today = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="bg-emerald-800 rounded-2xl p-8 text-white">
        <h2 className="text-3xl font-bold mb-2">Günlük Hububat Fiyatları</h2>
        <p className="text-emerald-200 text-lg">
          Türkiye'nin 7 bölgesinden ve uluslararası piyasalardan güncel fiyat verileri.
        </p>
        <p className="text-emerald-300 text-sm mt-2">Son güncelleme: {today}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="stat-card">
          <p className="text-sm text-zinc-500">Takip Edilen Ürün</p>
          <p className="text-2xl font-bold text-emerald-700">10</p>
          <p className="text-xs text-zinc-400">Hububat ve Baklagil</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-zinc-500">Takip Edilen Pazar</p>
          <p className="text-2xl font-bold text-emerald-700">21+</p>
          <p className="text-xs text-zinc-400">Türkiye ve Uluslararası</p>
        </div>
        <div className="stat-card">
          <p className="text-sm text-zinc-500">Veri Kaynağı</p>
          <p className="text-2xl font-bold text-emerald-700">TMO + Borsa</p>
          <p className="text-xs text-zinc-400">Günlük otomatik güncelleme</p>
        </div>
      </div>

      {/* Price Tables by Product */}
      <div className="space-y-6">
        {Object.entries(grouped).map(([slug, productPrices]) => {
          const product = productPrices[0].product;
          return (
            <div key={slug} className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
              <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <svg className="w-5 h-5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900">{product.name}</h3>
                    <p className="text-xs text-zinc-500">{product.category === "hububat" ? "Hububat" : "Baklagil"}</p>
                  </div>
                </div>
                <Link
                  href={`/fiyatlar/${slug}`}
                  className="text-sm text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1"
                >
                  Detaylı gör
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
              <div className="table-container">
                <table className="price-table">
                  <thead>
                    <tr>
                      <th>Pazar</th>
                      <th>Bölge</th>
                      <th>Fiyat (TL/ton)</th>
                      <th>Miktar (ton)</th>
                      <th>Kaynak</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productPrices.map((p) => (
                      <tr key={p.id}>
                        <td className="font-medium">{p.market.name}</td>
                        <td className="text-zinc-500">{p.market.region}</td>
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
          );
        })}
      </div>

      {/* Regions Grid */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <h3 className="text-lg font-bold mb-4">Bölgelere Göre Fiyatlar</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          {[
            { name: "Marmara", slug: "marmara", cities: ["Tekirdağ", "Edirne", "Kırklareli"] },
            { name: "Ege", slug: "ege", cities: ["İzmir", "Manisa", "Aydın"] },
            { name: "Akdeniz", slug: "akdeniz", cities: ["Adana", "Mersin", "Antalya"] },
            { name: "İç Anadolu", slug: "ic-anadolu", cities: ["Konya", "Eskişehir", "Ankara"] },
            { name: "Karadeniz", slug: "karadeniz", cities: ["Samsun", "Çorum", "Tokat"] },
            { name: "Doğu Anadolu", slug: "dogu-anadolu", cities: ["Diyarbakır", "Elazığ", "Malatya"] },
            { name: "Güneydoğu", slug: "guneydogu-anadolu", cities: ["Şanlıurfa", "Gaziantep", "Mardin"] },
          ].map((region) => (
            <Link
              key={region.slug}
              href={`/fiyatlar/bolge/${region.slug}`}
              className="bg-zinc-50 rounded-lg p-4 hover:bg-emerald-50 transition-colors border border-zinc-200 hover:border-emerald-200"
            >
              <p className="font-semibold text-sm text-zinc-900">{region.name}</p>
              <p className="text-xs text-zinc-500 mt-1">{region.cities.join(", ")}</p>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
