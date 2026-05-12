#!/usr/bin/env python3
"""
Aggregate Ian's reading feeds into a JSON cache for the /reading page.
Stdlib only. Same pattern as the macroprep feed aggregator.

Writes:
    public/data/feeds/reading.json   - top 80 items, by date desc
    public/data/feeds/_sources.json  - per-feed health
"""
from __future__ import annotations

import json
import re
import sys
import time
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Iterable, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

USER_AGENT = (
    "ihelfrich-hub-reading-aggregator/1.0 "
    "(+https://github.com/ihelfrich/ihelfrich.github.io; contact: ianthelfrich@gmail.com)"
)
TIMEOUT = 20
MAX_ITEMS = 80
OUTPUT_DIR = Path("public/data/feeds")

# Curated set of econ + development blogs and working-paper feeds.
# This matches the reading habit documented in CLAUDE.md.
FEEDS = [
    {"name": "NBER — New Working Papers",
     "url": "https://www.nber.org/rss/new.xml",
     "category": "working-papers"},
    {"name": "World Bank — Development Impact",
     "url": "https://blogs.worldbank.org/feed/category/impactevaluations.xml",
     "category": "dev-econ-blog"},
    {"name": "VoxDev",
     "url": "https://voxdev.org/rss.xml",
     "category": "dev-econ-blog"},
    {"name": "VoxEU / CEPR",
     "url": "https://cepr.org/voxeu/columns.rss",
     "category": "econ-policy"},
    {"name": "Center for Global Development",
     "url": "https://www.cgdev.org/rss-feed/article/all",
     "category": "dev-econ-blog"},
    {"name": "Marginal Revolution",
     "url": "https://marginalrevolution.com/feed",
     "category": "econ-blog"},
    {"name": "Bruegel",
     "url": "https://www.bruegel.org/rss.xml",
     "category": "eu-econ-policy"},
    {"name": "J-PAL — Latest",
     "url": "https://www.povertyactionlab.org/feed/latest.xml",
     "category": "dev-econ-research"},
    {"name": "IPA — News",
     "url": "https://poverty-action.org/rss.xml",
     "category": "dev-econ-research"},
    {"name": "IFS — Publications",
     "url": "https://ifs.org.uk/feeds/publications",
     "category": "uk-econ-policy"},
    {"name": "Bank for International Settlements — Working Papers",
     "url": "https://www.bis.org/doclist/wppubls.rss",
     "category": "central-banking"},
    {"name": "IMF — Working Papers",
     "url": "https://www.imf.org/en/Publications/RSS?language=eng&series=IMF%20Working%20Papers",
     "category": "imf"},
]

TAG_RE = re.compile(r"<[^>]+>")
WS_RE = re.compile(r"\s+")


@dataclass
class Item:
    source: str
    category: str
    title: str
    link: str
    date: str
    date_epoch: float
    summary: str


@dataclass
class SourceStatus:
    name: str
    url: str
    category: str
    ok: bool
    item_count: int = 0
    error: Optional[str] = None
    fetched_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


def clean_html(text: Optional[str], max_len: int = 280) -> str:
    if not text:
        return ""
    text = TAG_RE.sub("", text)
    text = (text.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
                .replace("&quot;", '"').replace("&#39;", "'").replace("&nbsp;", " "))
    text = WS_RE.sub(" ", text).strip()
    return text if len(text) <= max_len else text[:max_len - 1].rstrip() + "…"


def parse_date(raw: Optional[str]) -> Optional[datetime]:
    if not raw:
        return None
    raw = raw.strip()
    try:
        dt = parsedate_to_datetime(raw)
        if dt is not None:
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        pass
    iso = raw.replace("Z", "+00:00")
    for fmt in (None, "%Y-%m-%dT%H:%M:%S%z", "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            dt = datetime.fromisoformat(iso) if fmt is None else datetime.strptime(iso, fmt)
            return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def fetch(url: str) -> bytes:
    req = Request(url, headers={
        "User-Agent": USER_AGENT,
        "Accept": "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.5",
    })
    with urlopen(req, timeout=TIMEOUT) as resp:
        return resp.read()


def localname(tag: str) -> str:
    return tag.split("}", 1)[1] if "}" in tag else tag


def first_text(elem: ET.Element, names: Iterable[str]) -> Optional[str]:
    name_set = set(names)
    for child in elem:
        if localname(child.tag) in name_set:
            if child.text and child.text.strip():
                return child.text
            inner = "".join(ET.tostring(c, encoding="unicode") for c in child)
            if inner.strip():
                return inner
    return None


def first_link(elem: ET.Element) -> Optional[str]:
    for child in elem:
        if localname(child.tag) != "link":
            continue
        href = child.attrib.get("href")
        if href:
            rel = child.attrib.get("rel", "alternate")
            if rel == "alternate":
                return href
        if child.text and child.text.strip():
            return child.text.strip()
    for child in elem:
        if localname(child.tag) == "link" and child.attrib.get("href"):
            return child.attrib["href"]
    return None


def parse_feed(xml_bytes: bytes, source_name: str, category: str) -> list[Item]:
    if xml_bytes[:3] == b"\xef\xbb\xbf":
        xml_bytes = xml_bytes[3:]
    root = ET.fromstring(xml_bytes)
    if localname(root.tag) == "feed":
        entries = [c for c in root if localname(c.tag) == "entry"]
        title_keys = ("title",)
        date_keys = ("updated", "published")
        summary_keys = ("summary", "content")
    else:
        channel = next((c for c in root if localname(c.tag) == "channel"), root)
        entries = [c for c in channel if localname(c.tag) == "item"]
        title_keys = ("title",)
        date_keys = ("pubDate", "date", "updated", "published")
        summary_keys = ("description", "summary", "encoded")
    items = []
    for e in entries:
        title = clean_html(first_text(e, title_keys), max_len=300) or "(untitled)"
        link = first_link(e) or ""
        raw_date = first_text(e, date_keys)
        dt = parse_date(raw_date)
        if dt is None:
            continue
        summary = clean_html(first_text(e, summary_keys))
        items.append(Item(
            source=source_name, category=category,
            title=title, link=link,
            date=dt.astimezone(timezone.utc).isoformat(),
            date_epoch=dt.timestamp(),
            summary=summary,
        ))
    return items


def main() -> int:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    all_items, statuses = [], []
    for feed in FEEDS:
        name, url, category = feed["name"], feed["url"], feed["category"]
        print(f"[fetch] {name}", file=sys.stderr)
        st = SourceStatus(name=name, url=url, category=category, ok=False)
        try:
            raw = fetch(url)
            items = parse_feed(raw, name, category)
            all_items.extend(items)
            st.ok = True
            st.item_count = len(items)
            print(f"        -> {len(items)} items", file=sys.stderr)
        except (HTTPError, URLError) as exc:
            st.error = f"network: {exc}"
            print(f"        !! {exc}", file=sys.stderr)
        except ET.ParseError as exc:
            st.error = f"xml-parse: {exc}"
            print(f"        !! xml: {exc}", file=sys.stderr)
        except Exception as exc:
            st.error = f"{type(exc).__name__}: {exc}"
            print(f"        !! {exc}", file=sys.stderr)
        statuses.append(st)
        time.sleep(0.5)

    all_items.sort(key=lambda x: x.date_epoch, reverse=True)
    capped = all_items[:MAX_ITEMS]
    payload = [{k: v for k, v in asdict(it).items() if k != "date_epoch"}
               for it in capped]

    (OUTPUT_DIR / "reading.json").write_text(
        json.dumps(payload, indent=2, ensure_ascii=False))
    (OUTPUT_DIR / "_sources.json").write_text(
        json.dumps({"generated_at": datetime.now(timezone.utc).isoformat(),
                    "sources": [asdict(s) for s in statuses]}, indent=2,
                   ensure_ascii=False))

    ok = sum(1 for s in statuses if s.ok)
    print(f"[done] {ok}/{len(statuses)} feeds OK; {len(payload)} items", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
