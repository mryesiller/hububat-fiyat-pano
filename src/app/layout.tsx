import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hububat Fiyat Pano - Türkiye Hububat ve Baklagil Fiyatları",
  description: "Türkiye'nin 7 bölgesinden 21 il ve uluslararası piyasalardan günlük, haftalık ve aylık hububat fiyatları. TMO, borsa ve piyasa verileri.",
  keywords: "hububat fiyatları, buğday fiyatı, arpa fiyatı, mısır fiyatı, ayçiçeği fiyatı, TMO fiyatları, borsa fiyatları, Türkiye hububat",
  openGraph: {
    title: "Hububat Fiyat Pano - Türkiye Hububat Fiyatları",
    description: "Türkiye'nin 7 bölgesinden günlük hububat ve baklagil fiyatları.",
    type: "website",
    locale: "tr_TR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="tr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-zinc-50 text-zinc-900">
        <header className="bg-emerald-800 text-white shadow-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between">
              <a href="/" className="flex items-center gap-3">
                <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h1 className="text-xl font-bold">Hububat Fiyat Pano</h1>
                  <p className="text-xs text-emerald-200">Türkiye Hububat ve Baklagil Fiyatları</p>
                </div>
              </a>
              <nav className="hidden md:flex items-center gap-6">
                <a href="/" className="text-sm hover:text-emerald-200 transition-colors">Ana Sayfa</a>
                <a href="/fiyatlar/bugday" className="text-sm hover:text-emerald-200 transition-colors">Buğday</a>
                <a href="/fiyatlar/arpa" className="text-sm hover:text-emerald-200 transition-colors">Arpa</a>
                <a href="/fiyatlar/misir" className="text-sm hover:text-emerald-200 transition-colors">Mısır</a>
                <a href="/raporlar" className="text-sm hover:text-emerald-200 transition-colors">Raporlar</a>
              </nav>
            </div>
          </div>
        </header>
        <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
          {children}
        </main>
        <footer className="bg-emerald-900 text-emerald-200 py-6 mt-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
              <div>
                <p className="text-sm font-semibold">Hububat Fiyat Pano</p>
                <p className="text-xs text-emerald-400">Türkiye Hububat ve Baklagil Fiyatları</p>
              </div>
              <div className="text-xs text-emerald-400">
                <p>Veriler TMO ve ticaret borsalarından derlenmektedir.</p>
                <p>2026 Hububat Fiyat Pano. Tüm hakları saklıdır.</p>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
