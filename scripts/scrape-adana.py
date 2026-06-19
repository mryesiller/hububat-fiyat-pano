#!/usr/bin/env python3
"""
Adana Ticaret Borsası API Scraper

Bu script, Adana TB'nin bülten API'sinden hububat verilerini çeker
ve Supabase'e yazar.

API Endpoint: https://adanatb.org.tr/bulten/api.php?start=YYYY-MM-DD&end=YYYY-MM-DD

Kullanım:
    python scrape-adana.py
    # veya cron ile günde 1 kez çalıştırın

Gereksinimler:
    pip install requests supabase
"""

import os
import sys
import json
import requests
from datetime import datetime, timedelta

try:
    from supabase import create_client
    HAS_SUPABASE = True
except ImportError:
    HAS_SUPABASE = False
    print("Warning: Supabase client not available. Install with: pip install supabase")

# Configuration
ADANA_API_URL = "https://adanatb.org.tr/bulten/api.php"

# Supabase config
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# Hububat products from Adana API
HUBUBAT_PRODUCTS = {
    "Arpa": "arpa",
    "Mısır": "misir",
    "Mısır (Kırık)": "misir",
    "Buğday": "bugday",
    "Yulaf": "yulaf",
    "Soya": "soya",
}

# Adana API market mapping
ADANA_MARKET = "adana"


def fetch_adana_data(date_str):
    """Fetch data from Adana TB API for a specific date with retries"""
    params = {
        "start": date_str,
        "end": date_str,
    }
    
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json",
    }
    
    for attempt in range(3):
        try:
            response = requests.get(ADANA_API_URL, params=params, headers=headers, timeout=60)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error fetching Adana data for {date_str} (attempt {attempt + 1}/3): {e}")
            if attempt < 2:
                import time
                time.sleep(10)
    
    return []


def parse_adana_prices(data, date_str):
    """Parse Adana API response to extract hububat prices"""
    prices = []
    
    for entry in data:
        # Skip export entries
        satis_sekli = entry.get("satissekliaciklama", "").strip()
        if satis_sekli == "İhracat":
            continue
        
        mal_adi = entry.get("maladi", "")
        urun_grubu = entry.get("urungrubu", "")
        
        # Only process hububat products
        if urun_grubu not in ["HUBUBAT", "HUBUBAT MAMÜLLERİ"]:
            continue
        
        product_slug = HUBUBAT_PRODUCTS.get(mal_adi)
        if not product_slug:
            continue
        
        # Parse price - Adana API uses Kg, convert to TL/ton
        fiyat = entry.get("fiyat", 0)
        fiyat2 = entry.get("fiyat2", 0)
        miktar = entry.get("miktar", 0)
        
        # Convert from Kg price to TL/ton (multiply by 1000)
        price_tl = None
        if fiyat and fiyat > 0:
            price_tl = fiyat * 1000
        elif fiyat2 and fiyat2 > 0:
            price_tl = fiyat2 * 1000
        
        if not price_tl:
            continue
        
        # Convert quantity from Kg to ton
        quantity_ton = miktar / 1000 if miktar else None
        
        prices.append({
            "product_slug": product_slug,
            "market_slug": "adana",
            "quantity": quantity_ton,
            "price_tl": price_tl,
            "price_min": fiyat * 1000 if fiyat and fiyat > 0 else None,
            "price_max": fiyat2 * 1000 if fiyat2 and fiyat2 > 0 else None,
            "unit": "TL/ton",
            "source": "adana_api",
            "date": date_str,
        })
    
    return prices


def save_to_supabase(prices):
    """Save parsed prices to Supabase"""
    if not HAS_SUPABASE or not SUPABASE_URL or not SUPABASE_KEY:
        print("Supabase not configured, printing prices instead:")
        print(json.dumps(prices, indent=2, ensure_ascii=False))
        return False
    
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        
        # Get product and market IDs
        products_result = supabase.from_("products").select("id, slug").execute()
        markets_result = supabase.from_("markets").select("id, slug").execute()
        
        product_map = {p["slug"]: p["id"] for p in products_result.data}
        market_map = {m["slug"]: m["id"] for m in markets_result.data}
        
        # Insert prices
        entries = []
        for price in prices:
            product_id = product_map.get(price["product_slug"])
            market_id = market_map.get(price["market_slug"])
            
            if not product_id or not market_id:
                continue
            
            entries.append({
                "product_id": product_id,
                "market_id": market_id,
                "date": price["date"],
                "price_tl": price["price_tl"],
                "price_min": price.get("price_min"),
                "price_max": price.get("price_max"),
                "quantity": price.get("quantity"),
                "unit": price["unit"],
                "source": price["source"],
            })
        
        if entries:
            result = supabase.from_("price_entries").upsert(
                entries,
                on_conflict="product_id,market_id,date,source"
            ).execute()
            
            print(f"Saved {len(entries)} price entries to Supabase")
            return True
        else:
            print("No valid entries to save")
            return False
            
    except Exception as e:
        print(f"Error saving to Supabase: {e}")
        return False


def main():
    """Main function"""
    print("Adana TB API Scraper starting...")
    
    # Get yesterday's date (Adana API may not have today's data yet)
    yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")
    print(f"Fetching data for: {yesterday}")
    
    # Fetch data
    data = fetch_adana_data(yesterday)
    
    if not data:
        print("No data received from API after retries")
        return
    
    print(f"Received {len(data)} total entries from API")
    
    # Parse prices
    prices = parse_adana_prices(data, yesterday)
    print(f"Parsed {len(prices)} hububat price entries")
    
    # Save to Supabase
    if prices:
        save_to_supabase(prices)
    else:
        print("No hububat prices found")
    
    print("Adana TB API Scraper completed")


if __name__ == "__main__":
    main()
