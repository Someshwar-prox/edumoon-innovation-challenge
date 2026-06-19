"""Deterministic extractors for contact info, JSON-LD, and social links."""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from urllib.parse import urlparse

from bs4 import BeautifulSoup

log = logging.getLogger(__name__)


@dataclass
class ExtractedContact:
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    social: dict[str, str] | None = None


_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_PHONE_RE = re.compile(r"\+?\d[\d\s().-]{7,}\d")

_SOCIAL_DOMAINS = {
    "linkedin.com": "linkedin",
    "twitter.com": "twitter",
    "x.com": "twitter",
    "facebook.com": "facebook",
    "instagram.com": "instagram",
    "youtube.com": "youtube",
    "github.com": "github",
    "tiktok.com": "tiktok",
}


def _is_obfuscated_email(addr: str) -> bool:
    lower = addr.lower()
    return any(token in lower for token in ("example.com", "yourname", "youremail", "noreply@"))


def _looks_like_phone(raw: str) -> bool:
    digits = re.sub(r"\D", "", raw)
    return 7 <= len(digits) <= 15


def _dedupe_preserve_order(items: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for item in items:
        if item not in seen:
            seen.add(item)
            out.append(item)
    return out


def extract_contact(pages: list[dict]) -> ExtractedContact:
    contact = ExtractedContact(social={})
    emails: list[str] = []
    phones: list[str] = []

    for page in pages:
        text = page.get("cleaned_text", "")
        for m in _EMAIL_RE.findall(text):
            if not _is_obfuscated_email(m):
                emails.append(m)
        for m in _PHONE_RE.findall(text):
            if _looks_like_phone(m):
                phones.append(m.strip())

    emails = _dedupe_preserve_order(emails)
    phones = _dedupe_preserve_order(phones)

    if emails:
        contact.email = emails[0]
    if phones:
        contact.phone = phones[0]

    return contact


def extract_social(pages: list[dict]) -> dict[str, str]:
    social: dict[str, str] = {}
    for page in pages:
        url = page.get("url", "")
        host = urlparse(url).netloc.lower()
        for domain, key in _SOCIAL_DOMAINS.items():
            if domain in host and key not in social:
                social[key] = f"{urlparse(url).scheme}://{host}"
                break
    return social


def extract_jsonld(pages: list[dict], cache_dir=None) -> dict:
    result: dict = {}

    if cache_dir is None:
        return result

    for page in pages:
        path = page.get("raw_html_path")
        if not path:
            continue
        try:
            html = open(path, encoding="utf-8", errors="ignore").read()
        except OSError:
            continue
        soup = BeautifulSoup(html, "lxml")
        for tag in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(tag.string or "{}")
            except (json.JSONDecodeError, TypeError):
                continue
            if isinstance(data, list):
                for item in data:
                    _absorb_jsonld(item, result)
            else:
                _absorb_jsonld(data, result)
    return result


def _absorb_jsonld(data, result):
    if not isinstance(data, dict):
        return
    graph = data.get("@graph")
    if isinstance(graph, list):
        for item in graph:
            _absorb_jsonld(item, result)
    t = data.get("@type", "")
    if isinstance(t, list):
        t = next((x for x in t if isinstance(x, str)), "")
    t_lower = t.lower()
    if t_lower == "organization" and "organization" not in result:
        org = {
            "name": data.get("name"),
            "description": data.get("description"),
            "url": data.get("url"),
            "logo": data.get("logo"),
        }
        contact = data.get("contactPoint") or {}
        if isinstance(contact, list) and contact:
            contact = contact[0]
        if isinstance(contact, dict):
            org["email"] = contact.get("email")
            org["phone"] = contact.get("telephone")
            addr = contact.get("address") or {}
            if isinstance(addr, dict):
                org["address"] = ", ".join(
                    filter(None, [addr.get("streetAddress"), addr.get("addressLocality"),
                                  addr.get("addressRegion"), addr.get("postalCode"),
                                  addr.get("addressCountry")])
                )
        result["organization"] = {k: v for k, v in org.items() if v}
    elif t_lower == "faqpage" and "faqs" not in result:
        main = data.get("mainEntity") or []
        faqs: list[dict] = []
        for entry in main:
            if not isinstance(entry, dict):
                continue
            q = entry.get("name")
            acc = entry.get("acceptedAnswer") or {}
            a = acc.get("text") if isinstance(acc, dict) else None
            if q and a:
                faqs.append({"question": q, "answer": a})
        if faqs:
            result["faqs"] = faqs
