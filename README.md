# Hububat Fiyat Pano

Türkiye'nin 7 bölgesinden ve uluslararası piyasalardan günlük, haftalık ve aylık hububat ve baklagil fiyatlarını takip eden şeffaf fiyat platformu.

## Özellikler

- **7 Bölge, 21+ İl**: Marmara, Ege, Akdeniz, İç Anadolu, Karadeniz, Doğu Anadolu, Güneydoğu Anadolu
- **10 Ürün**: Buğday, Arpa, Mısır, Yulaf, Soya, Ayçiçeği, Pirinç, Mercimek, Fasulye, Nohut
- **Veri Kaynakları**: TMO (otomatik PDF), Adana TB (otomatik API), Diğer borsalar (manuel)
- **Şeffaflık**: Her fiyatın kaynağı (TMO, Borsa, Manuel) etiketli
- **SEO**: Her ürün ve il için ayrı sayfalar
- **Raporlar**: Piyasa analizleri ve yorumlar
- **Admin Paneli**: Manuel fiyat girişi ve otomasyon yönetimi

## Tech Stack

- **Frontend**: Next.js 16 + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth)
- **Grafik**: Recharts (ileride eklenecek)
- **Deployment**: Vercel
- **Scraping**: Python + PyMuPDF + Requests

## Kurulum

### 1. Supabase Projesi Oluşturun

1. [supabase.com](https://supabase.com)'da ücretsiz hesap oluşturun
2. Yeni proje oluşturun
3. SQL Editor'a gidin
4. `supabase/schema.sql` dosyasını kopyalayıp çalıştırın

### 2. Environment Variables

`.env.local` dosyası oluşturun:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
```

### 3. Projeyi Çalıştırın

```bash
npm install
npm run dev
```

## Deployment (Vercel)

```bash
npm install -g vercel
vercel
```

Vercel dashboard'unda Environment Variables'ları eklemeyi unutmayın.

## Otomasyon (Cron Jobs)

### TMO PDF Parser
```bash
# Her gün saat 09:00'da çalıştır
0 9 * * * cd /path/to/project && python3 scripts/scrape-tmo.py
```

### Adana TB API Scraper
```bash
# Her gün saat 09:30'da çalıştır
30 9 * * * cd /path/to/project && python3 scripts/scrape-adana.py
```

Vercel'de serverless function olarak da çalıştırabilirsiniz.

## Veri Modeli

### Products
- id, name, category, unit, slug

### Markets
- id, name, city, region, slug, type, source

### Price Entries
- id, product_id, market_id, date, quantity, price_tl, price_min, price_max, price_avg, unit, source

### Reports
- id, title, slug, content, author, date, status

## Klasör Yapısı

```
hububat-fiyat-pano/
├── src/
│   ├── app/              # Next.js App Router
│   ├── lib/              # Supabase client, utilities
│   ├── types/            # TypeScript types
│   └── components/       # React components
├── scripts/              # Python scrapers
├── supabase/             # SQL schema
└── .env.example          # Environment variables
```

## Geliştirilecek Özellikler

- [ ] Grafikler (Recharts ile tarihsel fiyat grafikleri)
- [ ] Haftalık/aylık ortalama fiyatlar
- [ ] Fiyat değişim bildirimleri
- [ ] Çiftçi kayıt ve bildirim sistemi
- [ ] Daha fazla borsa otomasyonu
- [ ] Mobil uygulama

## Lisans

2026 Hububat Fiyat Pano. Tüm hakları saklıdır.
