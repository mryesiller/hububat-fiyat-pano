#!/usr/bin/env python3
"""
TMO (Toprak Mahsulleri Ofisi) PDF Parser

Bu script, TMO'nun günlük piyasa bülteni PDF'sini indirir,
hububat fiyatlarını çıkarır ve Supabase'e yazar.

Kullanım:
    python scrape-tmo.py
    # veya cron ile günde 1 kez çalıştırın

Gereksinimler:
    pip install requests PyMuPDF supabase
"""

import os
import sys
import re
import json
import requests
from datetime import datetime
from pathlib import Path

# Try to import PyMuPDF, fallback to basic text extraction
try:
    import fitz  # PyMuPDF
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False
    print("Warning: PyMuPDF not available. Install with: pip install PyMuPDF")

try:
    from supabase import create_client
    HAS_SUPABASE = True
except ImportError:
    HAS_SUPABASE = False
    print("Warning: Supabase client not available. Install with: pip install supabase")

# Configuration
TMO_PDF_URL = "https://www.tmo.gov.tr/Upload/Document/piyasabulteni/piyasabulteni_tr.pdf"
PDF_PATH = "/tmp/tmo_bulletin.pdf"

# Supabase config (from environment variables)
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# Hububat products we track
HUBUBAT_PRODUCTS = {
    "buğday": "bugday",
    "arpa": "arpa",
    "mısır": "misir",
    "yulaf": "yulaf",
    "soya": "soya",
    "ayçiçeği": "aycicegi",
    "pirinç": "pirinc",
    "mercimek": "mercimek",
    "fasulye": "fasulye",
    "nohut": "nohut",
}

# TMO market names to our slug mapping
TMO_MARKETS = {
    "konya": "konya",
    "edirne": "edirne",
    "eskisehir": "eskisehir",
    "adana": "adana",
    "gaziantep": "gaziantep",
    "corum": "corum",
    "polatlı": "polatli",
    "çorum": "corum",
    "ankara": "ankara",
    "tekirdağ": "tekirdag",
    "izmir": "izmir",
    "manisa": "manisa",
    "aydın": "aydin",
    "mersin": "mersin",
    "antalya": "antalya",
    "samsun": "samsun",
    "tokat": "tokat",
    "diyarbakır": "diyarbakir",
    "elazığ": "elazig",
    "malatya": "malatya",
    "şanlıurfa": "sanliurfa",
    "mardin": "mardin",
    # International
    "abd hrw": "abd-korfez",
    "abd": "abd-korfez",
    "kanada": "kanada",
    "rusya": "rusya-karadeniz",
    "ukrayna": "ukrayna",
    "arjantin": "arjantin",
    "brezilya": "brezilya",
    "almanya": "almanya",
    "fransa": "fransa",
}


def download_pdf():
    """Download TMO daily bulletin PDF"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        response = requests.get(TMO_PDF_URL, headers=headers, timeout=30)
        response.raise_for_status()
        
        with open(PDF_PATH, "wb") as f:
            f.write(response.content)
        
        print(f"PDF downloaded: {len(response.content)} bytes")
        return True
    except Exception as e:
        print(f"Error downloading PDF: {e}")
        return False


def extract_text_from_pdf():
    """Extract text from PDF using PyMuPDF"""
    if not HAS_PYMUPDF:
        print("PyMuPDF not available, cannot extract text")
        return ""
    
    try:
        doc = fitz.open(PDF_PATH)
        text = ""
        for page in doc:
            text += page.get_text()
        doc.close()
        return text
    except Exception as e:
        print(f"Error extracting PDF text: {e}")
        return ""


def parse_tmo_prices(text):
    """
    Parse TMO PDF text to extract hububat prices.
    
    TMO PDF format (from our analysis):
    - Product names: "EKMEKLİK BUĞDAY", "ARPA", "MISIR", "YULAF", "SOYA", etc.
    - Market names followed by numbers: "Konya  273  15.779  342"
    - Format: Market, Quantity, TL/ton, $/ton
    """
    prices = []
    lines = text.split('\n')
    
    current_product = None
    current_product_slug = None
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Detect product names
        line_lower = line.lower()
        for product_name, slug in HUBUBAT_PRODUCTS.items():
            if product_name in line_lower and len(line) < 50:
                current_product = product_name
                current_product_slug = slug
                break
        
        if not current_product:
            continue
        
        # Try to parse market lines
        # Pattern: MarketName [quantity] [price_tl] [price_usd]
        for market_name, market_slug in TMO_MARKETS.items():
            if market_name.lower() in line_lower:
                # Extract numbers from line
                numbers = re.findall(r'\d{1,3}(?:\.\d{3})*(?:,\d+)?', line)
                numbers = [n.replace('.', '').replace(',', '.') for n in numbers]
                
                if len(numbers) >= 2:
                    try:
                        quantity = float(numbers[0]) if float(numbers[0]) > 0 else None
                        price_tl = float(numbers[1])
                        
                        prices.append({
                            "product_slug": current_product_slug,
                            "market_slug": market_slug,
                            "quantity": quantity,
                            "price_tl": price_tl,
                            "unit": "TL/ton",
                            "source": "tmo_pdf",
                            "date": datetime.now().strftime("%Y-%m-%d"),
                        })
                    except (ValueError, IndexError):
                        pass
    
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
                "quantity": price["quantity"],
                "unit": price["unit"],
                "source": price["source"],
            })
        
        if entries:
            # Use upsert to avoid duplicates
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
    print("TMO PDF Parser starting...")
    print(f"Date: {datetime.now().strftime('%Y-%m-%d')}")
    
    # Download PDF
    if not download_pdf():
        print("Failed to download PDF, exiting")
        sys.exit(1)
    
    # Extract text
    text = extract_text_from_pdf()
    if not text:
        print("Failed to extract text from PDF, exiting")
        sys.exit(1)
    
    # Parse prices
    prices = parse_tmo_prices(text)
    print(f"Parsed {len(prices)} price entries")
    
    # Save to Supabase
    if prices:
        save_to_supabase(prices)
    else:
        print("No prices found in PDF")
    
    # Clean up
    if os.path.exists(PDF_PATH):
        os.remove(PDF_PATH)
    
    print("TMO PDF Parser completed")


if __name__ == "__main__":
    main()
