"""Collection & Normalization Layer for AEO Audit.

Tier 1: Direct HTTP Fetch via httpx
Tier 2: Jina Reader API via httpx
"""
import asyncio
import json
import logging
from typing import Any
from urllib.parse import urlparse, urljoin

import httpx
from bs4 import BeautifulSoup

log = logging.getLogger(__name__)

USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

class ExtractionFailure(Exception):
    """Raised when extraction confidence is too low."""
    pass


class AuditEvidence:
    def __init__(self, source_url: str):
        self.source_url = source_url
        self.raw_html = ""
        self.markdown = ""
        self.schema_payloads: list[dict[str, Any]] = []
        self.semantic_elements = {
            "h1_count": 0,
            "h2_count": 0,
            "has_main": False,
            "has_article": False,
            "has_nav": False,
            "title": "",
        }
        self.robots_txt_content = ""
        self.extraction_confidence = 0
        
        # Rule Engine & AI Scores populated later
        self.accessibility = {}
        self.semantic_structure = {}
        self.schema_analysis = {}
        self.ai_clarity_scores = {}
        self.deterministic_score = 0.0
        self.ai_score = 0.0
        self.final_score = 0.0


async def _fetch_robots_txt(url: str) -> str:
    """Fetch robots.txt for the given URL."""
    try:
        parsed = urlparse(url)
        base_url = f"{parsed.scheme}://{parsed.netloc}"
        robots_url = urljoin(base_url, "/robots.txt")
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            resp = await client.get(robots_url, headers={"User-Agent": USER_AGENT})
            if resp.status_code == 200:
                return resp.text
    except Exception as exc:
        log.warning(f"Failed to fetch robots.txt for {url}: {exc}")
    return ""


async def _fetch_tier1(url: str) -> str:
    """Tier 1: Direct HTTP Fetch."""
    async with httpx.AsyncClient(timeout=15.0, follow_redirects=True) as client:
        resp = await client.get(url, headers={"User-Agent": USER_AGENT})
        resp.raise_for_status()
        return resp.text


async def _fetch_tier2(url: str) -> str:
    """Tier 2: Jina Reader API."""
    # Request markdown/html using Jina Reader.
    # To get raw HTML from Jina, we can just fetch it with Accept header, but
    # Jina Reader is optimized for Markdown. Since we need semantic HTML tags (H1, Article)
    # Jina returns Markdown which strips those tags. 
    # Actually, Jina doesn't return raw HTML by default. We can use r.jina.ai to return JSON 
    # which contains `data.html`.
    jina_url = f"https://r.jina.ai/{url}"
    headers = {
        "Accept": "application/json",
        "X-Return-Format": "html"
    }
    async with httpx.AsyncClient(timeout=25.0, follow_redirects=True) as client:
        resp = await client.get(jina_url, headers=headers)
        resp.raise_for_status()
        data = resp.json()
        if "data" in data and "html" in data["data"]:
            return data["data"]["html"]
        # Fallback to markdown if html is missing for some reason
        if "data" in data and "content" in data["data"]:
            return data["data"]["content"]
        return resp.text


async def collect_evidence(url: str) -> AuditEvidence:
    """Fetch URL, normalize HTML, and calculate extraction confidence."""
    evidence = AuditEvidence(source_url=url)
    
    # 1. Fetch robots.txt in parallel (best effort)
    robots_task = asyncio.create_task(_fetch_robots_txt(url))
    
    # 2. Fetch main URL HTML
    raw_html = ""
    try:
        log.info(f"Attempting Tier 1 fetch for {url}")
        raw_html = await _fetch_tier1(url)
    except Exception as e1:
        log.warning(f"Tier 1 fetch failed for {url}: {e1}. Falling back to Tier 2 (Jina).")
        try:
            raw_html = await _fetch_tier2(url)
        except Exception as e2:
            log.error(f"Tier 2 fetch failed for {url}: {e2}.")
            raise ExtractionFailure("Target URL is unreachable or blocking our scrapers.")
            
    if not raw_html or not raw_html.strip():
        raise ExtractionFailure("Target URL returned empty content.")
        
    evidence.raw_html = raw_html
    evidence.robots_txt_content = await robots_task
    
    # 3. Parse HTML
    soup = BeautifulSoup(raw_html, "html.parser")
    
    # Extract Title
    title_tag = soup.find("title")
    if title_tag:
        evidence.semantic_elements["title"] = title_tag.get_text(strip=True)
        
    # Extract Semantic elements
    evidence.semantic_elements["h1_count"] = len(soup.find_all("h1"))
    evidence.semantic_elements["h2_count"] = len(soup.find_all("h2"))
    evidence.semantic_elements["has_main"] = bool(soup.find("main"))
    evidence.semantic_elements["has_article"] = bool(soup.find("article"))
    evidence.semantic_elements["has_nav"] = bool(soup.find("nav"))
    
    # Extract JSON-LD Schemas
    schemas = []
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string)
            if isinstance(data, list):
                schemas.extend(data)
            else:
                schemas.append(data)
        except Exception:
            pass
    evidence.schema_payloads = schemas
    
    # Extract text content (Markdown equivalent)
    # Remove scripts, styles
    for element in soup(["script", "style", "noscript", "svg"]):
        element.extract()
    text = soup.get_text(separator=" ", strip=True)
    evidence.markdown = text
    
    # 4. Extraction Confidence Scoring
    confidence = 0
    content_len = len(evidence.markdown)
    
    if content_len > 1000:
        confidence += 50
    elif content_len > 300:
        confidence += 20
        
    if evidence.semantic_elements["title"]:
        confidence += 20
        
    if evidence.schema_payloads:
        confidence += 20
    
    if evidence.semantic_elements["h1_count"] > 0 or evidence.semantic_elements["h2_count"] > 0:
        confidence += 10
        
    evidence.extraction_confidence = min(100, confidence)
    
    if evidence.extraction_confidence < 40:
        raise ExtractionFailure(
            f"Extraction confidence too low ({evidence.extraction_confidence}%). "
            f"Content length: {content_len}, Schemas found: {len(evidence.schema_payloads)}"
        )
        
    return evidence
