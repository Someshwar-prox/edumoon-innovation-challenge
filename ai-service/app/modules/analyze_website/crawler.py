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
        self._client = httpx.Client(
            follow_redirects=True,
            timeout=self._timeout,
            headers={"User-Agent": self._ua, "Accept-Language": "en-US,en;q=0.8"},
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
            favour_precision=True,
        ) or ""

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
