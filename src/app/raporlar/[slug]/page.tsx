import { supabase } from "@/lib/supabase";
import { Report } from "@/types";
import Link from "next/link";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getReport(slug: string) {
  try {
    const { data, error } = await supabase
      .from("reports")
      .select("*")
      .eq("slug", slug)
      .eq("status", "published")
      .single();

    if (error || !data) return null;
    return data as Report;
  } catch {
    return null;
  }
}

function getMockReport(slug: string) {
  const reports: Record<string, Report> = {
    "tmo-2026-hububat-alim-fiyatlari": {
      id: "1",
      title: "TMO 2026 Dönemi Hububat Alım Fiyatları",
      slug: "tmo-2026-hububat-alim-fiyatlari",
      content: `Toprak Mahsulleri Ofisi (TMO) 2026 dönemi hububat alım ve satış fiyatlarını açıkladı.

## 2026 Dönemi Alım Fiyatları

- **Ekmeklik Buğday**: 15.640 TL/ton
- **Arpa**: 13.371 TL/ton  
- **Mısır**: 14.312 TL/ton
- **Yulaf**: 14.200 TL/ton
- **Soya**: 13.500 TL/ton

## Piyasa Değerlendirmesi

2026 yılında hububat piyasalarında genel olarak yukarı yönlü bir seyir görülmektedir. Özellikle buğday fiyatları geçen yıla göre %20-25 artış göstermiştir. Bu artışta küresel tedarik zinciri sorunları ve iklim değişikliğinin etkisi büyüktür.

## Bölgesel Analiz

- **İç Anadolu**: Konya ve Eskişehir piyasalarında buğday fiyatları ulusal ortalamanın üzerinde seyretmektedir.
- **Marmara**: Edirne piyasası İç Anadolu'ya göre daha düşük fiyatlar sunmaktadır.
- **Akdeniz**: Adana piyasası mısır fiyatlarında önemli bir referans noktasıdır.

## Öngörüler

Önümüzdeki dönemde hububat fiyatlarının mevcut seviyelerinde stabil kalması beklenmektedir.`,
      author: "Admin",
      date: new Date().toISOString().split("T")[0],
      status: "published",
      created_at: new Date().toISOString().split("T")[0],
    },
  };
  return reports[slug] || null;
}

export default async function ReportPage({ params }: PageProps) {
  const { slug } = await params;
  const report = await getReport(slug) || getMockReport(slug);
  
  if (!report) {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-2 text-sm text-zinc-500">
        <Link href="/" className="hover:text-emerald-700">Ana Sayfa</Link>
        <span>/</span>
        <Link href="/raporlar" className="hover:text-emerald-700">Raporlar</Link>
        <span>/</span>
        <span className="text-zinc-900 font-medium">{report.title}</span>
      </div>

      <article className="bg-white rounded-xl border border-zinc-200 p-8">
        <h1 className="text-3xl font-bold text-zinc-900 mb-4">{report.title}</h1>
        <div className="flex items-center gap-4 text-sm text-zinc-500 mb-8 pb-4 border-b border-zinc-200">
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
            {new Date(report.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}
          </span>
        </div>
        <div className="prose prose-zinc max-w-none">
          {report.content.split('\n').map((paragraph, i) => {
            if (paragraph.startsWith('## ')) {
              return <h2 key={i} className="text-xl font-bold text-zinc-900 mt-6 mb-3">{paragraph.replace('## ', '')}</h2>;
            }
            if (paragraph.startsWith('- ')) {
              return <li key={i} className="ml-4 text-zinc-700">{paragraph.replace('- ', '')}</li>;
            }
            if (paragraph.trim() === '') {
              return <br key={i} />;
            }
            return <p key={i} className="text-zinc-700 leading-relaxed mb-4">{paragraph}</p>;
          })}
        </div>
      </article>
    </div>
  );
}
