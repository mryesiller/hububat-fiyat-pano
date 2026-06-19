import { supabase } from "@/lib/supabase";
import { Report } from "@/types";
import Link from "next/link";

async function getReports() {
  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("status", "published")
      .order("date", { ascending: false });

    if (error || !data || data.length === 0) {
      return getMockReports();
    }
    return data as Report[];
  } catch {
    return getMockReports();
  }
}

function getMockReports() {
  const today = new Date().toISOString().split("T")[0];
  return [
    {
      id: "1",
      title: "TMO 2026 Dönemi Hububat Alım Fiyatları",
      slug: "tmo-2026-hububat-alim-fiyatlari",
      content: "Toprak Mahsulleri Ofisi (TMO) 2026 dönemi hububat alım ve satış fiyatlarını açıkladı. Ekmeklik buğday 15.640 TL/ton, arpa 13.371 TL/ton, mısır 14.312 TL/ton olarak belirlendi...",
      author: "Admin",
      date: today,
      status: "published",
      created_at: today,
    },
    {
      id: "2",
      title: "Türkiye Hububat Piyasası Analizi - Haziran 2026",
      slug: "turkiye-hububat-piyasasi-analizi-haziran-2026",
      content: "Haziran ayında hububat piyasalarında yaşanan gelişmeler, fiyat trendleri ve öngörüler...",
      author: "Admin",
      date: today,
      status: "published",
      created_at: today,
    },
    {
      id: "3",
      title: "Uluslararası Buğday Piyasası ve Türkiye'ye Etkisi",
      slug: "uluslararasi-bugday-piyasasi-turkiye",
      content: "ABD, Kanada ve Avrupa buğday piyasalarındaki gelişmelerin Türkiye'ye etkisi...",
      author: "Admin",
      date: today,
      status: "published",
      created_at: today,
    },
  ];
}

export default async function ReportsPage() {
  const reports = await getReports();

  return (
    <div className="space-y-8">
      <div className="bg-emerald-800 rounded-2xl p-8 text-white">
        <h1 className="text-3xl font-bold mb-2">Piyasa Raporları</h1>
        <p className="text-emerald-200">
          Hububat ve baklagil piyasalarına dair analiz ve değerlendirmeler.
        </p>
      </div>

      <div className="grid gap-6">
        {reports.map((report) => (
          <Link
            key={report.id}
            href={`/raporlar/${report.slug}`}
            className="bg-white rounded-xl border border-zinc-200 p-6 hover:border-emerald-300 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-zinc-900 mb-2">{report.title}</h3>
                <p className="text-zinc-600 text-sm line-clamp-2">{report.content}</p>
                <div className="flex items-center gap-4 mt-4 text-sm text-zinc-500">
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    {report.author}
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {new Date(report.date).toLocaleDateString("tr-TR")}
                  </span>
                </div>
              </div>
              <svg className="w-5 h-5 text-zinc-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
