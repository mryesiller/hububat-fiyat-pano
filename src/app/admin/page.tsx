"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface ScraperStatus {
  success: boolean;
  latestDates: string[];
  dateCounts: Record<string, Record<string, number>>;
  sources: {
    tmo_pdf: { latestDate: string | null; totalEntries: number; latestEntries: any[] };
    adana_api: { latestDate: string | null; totalEntries: number; latestEntries: any[] };
    manual: { latestDate: string | null; totalEntries: number; latestEntries: any[] };
  };
  qualityIssues: any[];
  totalEntries: number;
}

export default function AdminPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginData, setLoginData] = useState({ username: "", password: "" });
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<ScraperStatus | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [runningScraper, setRunningScraper] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    productSlug: "bugday",
    marketSlug: "konya",
    price: "",
    quantity: "",
    date: new Date().toISOString().split("T")[0],
    source: "manual",
  });

  // Check if already logged in
  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (token) {
      setIsLoggedIn(true);
    }
  }, []);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(loginData),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem("admin_token", data.token);
        setIsLoggedIn(true);
      } else {
        setLoginError(data.error || "Giriş başarısız");
      }
    } catch {
      setLoginError("Bağlantı hatası");
    }
  }

  function handleLogout() {
    localStorage.removeItem("admin_token");
    setIsLoggedIn(false);
  }

  function getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem("admin_token");
    return token ? { "x-admin-token": token } : {};
  }

  async function fetchStatus() {
    setStatusLoading(true);
    try {
      const res = await fetch("/api/admin/scraper-status", {
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (data.success) {
        setStatus(data);
      } else if (data.error === "Unauthorized") {
        handleLogout();
      }
    } catch (err) {
      console.error("Status fetch error:", err);
    } finally {
      setStatusLoading(false);
    }
  }

  useEffect(() => {
    if (isLoggedIn) {
      fetchStatus();
      const interval = setInterval(fetchStatus, 30000);
      return () => clearInterval(interval);
    }
  }, [isLoggedIn]);

  async function runScraper(name: string) {
    setRunningScraper(name);
    setMessage("");
    try {
      const res = await fetch("/api/admin/run-scraper", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ scraper: name }),
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`${name.toUpperCase()} scraper başarıyla çalıştırıldı.`);
        fetchStatus();
      } else if (data.error === "Unauthorized") {
        handleLogout();
      } else {
        setMessage(`Hata: ${data.error || "Bilinmeyen hata"}`);
      }
    } catch (err) {
      setMessage(`Hata: ${err instanceof Error ? err.message : "Bilinmeyen hata"}`);
    } finally {
      setRunningScraper(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
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
        fetchStatus();
      }
    } catch (err) {
      setMessage(`Hata: ${err instanceof Error ? err.message : "Bilinmeyen hata"}`);
    } finally {
      setLoading(false);
    }
  }

  // Login Form
  if (!isLoggedIn) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="bg-white rounded-xl border border-zinc-200 p-8 w-full max-w-md">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-zinc-900">Admin Girişi</h1>
            <p className="text-zinc-500 text-sm mt-1">Hububat Fiyat Pano yönetim paneli</p>
          </div>

          {loginError && (
            <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm mb-4">
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Kullanıcı Adı</label>
              <input
                type="text"
                value={loginData.username}
                onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="ADMIN"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Şifre</label>
              <input
                type="password"
                value={loginData.password}
                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                className="w-full rounded-lg border border-zinc-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="••••••••"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-emerald-700 text-white py-2 rounded-lg hover:bg-emerald-800 transition-colors font-medium"
            >
              Giriş Yap
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Admin Dashboard
  return (
    <div className="space-y-8">
      <div className="bg-emerald-800 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Admin Paneli</h1>
            <p className="text-emerald-200">Veri takibi, otomasyon kontrolü ve manuel fiyat girişi.</p>
          </div>
          <button
            onClick={handleLogout}
            className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Çıkış Yap
          </button>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-lg ${message.includes("başarıyla") ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
          {message}
        </div>
      )}

      {/* Monitoring Dashboard */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Veri Durumu Monitörü</h2>
          <button
            onClick={fetchStatus}
            disabled={statusLoading}
            className="text-sm text-emerald-700 hover:text-emerald-800 font-medium"
          >
            {statusLoading ? "Yükleniyor..." : "Yenile"}
          </button>
        </div>

        {status && (
          <div className="space-y-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-50 rounded-lg p-4">
                <p className="text-xs text-zinc-500 mb-1">Toplam Kayıt</p>
                <p className="text-2xl font-bold text-zinc-900">{status.totalEntries}</p>
              </div>
              <div className="bg-zinc-50 rounded-lg p-4">
                <p className="text-xs text-zinc-500 mb-1">TMO Son Kayıt</p>
                <p className="text-lg font-bold text-zinc-900">
                  {status.sources.tmo_pdf.latestDate || "Veri yok"}
                </p>
                <p className="text-xs text-zinc-400">{status.sources.tmo_pdf.totalEntries} kayıt</p>
              </div>
              <div className="bg-zinc-50 rounded-lg p-4">
                <p className="text-xs text-zinc-500 mb-1">Adana API Son Kayıt</p>
                <p className="text-lg font-bold text-zinc-900">
                  {status.sources.adana_api.latestDate || "Veri yok"}
                </p>
                <p className="text-xs text-zinc-400">{status.sources.adana_api.totalEntries} kayıt</p>
              </div>
            </div>

            {/* Quality Issues */}
            {status.qualityIssues.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="text-sm font-bold text-red-800 mb-2">Veri Kalitesi Uyarıları</h3>
                <div className="space-y-2">
                  {status.qualityIssues.map((issue, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">⚠</span>
                      <div>
                        <p className="text-sm text-red-700">{issue.message}</p>
                        {issue.entries && issue.entries.length > 0 && (
                          <div className="mt-1 space-y-1">
                            {issue.entries.slice(0, 3).map((entry: any, j: number) => (
                              <p key={j} className="text-xs text-red-600">
                                {entry.product?.name || entry.product_id} - {entry.market?.name || entry.market_id}: {entry.price_tl} TL/ton
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Latest Entries */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="text-sm font-bold text-zinc-700 mb-2">TMO Son Kayıtlar</h3>
                <div className="space-y-1">
                  {status.sources.tmo_pdf.latestEntries.length > 0 ? (
                    status.sources.tmo_pdf.latestEntries.map((entry: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm p-2 bg-zinc-50 rounded">
                        <span>{entry.product?.name || entry.product_id}</span>
                        <span className="text-zinc-500">{entry.market?.name || entry.market_id}</span>
                        <span className="font-medium">{entry.price_tl?.toLocaleString("tr-TR")} TL/ton</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-400">Kayıt bulunamadı</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="text-sm font-bold text-zinc-700 mb-2">Adana API Son Kayıtlar</h3>
                <div className="space-y-1">
                  {status.sources.adana_api.latestEntries.length > 0 ? (
                    status.sources.adana_api.latestEntries.map((entry: any, i: number) => (
                      <div key={i} className="flex justify-between text-sm p-2 bg-zinc-50 rounded">
                        <span>{entry.product?.name || entry.product_id}</span>
                        <span className="text-zinc-500">{entry.market?.name || entry.market_id}</span>
                        <span className="font-medium">{entry.price_tl?.toLocaleString("tr-TR")} TL/ton</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-zinc-400">Kayıt bulunamadı</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Manual Scraper Controls */}
      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <h2 className="text-lg font-bold mb-4">Otomasyon Kontrolü</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 bg-zinc-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${status?.sources.tmo_pdf.latestDate === new Date().toISOString().split("T")[0] ? "bg-green-500" : "bg-yellow-500"}`}></div>
              <span className="text-sm font-medium">TMO PDF Parser</span>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              Son çalışma: {status?.sources.tmo_pdf.latestDate || "Bilinmiyor"}
            </p>
            <button
              onClick={() => runScraper("tmo")}
              disabled={runningScraper === "tmo"}
              className="w-full bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-50"
            >
              {runningScraper === "tmo" ? "Çalışıyor..." : "Şimdi Çalıştır"}
            </button>
          </div>
          <div className="p-4 bg-zinc-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-2 h-2 rounded-full ${status?.sources.adana_api.latestDate === new Date().toISOString().split("T")[0] ? "bg-green-500" : "bg-yellow-500"}`}></div>
              <span className="text-sm font-medium">Adana TB API</span>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              Son çalışma: {status?.sources.adana_api.latestDate || "Bilinmiyor"}
            </p>
            <button
              onClick={() => runScraper("adana")}
              disabled={runningScraper === "adana"}
              className="w-full bg-emerald-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-emerald-800 transition-colors disabled:opacity-50"
            >
              {runningScraper === "adana" ? "Çalışıyor..." : "Şimdi Çalıştır"}
            </button>
          </div>
          <div className="p-4 bg-zinc-50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm font-medium">Tüm Scraper'lar</span>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              TMO ve Adana API'yi sırayla çalıştır
            </p>
            <button
              onClick={() => runScraper("all")}
              disabled={runningScraper === "all"}
              className="w-full bg-blue-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-blue-800 transition-colors disabled:opacity-50"
            >
              {runningScraper === "all" ? "Çalışıyor..." : "Hepsini Çalıştır"}
            </button>
          </div>
        </div>
      </div>

      {/* Manual Entry Form */}
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
    </div>
  );
}
