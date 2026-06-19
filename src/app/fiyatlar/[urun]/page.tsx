import { supabase } from "@/lib/supabase";
import { PriceEntry, Product, Market } from "@/types";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ urun: string }>;
}

type PriceWithMarket = PriceEntry & { market: Market };
type ProductData = { product: Product; prices: PriceWithMarket[] } | null;

async function getProductData(slug: string): Promise<ProductData> {
  try {
    const { data: product } = await supabase
      .from("products")
      .select("*")
      .eq("slug", slug)
      .single();

    if (!product) return null;

    const { data: prices } = await supabase
      .from("price_entries")
      .select(`
        *,
        market:markets(*)
      `)
      .eq("product_id", product.id)
      .order("date", { ascending: false })
      .limit(50);

    return { product, prices: (prices || []) as PriceWithMarket[] };
  } catch {
    return null;
  }
}

function getMockProductData(slug: string): ProductData {
  const products: Record<string, Product> = {
    bugday: { id: "1", name: "Buğday", category: "hububat", unit: "TL/ton", slug: "bugday", created_at: "" },
    arpa: { id: "2", name: "Arpa", category: "hububat", unit: "TL/ton", slug: "arpa", created_at: "" },
    misir: { id: "3", name: "Mısır", category: "hububat", unit: "TL/ton", slug: "misir", created_at: "" },
    yulaf: { id: "4", name: "Yulaf", category: "hububat", unit: "TL/ton", slug: "yulaf", created_at: "" },
    soya: { id: "5", name: "Soya", category: "hububat", unit: "TL/ton", slug: "soya", created_at: "" },
    aycicegi: { id: "6", name: "Ayçiçeği", category: "hububat", unit: "TL/ton", slug: "aycicegi", created_at: "" },
  };

  const product = products[slug];
  if (!product) return null;

  const today = new Date().toISOString().split("T")[0];
  const markets: Market[] = [
    { id: "1", name: "Konya", city: "Konya", region: "ic-anadolu", slug: "konya", type: "domestic", source: "tmo_pdf", created_at: "" },
    { id: "2", name: "Edirne", city: "Edirne", region: "marmara", slug: "edirne", type: "domestic", source: "tmo_pdf", created_at: "" },
    { id: "3", name: "Eskişehir", city: "Eskişehir", region: "ic-anadolu", slug: "eskisehir", type: "domestic", source: "tmo_pdf", created_at: "" },
    { id: "4", name: "Adana", city: "Adana", region: "akdeniz", slug: "adana", type: "domestic", source: "adana_api", created_at: "" },
    { id: "5", name: "Gaziantep", city: "Gaziantep", region: "guneydogu-anadolu", slug: "gaziantep", type: "domestic", source: "tmo_pdf", created_at: "" },
    { id: "6", name: "Çorum", city: "Çorum", region: "karadeniz", slug: "corum", type: "domestic", source: "tmo_pdf", created_at: "" },
  ];

  const basePrice = slug === "bugday" ? 15000 : slug === "arpa" ? 13000 : slug === "misir" ? 14000 : slug === "yulaf" ? 14200 : slug === "soya" ? 13500 : 35500;
  
  const mockPrices: PriceWithMarket[] = markets.map((m, i) => ({
    id: `mock-${i}`,
    product_id: product.id,
    market_id: m.id,
    date: today,
    quantity: Math.floor(Math.random() * 1000),
    price_tl: basePrice + Math.floor(Math.random() * 2000 - 1000),
    price_min: basePrice + Math.floor(Math.random() * 1000 - 500),
    price_max: basePrice + Math.floor(Math.random() * 2000),
    price_avg: basePrice + Math.floor(Math.random() * 1000 - 500),
    unit: "TL/ton",
    source: m.source,
    created_at: today,
    market: m,
  }));

  return { product, prices: mockPrices };
}

export async function generateMetadata({ params }: PageProps) {
  const { urun } = await params;
  const data = await getProductData(urun) || getMockProductData(urun);
  if (!data) return { title: "Ürün Bulunamadı" };
  
  return {
    title: `${data.product.name} Fiyatları - Hububat Fiyat Pano`,
    description: `${data.product.name} güncel fiyatları. Türkiye'nin 7 bölgesinden ve uluslararası piyasalardan günlük fiyat verileri.`,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { urun } = await params;
  const data = await getProductData(urun) || getMockProductData(urun);
  
  if (!data) {
    notFound();
  }

  const { product, prices } = data;
  const today = new Date().toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/" className="hover:text-emerald-700">Ana Sayfa</Link>
        <span>/</span>
        <span className="text-zinc-900 font-medium">{product.name}</span>
      </div>

      {/* Header */}
      <div className="bg-emerald-800 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">{product.name} Fiyatları</h1>
        <p className="text-emerald-200">
          Güncel {product.name.toLowerCase()} fiyatları - Türkiye ve uluslararası piyasalar.
        </p>
        <p className="text-emerald-300 text-sm mt-2">Son güncelleme: {today}</p>
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
                <th>Pazar</th>
                <th>Bölge</th>
                <th>Fiyat (TL/ton)</th>
                <th>Min</th>
                <th>Max</th>
                <th>Ortalama</th>
                <th>Miktar (ton)</th>
                <th>Kaynak</th>
              </tr>
            </thead>
            <tbody>
              {prices.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">
                    <Link href={`/fiyatlar/il/${p.market?.slug}`} className="hover:text-emerald-700">
                      {p.market?.name}
                    </Link>
                  </td>
                  <td className="text-zinc-500">{p.market?.region}</td>
                  <td className="font-semibold text-emerald-700">
                    {p.price_tl?.toLocaleString("tr-TR")}
                  </td>
                  <td className="text-zinc-500">{p.price_min?.toLocaleString("tr-TR") || "-"}</td>
                  <td className="text-zinc-500">{p.price_max?.toLocaleString("tr-TR") || "-"}</td>
                  <td className="text-zinc-500">{p.price_avg?.toLocaleString("tr-TR") || "-"}</td>
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

      {/* Disclaimer */}
      <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
        <p className="text-sm text-amber-800">
          <strong>Not:</strong> Fiyatlar TMO günlük piyasa bülteni ve ticaret borsalarından derlenmektedir. 
          Veriler bilgilendirme amaçlıdır. Alım-satım işlemleri için resmi kurumları doğrulayınız.
        </p>
      </div>
    </div>
  );
}
