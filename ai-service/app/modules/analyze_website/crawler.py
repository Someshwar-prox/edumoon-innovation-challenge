"""Bounded BFS crawler. Same-domain scope, capped at max_pages."""
from __future__ import annotations

import hashlib
import logging
import re
from dataclasses import dataclass
from urllib.parse import urldefrag, urljoin, urlparse

import httpx
import trafilatura
from bs4 import BeautifulSoup

log = logging.getLogger(__name__)


@dataclass
class CrawledPage:
    url: str
    title: str
    cleaned_text: str
    raw_html_path: str | None


class CrawlError(RuntimeError):
    pass


class Crawler:
    def __init__(self, user_agent: str, timeout: int, max_pages: int, cache_dir):
        self._ua = user_agent
        self._timeout = timeout
        self._max_pages = max_pages
        self._cache_dir = cache_dir
        self._client: httpx.Client | None = None

    def __enter__(self) -> "Crawler":
        # Browser-style headers. Many sites (Cloudflare-fronted ones in
        # particular: chatgpt.com, claude.ai, etc.) 403 the default
        # httpx/python-requests UA. We also send Accept-Language because
        # some sites serve a stripped-down page for non-en locales.
        # If the config supplied an explicit UA we honor it (lets ops
        # override in production); otherwise we default to Chrome.
        ua = self._ua or (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0 Safari/537.36"
        )
        self._client = httpx.Client(
            follow_redirects=True,
            timeout=self._timeout,
            headers={
                "User-Agent": ua,
                "Accept": (
                    "text/html,application/xhtml+xml,application/xml;"
                    "q=0.9,image/webp,*/*;q=0.8"
                ),
                "Accept-Language": "en-US,en;q=0.9",
            },
        )
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None

    def fetch_all(self, start_url: str) -> tuple[list[CrawledPage], list[dict]]:
        """Returns (pages, warnings). Pages are de-duplicated and capped."""
        if self._client is None:
            raise RuntimeError("Crawler must be used as a context manager.")

        start = urldefrag(start_url)[0]
        start_netloc = urlparse(start).netloc.lower()
        if start_netloc.startswith("www."):
            start_netloc = start_netloc[4:]

        seen: set[str] = set()
        queue: list[str] = [start]
        pages: list[CrawledPage] = []
        warnings: list[dict] = []

        self._cache_dir.mkdir(parents=True, exist_ok=True)

        while queue and len(pages) < self._max_pages:
            url = queue.pop(0)
            normalised = self._normalise(url)
            if normalised in seen:
                continue
            seen.add(normalised)

            try:
                page = self._fetch_one(normalised)
            except CrawlError as exc:
                warnings.append({"url": normalised, "reason": str(exc)})
                log.warning("page fetch failed", extra={"url": normalised, "reason": str(exc)})
                continue

            if not page.cleaned_text:
                warnings.append({"url": normalised, "reason": "empty_extraction"})
            else:
                pages.append(page)

            try:
                for link in self._discover_links(normalised, page.raw_html_path):
                    nl = self._normalise(link)
                    if nl not in seen and urlparse(nl).netloc.endswith(start_netloc):
                        queue.append(nl)
            except Exception as exc:  # noqa: BLE001
                log.warning("link discovery failed", extra={"url": normalised, "error": str(exc)})

        return pages, warnings

    def _normalise(self, url: str) -> str:
        url, _ = urldefrag(url)
        parsed = urlparse(url)
        return f"{parsed.scheme}://{parsed.netloc.lower()}{parsed.path or '/'}"

    def _fetch_one(self, url: str) -> CrawledPage:
        assert self._client is not None
        try:
            resp = self._client.get(url)
        except httpx.TimeoutException as exc:
            raise CrawlError("timeout") from exc
        except httpx.HTTPError as exc:
            raise CrawlError(f"http_error: {exc.__class__.__name__}") from exc

        if resp.status_code >= 400:
            raise CrawlError(f"http_status_{resp.status_code}")

        ctype = resp.headers.get("content-type", "").lower()
        if "html" not in ctype:
            raise CrawlError(f"non_html_content_type: {ctype}")

        # Bail on bot-detection / challenge pages BEFORE we try to
        # extract text from them. These pages return HTTP 200 with valid
        # HTML but the body is just a JS challenge ("Just a moment...")
        # so Trafilatura returns nothing. We match on:
        #   - <title> contains "Just a moment" (Cloudflare)
        #   - <title> contains "Attention Required" (Cloudflare alt)
        #   - meta generator "Anomaly" (DDG anti-bot)
        #   - body > #challenge-form (Cloudflare Turnstile)
        if "just a moment" in resp.text.lower()[:8000] or \
                "attention required" in resp.text.lower()[:8000] or \
                "challenge-form" in resp.text.lower()[:30000] or \
                "anomaly" in resp.text.lower()[:30000]:
            raise CrawlError("bot_detection_challenge")

        html = resp.text

        cache_key = hashlib.sha1(url.encode("utf-8")).hexdigest()[:16]
        cache_path = self._cache_dir / f"{cache_key}.html"
        try:
            cache_path.write_text(html, encoding="utf-8")
            raw_html_path = str(cache_path)
        except OSError:
            raw_html_path = None

        cleaned = trafilatura.extract(
            html,
            include_comments=False,
            include_tables=False,
            # `favour_precision` is too strict for landing pages — many
            # modern sites embed the main copy in dense HTML where
            # `favour_recall` gets us the content we want. Default is
            # precision; this is a deliberate trade-off for the
            # "I need to know what this site is about" use case.
            favour_recall=True,
        ) or ""

        # If Trafilatura found nothing, try a more aggressive fallback
        # using BeautifulSoup's text extractor. Some sites (chatgpt.com
        # is the canonical example) are mostly client-rendered React
        # and the main heading + meta description is the most we can
        # get without a real browser. Build a minimal but useful text
        # blob so the AI at least has a description of the page.
        if not cleaned.strip():
            soup = BeautifulSoup(html, "lxml")
            chunks: list[str] = []
            title_text = (soup.title.string or "").strip() if soup.title else ""
            if title_text:
                chunks.append(f"Title: {title_text}")
            desc = (
                soup.find("meta", attrs={"name": "description"})
                or soup.find("meta", attrs={"property": "og:description"})
            )
            if desc and desc.get("content"):
                chunks.append(f"Description: {desc.get('content').strip()}")
            # Fall back to the first N chars of visible text.
            body_text = soup.get_text(" ", strip=True)
            if body_text:
                chunks.append(f"Body excerpt: {body_text[:1500]}")
            if chunks:
                cleaned = "\n".join(chunks)

        soup = BeautifulSoup(html, "lxml")
        title = (soup.title.string or "").strip() if soup.title else ""

        return CrawledPage(
            url=url,
            title=title,
            cleaned_text=cleaned.strip(),
            raw_html_path=raw_html_path,
        )

    def _discover_links(self, source_url: str, raw_html_path: str | None) -> list[str]:
        if not raw_html_path:
            return []
        try:
            html = open(raw_html_path, encoding="utf-8", errors="ignore").read()
        except OSError:
            return []
        soup = BeautifulSoup(html, "lxml")
        out: list[str] = []
        for a in soup.find_all("a", href=True):
            href = a["href"]
            abs_url = urljoin(source_url, href)
            parsed = urlparse(abs_url)
            if parsed.scheme not in ("http", "https"):
                continue
            if parsed.netloc.endswith(urlparse(source_url).netloc):
                out.append(abs_url)
        return out
