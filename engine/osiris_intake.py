"""Pull world events from Osiris feeds and normalize them to WorldEvent.

Osiris is the canonical world-event source. We read its public API routes
(GDELT geopolitical events, conflicts, news) and turn each into a seed we can
hand to MiroFish.
"""
from __future__ import annotations

import asyncio
import logging
import re

import httpx

from .config import CONFIG
from .models import WorldEvent

log = logging.getLogger("pythia.intake")

# Osiris API routes that emit world events worth simulating.
FEEDS = [
    ("/api/gdelt", "gdelt", "geopolitical"),
    ("/api/conflicts", "conflicts", "conflict"),
    ("/api/news", "news", "news"),
    ("/api/earthquakes", "usgs", "seismic"),
    ("/api/weather", "eonet", "weather"),
    ("/api/fires", "firms", "wildfire"),
    ("/api/air-quality", "openaq", "air-quality"),
    ("/api/country-risk", "risk", "instability"),
    ("/api/cyber-threats", "cyber", "cyber"),
    ("/api/infrastructure", "infra", "infrastructure"),
    ("/api/polymarket", "polymarket", "market-odds"),
    ("/api/markets", "markets", "markets"),
    ("/api/crypto", "crypto", "markets"),
    ("/api/frontlines", "frontlines", "conflict"),
    ("/api/displacement", "unhcr", "displacement"),
    ("/api/economy", "worldbank", "economy"),
    ("/api/censorship", "ooni", "censorship"),
    ("/api/health-outbreaks", "who", "health"),
    ("/api/unrest", "unrest", "unrest"),
]

# Words that raise an event's salience (drives auto-scan selection).
_HOT = {
    "war": 1.0, "attack": 0.9, "strike": 0.8, "missile": 0.95, "killed": 0.85,
    "coup": 0.95, "invasion": 1.0, "nuclear": 1.0, "explosion": 0.8, "protest": 0.6,
    "riot": 0.7, "election": 0.7, "ceasefire": 0.85, "sanction": 0.7, "default": 0.7,
    "collapse": 0.8, "resign": 0.7, "earthquake": 0.7, "outbreak": 0.8, "crisis": 0.75,
    "hurricane": 0.9, "typhoon": 0.9, "cyclone": 0.9, "tornado": 0.8, "storm": 0.7,
    "flood": 0.8, "volcano": 0.9, "eruption": 0.9, "tsunami": 1.0, "wildfire": 0.8,
    "breach": 0.75, "ransomware": 0.8, "famine": 0.85, "drought": 0.7, "evacuat": 0.85,
}


def _find_items(data) -> list[dict]:
    """Find the first list-of-dicts in an arbitrary Osiris JSON response."""
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        # common wrappers first
        for key in ("events", "items", "data", "results", "features", "articles", "news", "markets"):
            v = data.get(key)
            if isinstance(v, list) and v and isinstance(v[0], dict):
                return v
        # otherwise any list-of-dicts value
        for v in data.values():
            if isinstance(v, list) and v and isinstance(v[0], dict):
                return v
    return []


def _text(d: dict, *keys: str) -> str:
    for k in keys:
        v = d.get(k)
        if isinstance(v, str) and v.strip():
            return re.sub(r"<[^>]+>", "", v).strip()
    return ""


def _coord(d: dict):
    lat = d.get("lat") or d.get("latitude")
    lng = d.get("lng") or d.get("lon") or d.get("longitude")
    coords = d.get("coords") or (d.get("geometry") or {}).get("coordinates")
    if (lat is None or lng is None) and isinstance(coords, (list, tuple)) and len(coords) >= 2:
        lng, lat = coords[0], coords[1]  # GeoJSON [lng, lat]
    try:
        return (float(lat), float(lng)) if lat is not None and lng is not None else (None, None)
    except (TypeError, ValueError):
        return (None, None)


def _salience(title: str, summary: str, raw: dict) -> float:
    text = f"{title} {summary}".lower()
    score = 0.4
    for word, weight in _HOT.items():
        if word in text:
            score = max(score, weight)
    # honor an upstream risk score if Osiris provided one
    rs = raw.get("risk_score") or raw.get("severity_score")
    if isinstance(rs, (int, float)):
        score = max(score, min(1.0, float(rs) / (100.0 if rs > 1 else 1.0)))
    return round(min(1.0, score), 2)


def _to_event(d: dict, source: str, category: str) -> WorldEvent | None:
    title = _text(d, "title", "name", "headline", "question", "html", "place")
    mag = d.get("magnitude") or d.get("mag")
    if mag and _text(d, "place", "location"):
        title = f"M{mag} — {_text(d, 'place', 'location')}"
    if not title:
        return None
    summary = _text(d, "description", "summary", "snippet", "content", "machine_assessment")
    # fold a status/severity/risk field into the summary (country-risk, weather alerts, etc.)
    status = _text(d, "status", "level", "risk", "storm_level", "severity", "alert")
    if status and status.lower() not in (summary or "").lower() and status.lower() not in title.lower():
        summary = f"[{status}] {summary}".strip()
    # Polymarket: fold the crowd probability in so the oracle sees it as an anchor
    yp = d.get("yes_prob")
    if yp is not None:
        try:
            summary = f"crowd odds: {round(float(yp) * 100)}% YES. {summary}".strip()
        except (TypeError, ValueError):
            pass
    lat, lng = _coord(d)
    return WorldEvent(
        title=title[:240],
        summary=summary[:2000],
        category=(category if source == "polymarket" else (_text(d, "category") or category)),
        source=source,
        lat=lat,
        lng=lng,
        url=_text(d, "url", "link", "feed_url"),
        salience=_salience(title, summary, d),
        raw={k: d[k] for k in list(d)[:25]},
    )


def _markets_events(data: dict, source: str) -> list[WorldEvent]:
    """Flatten Osiris markets/crypto (grouped name->{price,change_percent}) into events."""
    out: list[WorldEvent] = []
    if not isinstance(data, dict):
        return out

    def emit(name: str, v: dict) -> None:
        if not isinstance(v, dict) or v.get("price") is None:
            return
        chg = v.get("change_percent")
        sign = "+" if (chg or 0) >= 0 else ""
        title = f"{name}: {v['price']}" + (f" ({sign}{chg}%)" if chg is not None else "")
        out.append(WorldEvent(title=title[:120], category="markets", source=source,
                              salience=min(1.0, 0.45 + abs(float(chg or 0)) / 10)))

    for k, v in data.items():
        if isinstance(v, dict):
            if "price" in v:
                emit(k, v)                       # flat: name -> quote
            else:
                for name, q in v.items():        # group: indices/commodities/... -> {name: quote}
                    emit(name, q)
    return out


def _frontline_events(data: dict) -> list[WorldEvent]:
    """Summarize the DeepStateMap territory GeoJSON into a single oracle signal."""
    feats = (data or {}).get("features") or []
    if not feats:
        return []
    occ = sum(1 for f in feats if (f.get("properties") or {}).get("status") == "occupied")
    con = sum(1 for f in feats if (f.get("properties") or {}).get("status") == "contested")
    updated = (data or {}).get("updated") or "recently"
    title = f"Ukraine warfront: {occ} occupied territory areas, {con} contested zones (DeepStateMap, updated {updated})"
    return [WorldEvent(title=title[:160], summary="Live Russian-occupied + contested territory control map.",
                       category="conflict", source="frontlines", lat=48.5, lng=31.2, salience=0.9)]


def _displacement_events(data: dict) -> list[WorldEvent]:
    """UNHCR forced-displacement → one global summary + the top origin countries (with coords)."""
    feats = (data or {}).get("features") or []
    out: list[WorldEvent] = []
    summ = (data or {}).get("summary") or ""
    if summ:
        out.append(WorldEvent(title=f"Global forced displacement — top origins: {summ}"[:180],
                              summary="UNHCR refugees, asylum-seekers and IDPs by country of origin.",
                              category="displacement", source="unhcr", salience=0.85))
    for f in feats[:5]:
        p = f.get("properties") or {}
        c = (f.get("geometry") or {}).get("coordinates") or [None, None]
        out.append(WorldEvent(title=str(p.get("label", ""))[:140], category="displacement",
                              source="unhcr", lng=c[0], lat=c[1], salience=0.8))
    return out


def _summary_signal(data: dict, source: str, category: str, prefix: str) -> list[WorldEvent]:
    """Single oracle signal from a country-level feed's `summary` string."""
    summ = (data or {}).get("summary") or ""
    if not summ:
        return []
    return [WorldEvent(title=f"{prefix}: {summ}"[:180], category=category, source=source, salience=0.75)]


def _health_events(data: dict) -> list[WorldEvent]:
    """WHO disease outbreaks → a summary signal + the most recent outbreaks (with coords)."""
    out = _summary_signal(data, "who", "health", "Disease outbreaks (WHO)")
    for f in (data or {}).get("features", [])[:4]:
        p = f.get("properties") or {}
        c = (f.get("geometry") or {}).get("coordinates") or [None, None]
        out.append(WorldEvent(title=str(p.get("label", ""))[:140], category="health",
                              source="who", lng=c[0], lat=c[1], salience=0.8))
    return out


def _unrest_events(data: dict) -> list[WorldEvent]:
    """GDELT protest hotspots → a summary signal + the top locations (with coords)."""
    out = _summary_signal(data, "unrest", "unrest", "Protest hotspots (GDELT)")
    for f in (data or {}).get("features", [])[:6]:
        p = f.get("properties") or {}
        c = (f.get("geometry") or {}).get("coordinates") or [None, None]
        out.append(WorldEvent(title=str(p.get("label", ""))[:140], category="unrest",
                              source="unrest", lng=c[0], lat=c[1],
                              salience=min(1.0, 0.6 + (p.get("events", 0) or 0) / 20)))
    return out


class OsirisIntake:
    def __init__(self, base_url: str | None = None):
        self.base = (base_url or CONFIG.osiris_url).rstrip("/")

    async def health(self) -> bool:
        try:
            async with httpx.AsyncClient(timeout=5) as c:
                r = await c.get(f"{self.base}/api/health")
                return r.status_code < 500
        except httpx.HTTPError:
            return False

    async def _fetch_feed(self, c: httpx.AsyncClient, path: str, source: str, category: str) -> list[WorldEvent]:
        out: list[WorldEvent] = []
        try:
            # generous: Next.js compiles each route on first hit (cold start), and a few
            # feeds (e.g. /api/unrest aggregates many GDELT files) are slow until cached.
            r = await c.get(f"{self.base}{path}", timeout=35)
            if r.status_code < 400:
                data = r.json()
                if source in ("markets", "crypto"):
                    out.extend(_markets_events(data, source))
                elif source == "frontlines":
                    out.extend(_frontline_events(data))
                elif source == "unhcr":
                    out.extend(_displacement_events(data))
                elif source == "worldbank":
                    out.extend(_summary_signal(data, "worldbank", "economy", "Cost-of-living — highest inflation"))
                elif source == "ooni":
                    out.extend(_summary_signal(data, "ooni", "censorship", "Internet censorship — top network-anomaly countries"))
                elif source == "who":
                    out.extend(_health_events(data))
                elif source == "unrest":
                    out.extend(_unrest_events(data))
                else:
                    for d in _find_items(data):
                        ev = _to_event(d, source, category)
                        if ev:
                            out.append(ev)
        except (httpx.HTTPError, ValueError) as e:
            log.debug("feed %s failed: %s", path, e)
        return out

    async def fetch(self, limit: int = 40) -> list[WorldEvent]:
        # Fetch feeds concurrently so one slow/dead feed (e.g. GDELT) can't starve the rest.
        async with httpx.AsyncClient(timeout=25) as c:
            batches = await asyncio.gather(*[self._fetch_feed(c, p, s, cat) for p, s, cat in FEEDS])
        events: list[WorldEvent] = [ev for batch in batches for ev in batch]
        # dedupe by lowercased title, keep highest salience, sort
        seen: dict[str, WorldEvent] = {}
        for ev in events:
            key = ev.title.lower()[:80]
            if key not in seen or ev.salience > seen[key].salience:
                seen[key] = ev
        ranked = sorted(seen.values(), key=lambda e: e.salience, reverse=True)
        return ranked[:limit]
