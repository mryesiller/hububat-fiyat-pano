import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Create a dummy client for build-time when env vars are not set
function createDummyClient() {
  return {
    from: () => ({
      select: () => ({ data: null, error: null }),
      insert: () => ({ data: null, error: null }),
      upsert: () => ({ data: null, error: null }),
      eq: () => ({ single: () => ({ data: null, error: null }) }),
      order: () => ({ limit: () => ({ data: null, error: null }) }),
      execute: () => ({ data: null, error: null }),
    }),
  } as any;
}

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : createDummyClient();

export type Database = {
  public: {
    Tables: {
      products: {
        Row: {
          id: string;
          name: string;
          category: string;
          unit: string;
          slug: string;
          created_at: string;
        };
      };
      markets: {
        Row: {
          id: string;
          name: string;
          city: string;
          region: string;
          slug: string;
          type: string;
          source: string;
          created_at: string;
        };
      };
      price_entries: {
        Row: {
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
        };
      };
      reports: {
        Row: {
          id: string;
          title: string;
          slug: string;
          content: string;
          author: string;
          date: string;
          status: string;
          created_at: string;
        };
      };
    };
  };
};
