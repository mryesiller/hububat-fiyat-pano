export type Product = {
  id: string;
  name: string;
  category: string;
  unit: string;
  slug: string;
  created_at: string;
};

export type Market = {
  id: string;
  name: string;
  city: string;
  region: string;
  slug: string;
  type: string;
  source: string;
  created_at: string;
};

export type PriceEntry = {
  id: string;
  product_id: string;
  market_id: string;
  date: string;
  quantity: number | null;
  price_tl: number | null;
  price_min: number | null;
  price_max: number | null;
  price_avg: number | null;
  unit: string;
  source: string;
  created_at: string;
  product?: Product;
  market?: Market;
};

export type Report = {
  id: string;
  title: string;
  slug: string;
  content: string;
  author: string;
  date: string;
  status: string;
  created_at: string;
};

export type Region = {
  name: string;
  slug: string;
  cities: string[];
};
