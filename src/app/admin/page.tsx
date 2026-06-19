"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AdminPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [formData, setFormData] = useState({
    productSlug: "bugday",
    marketSlug: "konya",
    price: "",
    quantity: "",
    date: new Date().toISOString().split("T")[0],
    source: "manual",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      // Get product and market IDs
      const { data: product } = await supabase
        .from("products")
        .select("id")
        .eq("slug", formData.productSlug)
        .single();

      const { data: market } = await supabase
        .from("markets")
        .select("id")
        .eq("slug", formData.marketSlug)
        .single();

      if (!product || !market) {
        setMessage("Ürün veya pazar bulunamadı.");
        setLoading(false);
        return;
      }

      const { error } = await supabase
        .from("price_entries")
        .upsert({
          product_id: product.id,
          market_id: market.id,
          date: formData.date,
          price_tl: parseFloat(formData.price),
          quantity: formData.quantity ? parseFloat(formData.quantity) : null,
          unit: "TL/ton",
          source: formData.source,
        }, {
          onConflict: "product_id,market_id,date,source",
        });

      if (error) {
        setMessage(`Hata: ${error.message}`);
      } else {
        setMessage("Fiyat başarıyla kaydedildi.");
        setFormData({ ...formData, price: "", quantity: "" });
      }
    } catch (err) {
      setMessage(`Hata: ${err instanceof Error ? err.message : "Bilinmeyen hata"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="bg-emerald-800 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Admin Paneli</h1>
        <p className="text-emerald-200">Manuel fiyat girişi ve veri yönetimi.</p>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.includes("başarıyla") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <h2 className="text-lg font-bold mb-4">Yeni Fiyat Girişi</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Ürün</label>
              <select
                value={formData.productSlug}
                onChange={(e) => setFormData({ ...formData, productSlug: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="bugday">Buğday</option>
                <option value="arpa">Arpa</option>
                <option value="misir">Mısır</option>
                <option value="yulaf">Yulaf</option>
                <option value="soya">Soya</option>
                <option value="aycicegi">Ayçiçeği</option>
                <option value="pirinc">Pirinç</option>
                <option value="mercimek">Mercimek</option>
                <option value="fasulye">Fasulye</option>
                <option value="nohut">Nohut</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Pazar</label>
              <select
                value={formData.marketSlug}
                onChange={(e) => setFormData({ ...formData, marketSlug: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="konya">Konya</option>
                <option value="edirne">Edirne</option>
                <option value="eskisehir">Eskişehir</option>
                <option value="adana">Adana</option>
                <option value="gaziantep">Gaziantep</option>
                <option value="corum">Çorum</option>
                <option value="tekirdag">Tekirdağ</option>
                <option value="izmir">İzmir</option>
                <option value="samsun">Samsun</option>
                <option value="diyarbakir">Diyarbakır</option>
                <option value="sanliurfa">Şanlıurfa</option>
                <option value="ankara">Ankara</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Fiyat (TL/ton)</label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="15000"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Miktar (ton)</label>
              <input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="100"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Tarih</label>
              <input
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Kaynak</label>
              <select
                value={formData.source}
                onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="manual">Manuel</option>
                <option value="tmo_pdf">TMO PDF</option>
                <option value="adana_api">Adana Borsa API</option>
                <option value="other_borsa">Diğer Borsa</option>
              </select>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-emerald-700 text-white px-6 py-2 rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-50"
          >
            {loading ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <h2 className="text-lg font-bold mb-4">Otomasyon Durumu</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium">TMO PDF Parser</span>
            </div>
            <span className="text-xs text-zinc-500">Günlük otomatik çalışıyor</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm font-medium">Adana TB API</span>
            </div>
            <span className="text-xs text-zinc-500">Günlük otomatik çalışıyor</span>
          </div>
          <div className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
              <span className="text-sm font-medium">Diğer Borsa Siteleri</span>
            </div>
            <span className="text-xs text-zinc-500">Manuel giriş gerekiyor</span>
          </div>
        </div>
      </div>
    </div>
  );
}
