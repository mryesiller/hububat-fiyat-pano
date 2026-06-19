-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  category VARCHAR(50) NOT NULL DEFAULT 'hububat',
  unit VARCHAR(20) NOT NULL DEFAULT 'TL/ton',
  slug VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Markets table
CREATE TABLE IF NOT EXISTS markets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  city VARCHAR(100) NOT NULL,
  region VARCHAR(50) NOT NULL,
  slug VARCHAR(100) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL DEFAULT 'domestic', -- domestic, international
  source VARCHAR(50) NOT NULL DEFAULT 'manual', -- tmo_pdf, adana_api, manual
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Price entries table
CREATE TABLE IF NOT EXISTS price_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  market_id UUID NOT NULL REFERENCES markets(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  quantity NUMERIC(15, 2),
  price_tl NUMERIC(15, 2),
  price_min NUMERIC(15, 2),
  price_max NUMERIC(15, 2),
  price_avg NUMERIC(15, 2),
  unit VARCHAR(20) NOT NULL DEFAULT 'TL/ton',
  source VARCHAR(50) NOT NULL DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id, market_id, date, source)
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL UNIQUE,
  content TEXT NOT NULL,
  author VARCHAR(100) NOT NULL DEFAULT 'Admin',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status VARCHAR(20) NOT NULL DEFAULT 'published',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_price_entries_product_id ON price_entries(product_id);
CREATE INDEX IF NOT EXISTS idx_price_entries_market_id ON price_entries(market_id);
CREATE INDEX IF NOT EXISTS idx_price_entries_date ON price_entries(date);
CREATE INDEX IF NOT EXISTS idx_price_entries_source ON price_entries(source);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_markets_slug ON markets(slug);
CREATE INDEX IF NOT EXISTS idx_markets_region ON markets(region);
CREATE INDEX IF NOT EXISTS idx_reports_slug ON reports(slug);
CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status);

-- Seed data: Products
INSERT INTO products (name, category, unit, slug) VALUES
  ('Buğday', 'hububat', 'TL/ton', 'bugday'),
  ('Arpa', 'hububat', 'TL/ton', 'arpa'),
  ('Mısır', 'hububat', 'TL/ton', 'misir'),
  ('Yulaf', 'hububat', 'TL/ton', 'yulaf'),
  ('Soya', 'hububat', 'TL/ton', 'soya'),
  ('Ayçiçeği', 'hububat', 'TL/ton', 'aycicegi'),
  ('Pirinç', 'hububat', 'TL/ton', 'pirinc'),
  ('Mercimek', 'baklagil', 'TL/ton', 'mercimek'),
  ('Fasulye', 'baklagil', 'TL/ton', 'fasulye'),
  ('Nohut', 'baklagil', 'TL/ton', 'nohut')
ON CONFLICT (slug) DO NOTHING;

-- Seed data: Markets (Türkiye - 7 bölge × 3 il)
INSERT INTO markets (name, city, region, slug, type, source) VALUES
  -- Marmara
  ('Tekirdağ', 'Tekirdağ', 'marmara', 'tekirdag', 'domestic', 'manual'),
  ('Edirne', 'Edirne', 'marmara', 'edirne', 'domestic', 'tmo_pdf'),
  ('Kırklareli', 'Kırklareli', 'marmara', 'kirklareli', 'domestic', 'manual'),
  -- Ege
  ('İzmir', 'İzmir', 'ege', 'izmir', 'domestic', 'manual'),
  ('Manisa', 'Manisa', 'ege', 'manisa', 'domestic', 'manual'),
  ('Aydın', 'Aydın', 'ege', 'aydin', 'domestic', 'manual'),
  -- Akdeniz
  ('Adana', 'Adana', 'akdeniz', 'adana', 'domestic', 'adana_api'),
  ('Mersin', 'Mersin', 'akdeniz', 'mersin', 'domestic', 'manual'),
  ('Antalya', 'Antalya', 'akdeniz', 'antalya', 'domestic', 'manual'),
  -- İç Anadolu
  ('Konya', 'Konya', 'ic-anadolu', 'konya', 'domestic', 'tmo_pdf'),
  ('Eskişehir', 'Eskişehir', 'ic-anadolu', 'eskisehir', 'domestic', 'tmo_pdf'),
  ('Ankara', 'Ankara', 'ic-anadolu', 'ankara', 'domestic', 'manual'),
  -- Karadeniz
  ('Samsun', 'Samsun', 'karadeniz', 'samsun', 'domestic', 'manual'),
  ('Çorum', 'Çorum', 'karadeniz', 'corum', 'domestic', 'tmo_pdf'),
  ('Tokat', 'Tokat', 'karadeniz', 'tokat', 'domestic', 'manual'),
  -- Doğu Anadolu
  ('Diyarbakır', 'Diyarbakır', 'dogu-anadolu', 'diyarbakir', 'domestic', 'manual'),
  ('Elazığ', 'Elazığ', 'dogu-anadolu', 'elazig', 'domestic', 'manual'),
  ('Malatya', 'Malatya', 'dogu-anadolu', 'malatya', 'domestic', 'manual'),
  -- Güneydoğu Anadolu
  ('Şanlıurfa', 'Şanlıurfa', 'guneydogu-anadolu', 'sanliurfa', 'domestic', 'manual'),
  ('Gaziantep', 'Gaziantep', 'guneydogu-anadolu', 'gaziantep', 'domestic', 'tmo_pdf'),
  ('Mardin', 'Mardin', 'guneydogu-anadolu', 'mardin', 'domestic', 'manual'),
  -- Uluslararası referanslar
  ('ABD (Körfez)', 'ABD', 'uluslararasi', 'abd-korfez', 'international', 'tmo_pdf'),
  ('Kanada', 'Kanada', 'uluslararasi', 'kanada', 'international', 'tmo_pdf'),
  ('Rusya (Karadeniz)', 'Rusya', 'uluslararasi', 'rusya-karadeniz', 'international', 'tmo_pdf'),
  ('Ukrayna', 'Ukrayna', 'uluslararasi', 'ukrayna', 'international', 'tmo_pdf'),
  ('Arjantin', 'Arjantin', 'uluslararasi', 'arjantin', 'international', 'tmo_pdf'),
  ('Brezilya', 'Brezilya', 'uluslararasi', 'brezilya', 'international', 'tmo_pdf'),
  ('Almanya', 'Almanya', 'uluslararasi', 'almanya', 'international', 'tmo_pdf'),
  ('Fransa', 'Fransa', 'uluslararasi', 'fransa', 'international', 'tmo_pdf')
ON CONFLICT (slug) DO NOTHING;

-- Enable Row Level Security (optional, for admin panel)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access on products" ON products FOR SELECT USING (true);
CREATE POLICY "Allow public read access on markets" ON markets FOR SELECT USING (true);
CREATE POLICY "Allow public read access on price_entries" ON price_entries FOR SELECT USING (true);
CREATE POLICY "Allow public read access on reports" ON reports FOR SELECT USING (status = 'published');
