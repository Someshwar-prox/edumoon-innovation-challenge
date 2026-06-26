import sys
import os
from pathlib import Path

sys.path.insert(0, os.path.abspath("."))

from app.modules.analyze_website.crawler import Crawler

def main():
    print("Testing HTTPX Crawler on SPA...")
    cache_dir = Path("/tmp/crawler_test")
    crawler = Crawler(user_agent="", timeout=10, max_pages=1, cache_dir=cache_dir)
    with crawler:
        pages, warnings = crawler.fetch_all("https://aeoaudit.site/")
        print(f"Found {len(pages)} pages. Warnings: {len(warnings)}")
        if warnings:
            print("Warnings:", warnings)
        for p in pages:
            print(f"URL: {p.url}")
            print(f"Title: {p.title}")
            print(f"Content Length: {len(p.cleaned_text)}")
            print(f"Content: {p.cleaned_text[:500]}")

if __name__ == "__main__":
    main()
