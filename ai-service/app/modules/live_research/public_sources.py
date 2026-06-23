"""Public-source fetchers for the live research module.

We deliberately use cheap, no-API-key sources so the hackathon demo
runs without external billing. The fetcher layer is pluggable — swap
DuckDuckGo for SerpAPI/Bing later if you need cleaner results.

Each function returns a list of (title, url, snippet) tuples. Failures
are non-fatal: if one source is down, the others still come through.
"""
from __future__ import annotations

import asyncio
import logging
import re
from typing import Protocol
from urllib.parse import quote_plus

import httpx
import trafilatura

log = logging.getLogger(__name__)

UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)
TIMEOUT_S = 10.0

class SearchHit(tuple):
    """(title, url, snippet) tuple with a stable attribute API."""

    @property
    def title(self) -> str:  # type: ignore[override]
        return self[0]

    @property
    def url(self) -> str:  # type: ignore[override]
        return self[1]

    @property
    def snippet(self) -> str:  # type: ignore[override]
        return self[2]


def _hit(title: str, url: str, snippet: str) -> SearchHit:
    return SearchHit((title, url, snippet))  # type: ignore[arg-type]


def _unwrap_ddg_redirect(href: str) -> str:
    """DDG HTML result URLs look like
        //duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F&rut=...
    Pull out the real destination and return it as a fully-qualified
    https URL. Pass anything else through untouched.
    """
    if "uddg=" not in href:
        # Already a real URL (or at least a normal http(s) one)
        if href.startswith("//"):
            return "https:" + href
        return href
    try:
        # uddg value is urlencoded — split on uddg= and take until the next &
        from urllib.parse import unquote
        after = href.split("uddg=", 1)[1]
        uddg = after.split("&", 1)[0]
        real = unquote(uddg)
        if real.startswith("//"):
            real = "https:" + real
        if not real.startswith("http://") and not real.startswith("https://"):
            return href  # give up, return as-is
        return real
    except Exception:  # noqa: BLE001
        return href


class SearchBackend(Protocol):
    name: str

    async def search(self, query: str, limit: int = 5) -> list[SearchHit]: ...


# ---------------------------------------------------------------------------
# Wikipedia REST + Action API — no key, no rate limit for our use, returns
# clean JSON. Primary source for the "general knowledge" half of the
# advisor's live-web augmentation (e.g. "what is artificial intelligence").
# Returns the top search results for the query along with their short
# summaries.
# ---------------------------------------------------------------------------
class WikipediaBackend:
    name = "wikipedia"

    # Action API: https://en.wikipedia.org/w/api.php?action=query&list=search&format=json
    SEARCH_URL = "https://en.wikipedia.org/w/api.php"
    # REST API:  https://en.wikipedia.org/api/rest_v1/page/summary/<title>
    SUMMARY_URL = "https://en.wikipedia.org/api/rest_v1/page/summary"

    async def search(self, query: str, limit: int = 5) -> list[SearchHit]:
        params = {
            "action": "query",
            "list": "search",
            "format": "json",
            "srlimit": str(limit),
            "srprop": "snippet",
            "utf8": "1",
            "origin": "*",  # CORS — harmless for our use
            "srsearch": query,
        }
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=TIMEOUT_S, headers={"User-Agent": UA}
        ) as client:
            try:
                r = await client.get(self.SEARCH_URL, params=params)
            except Exception as exc:  # noqa: BLE001
                log.warning("wikipedia search failed: %s", exc)
                return []
        if r.status_code != 200:
            log.warning(
                "wikipedia search non-200: %s",
                r.status_code, extra={"query": query},
            )
            return []
        try:
            data = r.json()
        except Exception:  # noqa: BLE001
            return []
        results = (data.get("query") or {}).get("search") or []
        hits: list[SearchHit] = []
        for item in results:
            title = (item.get("title") or "").strip()
            if not title:
                continue
            url = f"https://en.wikipedia.org/wiki/{quote_plus(title.replace(' ', '_'))}"
            # The Action API gives us a HTML snippet — strip tags.
            raw_snip = (item.get("snippet") or "").strip()
            snippet = re.sub(r"<[^>]+>", "", raw_snip).strip()
            hits.append(_hit(title, url, snippet))
            if len(hits) >= limit:
                break
        return hits


# ---------------------------------------------------------------------------
# DuckDuckGo HTML — no API key, but rate-limited from datacenter IPs.
# Kept as a secondary backend. We detect the "anomaly.js" challenge page
# and return zero hits instead of fake entries.
# ---------------------------------------------------------------------------
class DuckDuckGoBackend:
    name = "duckduckgo"

    async def search(self, query: str, limit: int = 5) -> list[SearchHit]:
        url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"
        async with httpx.AsyncClient(
            follow_redirects=True, timeout=TIMEOUT_S, headers={
                "User-Agent": UA,
                # DDG's HTML endpoint checks for a browser-ish Accept-Language
                # header; without it the response is bare-bones and may
                # trigger the anti-bot path.
                "Accept-Language": "en-US,en;q=0.9",
            }
        ) as client:
            try:
                r = await client.get(url)
            except Exception as exc:  # noqa: BLE001
                log.warning("duckduckgo search failed: %s", exc)
                return []
        if r.status_code != 200:
            return []

        hits: list[SearchHit] = []
        # DDG HTML uses result__a for the title link and result__snippet for body.
        matches = list(re.finditer(
            r'<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
            r.text,
            flags=re.S,
        ))
        # If the page is the anti-bot challenge, bail out silently.
        if not matches and "anomaly.js" in r.text:
            log.info("duckduckgo anti-bot page — skipping")
            return []
        for m in matches:
            href = m.group(1)
            title = re.sub(r"<[^>]+>", "", m.group(2)).strip()
            if not title or not href:
                continue
            # DDG wraps every result URL in a redirect like
            #   //duckduckgo.com/l/?uddg=<encoded-https-url>&rut=...
            # Unwrap it so fetch_url_text can actually GET the page.
            real_url = _unwrap_ddg_redirect(href)
            # Find the following snippet, if any
            tail = r.text[m.end(): m.end() + 4000]
            snip_match = re.search(
                r'class="result__snippet"[^>]*>(.*?)</a>',
                tail,
                flags=re.S,
            )
            snippet = (
                re.sub(r"<[^>]+>", "", snip_match.group(1)).strip()
                if snip_match
                else ""
            )
            hits.append(_hit(title, real_url, snippet))
            if len(hits) >= limit:
                break
        return hits


# ---------------------------------------------------------------------------
# Direct page fetcher — given a known URL, extract clean text via trafilatura.
# Used to grab the company's homepage, /about, /pricing etc. fresh at chat
# time (the user might be asking about changes that happened AFTER the
# initial crawl).
# ---------------------------------------------------------------------------
async def fetch_url_text(url: str, max_chars: int = 3000) -> tuple[str, str] | None:
    """Returns (title, body) for a URL, or None on failure.

    Special-cased for Wikipedia so we hit the REST API's clean JSON
    instead of parsing the rendered HTML. Anything else goes through
    the generic httpx + trafilatura path.
    """
    if "wikipedia.org/wiki/" in url:
        return await _fetch_wikipedia_summary(url, max_chars=max_chars)
    async with httpx.AsyncClient(
        follow_redirects=True, timeout=TIMEOUT_S, headers={"User-Agent": UA}
    ) as client:
        try:
            r = await client.get(url)
        except Exception as exc:  # noqa: BLE001
            log.warning("fetch_url_text failed for %s: %s", url, exc)
            return None
    if r.status_code != 200 or "text/html" not in r.headers.get("content-type", ""):
        return None
    text = trafilatura.extract(r.text, include_comments=False, include_tables=False) or ""
    text = text.strip()
    if not text:
        return None
    title_match = re.search(r"<title[^>]*>(.*?)</title>", r.text, flags=re.S | re.I)
    title = (
        re.sub(r"\s+", " ", title_match.group(1)).strip()
        if title_match
        else url
    )
    return (title, text[:max_chars])


async def _fetch_wikipedia_summary(
    url: str, max_chars: int = 3000
) -> tuple[str, str] | None:
    """Fetch a Wikipedia article via the REST summary endpoint.

    URL looks like https://en.wikipedia.org/wiki/Artificial_intelligence
    -> https://en.wikipedia.org/api/rest_v1/page/summary/Artificial_intelligence
    """
    try:
        # /wiki/Title -> /page/summary/Title
        path = url.split("/wiki/", 1)[1]
        # Unquote so we don't double-encode
        from urllib.parse import unquote
        path = unquote(path)
        api_url = f"https://en.wikipedia.org/api/rest_v1/page/summary/{quote_plus(path)}"
    except Exception:  # noqa: BLE001
        return None
    async with httpx.AsyncClient(
        follow_redirects=True, timeout=TIMEOUT_S, headers={"User-Agent": UA}
    ) as client:
        try:
            r = await client.get(api_url)
        except Exception as exc:  # noqa: BLE001
            log.warning("wikipedia REST failed for %s: %s", url, exc)
            return None
    if r.status_code != 200:
        return None
    try:
        data = r.json()
    except Exception:  # noqa: BLE001
        return None
    title = (data.get("title") or path.replace("_", " ")).strip()
    # The summary endpoint can give us an "extract" (short summary) and
    # sometimes a "description" (very short). Stitch them together so
    # the LLM has the full intro — that's where the answer to "what is
    # the capital of X" usually lives.
    parts: list[str] = []
    extract = (data.get("extract") or "").strip()
    if extract:
        parts.append(extract)
    description = (data.get("description") or "").strip()
    if description and description not in extract:
        parts.append(description)
    if not parts:
        return None
    full = "\n\n".join(parts)
    return (title, full[:max_chars])


# ---------------------------------------------------------------------------
# Orchestrator — query multiple backends, dedupe, return.
# ---------------------------------------------------------------------------
async def multi_source_search(
    query: str,
    *,
    limit_per_backend: int = 5,
    backends: list[SearchBackend] | None = None,
) -> list[SearchHit]:
    # DDG is the primary backend (richer, fresher general-web signal).
    # Wikipedia is the secondary fallback (clean, structured, no rate
    # limit, but limited to encyclopedic topics). Datacenter IPs
    # frequently get the DDG `anomaly.js` anti-bot page; when that
    # happens the DDG backend returns [] silently and Wikipedia carries
    # the load.
    backends = backends or [DuckDuckGoBackend(), WikipediaBackend()]
    tasks = [b.search(query, limit=limit_per_backend) for b in backends]
    raw = await asyncio.gather(*tasks, return_exceptions=True)
    seen: set[str] = set()
    merged: list[SearchHit] = []
    for backend, result in zip(backends, raw):
        if isinstance(result, Exception):
            log.warning("backend %s raised: %s", backend.name, result)
            continue
        for hit in result:
            if hit.url in seen:
                continue
            seen.add(hit.url)
            merged.append(hit)
    return merged


# ---------------------------------------------------------------------------
# Heuristic "live" source list — given a company name, build the canonical
# URLs we always want to consult: their site + common public sources.
# ---------------------------------------------------------------------------
def build_live_source_queries(
    company_name: str | None,
    company_url: str | None,
    question: str,
) -> list[str]:
    """Build a small list of search queries to fan out to the public web.

    The list intentionally mixes brand queries (who is this company) with
    the user's actual question. This way the retrieval surfaces both
    identity data and the topic the user cares about.
    """
    company = (company_name or "").strip()
    queries: list[str] = []
    if company:
        queries.append(f"{company} company overview")
        queries.append(f"{company} reviews G2 Capterra")
        queries.append(f"{company} competitors")
        queries.append(f"{company} tech stack BuiltWith")
    if company_url:
        queries.append(f"site:{company_url} {question}".strip())
    queries.append(question)
    # Dedupe while preserving order
    seen: set[str] = set()
    deduped: list[str] = []
    for q in queries:
        key = q.lower().strip()
        if key and key not in seen:
            seen.add(key)
            deduped.append(q)
    return deduped[:5]
