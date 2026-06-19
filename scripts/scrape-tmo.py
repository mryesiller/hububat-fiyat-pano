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
import urllib3
from datetime import datetime
from pathlib import Path

# Suppress SSL verification warnings
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

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
    "ekmeklik buğday": "bugday",
    "buğday": "bugday",
    "arpa": "arpa",
    "mısır": "misir",
    "yulaf": "yulaf",
    "soya": "soya",
    "soya fasulyesi": "soya",
    "ayçiçeği": "aycicegi",
    "ayçiçeği tohumu": "aycicegi",
    "pirinç": "pirinc",
    "mercimek": "mercimek",
    "fasulye": "fasulye",
    "nohut": "nohut",
}

# Product section headers in TMO PDF
PRODUCT_HEADERS = [
    "ekmeklik buğday", "kırmızı sert buğday", "diğer beyaz buğdaylar",
    "diğer kırmızı buğdaylar", "düşük vasıflı ekmeklik buğday",
    "arpa", "mısır", "yulaf", "soya fasulyesi", "ayçiçeği",
    "kepekler", "bakliyat", "mercimek", "fasulye", "nohut", "pirinç"
]

# TMO market names to our slug mapping
TMO_MARKETS = {
    "konya": "konya",
    "edirne": "edirne",
    "eskisehir": "eskisehir",
    "adana": "adana",
    "gaziantep": "gaziantep",
    "corum": "corum",
    "çorum": "corum",
    "polatlı": "polatli",
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

# Domestic vs international markets
DOMESTIC_MARKETS = [
    "konya", "edirne", "eskisehir", "adana", "gaziantep", "corum", "çorum",
    "polatlı", "ankara", "tekirdağ", "izmir", "manisa", "aydın", "mersin",
    "antalya", "samsun", "tokat", "diyarbakır", "elazığ", "malatya", "şanlıurfa", "mardin"
]


def download_pdf():
    """Download TMO daily bulletin PDF with retries"""
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    for attempt in range(3):
        try:
            response = requests.get(TMO_PDF_URL, headers=headers, timeout=60, verify=False)
            response.raise_for_status()
            
            with open(PDF_PATH, "wb") as f:
                f.write(response.content)
            
            print(f"PDF downloaded: {len(response.content)} bytes")
            return True
        except Exception as e:
            print(f"Error downloading PDF (attempt {attempt + 1}/3): {e}")
            if attempt < 2:
                import time
                time.sleep(10)
    
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
    
    TMO PDF format:
    - Product headers like "EKMEKLİK BUĞDAY", "ARPA", "MISIR"
    - Each product has market entries
    - Each market entry: MarketName on its own line, followed by numeric values
    - Format per market line group:
      MarketName
      qty1 | tl1 | usd1 | qty2 | tl2 | usd2 | last_year | change%
      
    We want the LATEST tl price (tl2 if available, otherwise tl1)
    """
    prices = []
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    
    current_product = None
    current_product_slug = None
    
    i = 0
    while i < len(lines):
        line = lines[i]
        line_lower = line.lower()
        
        # Detect product section headers
        for header in PRODUCT_HEADERS:
            if header in line_lower and len(line) < 60:
                # Map header to product slug
                if "buğday" in line_lower:
                    current_product = "buğday"
                    current_product_slug = "bugday"
                elif "arpa" in line_lower and "kepeği" not in line_lower:
                    current_product = "arpa"
                    current_product_slug = "arpa"
                elif "mısır" in line_lower and "kepeği" not in line_lower and "gluteni" not in line_lower and "özü" not in line_lower:
                    current_product = "mısır"
                    current_product_slug = "misir"
                elif "yulaf" in line_lower:
                    current_product = "yulaf"
                    current_product_slug = "yulaf"
                elif "soya" in line_lower:
                    current_product = "soya"
                    current_product_slug = "soya"
                elif "ayçiçeği" in line_lower and "yağı" not in line_lower:
                    current_product = "ayçiçeği"
                    current_product_slug = "aycicegi"
                elif "pirinç" in line_lower:
                    current_product = "pirinç"
                    current_product_slug = "pirinc"
                elif "mercimek" in line_lower:
                    current_product = "mercimek"
                    current_product_slug = "mercimek"
                elif "fasulye" in line_lower:
                    current_product = "fasulye"
                    current_product_slug = "fasulye"
                elif "nohut" in line_lower:
                    current_product = "nohut"
                    current_product_slug = "nohut"
                break
        
        # Try to parse market lines - only exact matches for domestic markets
        if current_product and line_lower in DOMESTIC_MARKETS:
            market_name = line_lower
            market_slug = TMO_MARKETS.get(market_name)
            
            if market_slug:
                # Collect numbers from next lines (up to 8 values max)
                numbers = []
                j = i + 1
                while j < len(lines) and len(numbers) < 8:
                    next_line = lines[j]
                    next_lower = next_line.lower()
                    
                    # Stop if we hit another domestic market
                    if next_lower in DOMESTIC_MARKETS:
                        break
                    # Stop if we hit a product header
                    if any(h in next_lower for h in PRODUCT_HEADERS):
                        break
                    # Stop if line contains text (not just numbers/dashes)
                    if re.search(r'[a-zA-ZğüşıöçĞÜŞİÖÇ]{3,}', next_line):
                        break
                    
                    # Extract numbers from this line
                    # Handle formats: "15.222", "-", "0", "15,222"
                    if next_line == "-":
                        numbers.append(None)
                    else:
                        found = re.findall(r'\d{1,3}(?:\.\d{3})*(?:,\d+)?', next_line)
                        if found:
                            # Convert Turkish number format: 15.222 -> 15222
                            num_str = found[0].replace('.', '').replace(',', '.')
                            try:
                                numbers.append(float(num_str))
                            except ValueError:
                                numbers.append(None)
                        else:
                            numbers.append(None)
                    
                    j += 1
                
                # Parse numbers based on TMO format
                # Format: qty1, tl1, usd1, qty2, tl2, usd2, last_year, change%
                # We want the latest TL price
                price_tl = None
                quantity = None
                
                if len(numbers) >= 6:
                    # Two columns of data - use the second TL price (most recent)
                    # numbers: [qty1, tl1, usd1, qty2, tl2, usd2, ...]
                    if numbers[4] is not None and numbers[4] > 0:
                        price_tl = numbers[4]
                        quantity = numbers[3] if numbers[3] is not None and numbers[3] > 0 else None
                    elif numbers[1] is not None and numbers[1] > 0:
                        price_tl = numbers[1]
                        quantity = numbers[0] if numbers[0] is not None and numbers[0] > 0 else None
                elif len(numbers) >= 3:
                    # Single column: [qty1, tl1, usd1, ...]
                    if numbers[1] is not None and numbers[1] > 0:
                        price_tl = numbers[1]
                        quantity = numbers[0] if numbers[0] is not None and numbers[0] > 0 else None
                
                # Only add if we have a valid price (> 1000 TL/ton for grains)
                if price_tl is not None and price_tl > 1000:
                    prices.append({
                        "product_slug": current_product_slug,
                        "market_slug": market_slug,
                        "quantity": quantity,
                        "price_tl": price_tl,
                        "unit": "TL/ton",
                        "source": "tmo_pdf",
                        "date": datetime.now().strftime("%Y-%m-%d"),
                    })
                    print(f"  Parsed: {current_product} | {market_name} | {price_tl} TL/ton | qty: {quantity}")
        
        i += 1
    
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
                print(f"  Skipping: product={price['product_slug']}, market={price['market_slug']} (not found in DB)")
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
            # Remove duplicates based on product_id + market_id + date + source
            seen = set()
            unique_entries = []
            for entry in entries:
                key = (entry["product_id"], entry["market_id"], entry["date"], entry["source"])
                if key not in seen:
                    seen.add(key)
                    unique_entries.append(entry)
            
            # Use upsert to avoid duplicates
            result = supabase.from_("price_entries").upsert(
                unique_entries,
                on_conflict="product_id,market_id,date,source"
            ).execute()
            
            print(f"Saved {len(unique_entries)} price entries to Supabase")
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
        print("Failed to download PDF after retries")
        return
    
    # Extract text
    text = extract_text_from_pdf()
    if not text:
        print("Failed to extract text from PDF")
        return
    
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
