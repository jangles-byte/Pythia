"""Pull world events from Osiris feeds and normalize them to WorldEvent.

Osiris is the canonical world-event source. We read its public API routes
(GDELT geopolitical events, conflicts, news) and turn each into a seed we can
hand to MiroFish.
"""
from __future__ import annotations

import asyncio
import logging
import re
from datetime import datetime, timezone

import httpx

from .config import CONFIG, HTTPX_VERIFY
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
    ("/api/manifold", "manifold", "market-odds"),
    ("/api/markets", "markets", "markets"),
    ("/api/futures", "futures", "futures"),
    ("/api/gdacs-alerts", "gdacs", "disaster"),
    ("/api/hurricanes", "nhc", "hurricane"),
    ("/api/flood-outlook", "glofas", "flood-outlook"),
    ("/api/wiki-attention", "wikipedia", "attention"),
    ("/api/ioda", "ioda", "outage"),
    ("/api/space-weather", "swpc", "space-weather"),
    ("/api/crypto", "crypto", "markets"),
    ("/api/frontlines", "frontlines", "conflict"),
    ("/api/displacement", "unhcr", "displacement"),
    ("/api/economy", "worldbank", "economy"),
    ("/api/censorship", "ooni", "censorship"),
    ("/api/health-outbreaks", "who", "health"),
    ("/api/unrest", "unrest", "unrest"),
    ("/api/food-security", "hungermap", "food"),
    ("/api/kev", "cisa-kev", "cyber"),
    ("/api/faa-status", "faa", "aviation"),
    ("/api/unemployment", "wb-unemployment", "economy"),
    ("/api/gdp-growth", "wb-gdp", "economy"),
    ("/api/poverty", "wb-poverty", "economy"),
    ("/api/edgar", "sec-edgar", "markets"),
    ("/api/usaspending", "usaspending", "economy"),
    ("/api/kalshi", "kalshi", "market-odds"),
    ("/api/grid", "grid", "energy"),
    ("/api/wastewater", "wastewater", "health"),
    ("/api/climate", "climate", "climate"),
    ("/api/geohazards", "geohazards", "disaster"),
    ("/api/ofac", "ofac", "geopolitical"),
    ("/api/hackernews", "hackernews", "attention"),
    ("/api/planet-vitals", "planet-vitals", "environment"),
    # ── the "eyes": position/imagery layers, summarized so the oracle sees them too ──
    ("/api/flights", "flights", "movement"),
    ("/api/maritime", "maritime", "maritime"),
    ("/api/radiation", "radiation", "environment"),
    ("/api/satellites", "satellites", "space"),
    ("/api/balloons", "balloons", "movement"),
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
    if lat is None or lng is None:
        geo = (d.get("geometry") or {}).get("coordinates")
        if isinstance(geo, (list, tuple)) and len(geo) >= 2:
            lng, lat = geo[0], geo[1]      # GeoJSON is [lng, lat]
    if lat is None or lng is None:
        coords = d.get("coords")
        if isinstance(coords, (list, tuple)) and len(coords) >= 2:
            lat, lng = coords[0], coords[1]  # Osiris `coords` is [lat, lng] (see news route)
    try:
        lat, lng = float(lat), float(lng)
    except (TypeError, ValueError):
        return (None, None)
    if abs(lat) > 90 or abs(lng) > 180:
        return (None, None)
    return (lat, lng)


# A feed's risk scale CANNOT be inferred from the value: 8 means 8/10 from the
# news route but 8/100 from country-risk, and guessing wrong INVERTS the ranking
# — which is the whole bug this map exists to kill. So each producer declares its
# own scale, keyed by source. An unlisted source is IGNORED rather than guessed:
# dropping a signal is recoverable, inverting one is not.
#   news -> scoreRisk() in osiris news/route.ts: int, starts at 1, +2 per risk
#           keyword, capped at 10.
# NOTE: country-risk ("risk", a 0-100 scale) is deliberately absent — it has a
# dedicated handler (_country_risk_events) that never reaches _salience. Listing
# it here would be dead config that reads as live. It was the feed that exposed
# the guessing bug: 8 means 8/10 from news but 8/100 from country-risk.
RISK_SCALE = {
    "news": 10.0,
}


def _salience(title: str, summary: str, raw: dict, source: str = "") -> float:
    text = f"{title} {summary}".lower()
    score = 0.4
    for word, weight in _HOT.items():
        if word in text:
            score = max(score, weight)
    # Honor an upstream risk score ONLY when we know that source's scale.
    rs = raw.get("risk_score") or raw.get("severity_score")
    scale = RISK_SCALE.get(source)
    if scale and isinstance(rs, (int, float)) and not isinstance(rs, bool) and rs > 0:
        score = max(score, min(1.0, float(rs) / scale))
    return round(min(1.0, score), 2)


def _event_ts(d: dict) -> int | None:
    """The item's own event time in epoch ms, if the feed carries one.
    Without this every event is stamped at fetch time, so week-old posts
    surface as breaking and `since` filtering is meaningless."""
    for k in ("published", "pubDate", "pub_date", "date_added", "date", "datetime", "updated", "time"):
        v = d.get(k)
        if v is None or v == "":
            continue
        if isinstance(v, bool):
            continue
        if isinstance(v, (int, float)):        # epoch seconds or ms
            v = float(v)
            if v > 1e12:
                return int(v)
            if v > 1e9:
                return int(v * 1000)
            continue
        if isinstance(v, str):
            try:
                dt = datetime.fromisoformat(v.strip().replace("Z", "+00:00"))
            except ValueError:
                continue
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            return int(dt.timestamp() * 1000)
    return None


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
    evt = WorldEvent(
        title=title[:240],
        summary=summary[:2000],
        category=(category if source == "polymarket" else (_text(d, "category") or category)),
        source=source,
        lat=lat,
        lng=lng,
        url=_text(d, "url", "link", "feed_url"),
        salience=_salience(title, summary, d, source),
        raw={k: d[k] for k in list(d)[:25]},
    )
    ts = _event_ts(d)
    if ts:
        evt.ts = ts
    return evt


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


def _futures_events(data: dict) -> list[WorldEvent]:
    """Futures + term structure → forward-looking market events, geo-anchored to
    supply regions. Backwardation (near > far) is a physical-tightness signal."""
    out: list[WorldEvent] = []
    for f in (data or {}).get("futures", []):
        if not isinstance(f, dict) or f.get("price") is None:
            continue
        try:
            chg = float(f.get("change_percent") or 0)
        except (TypeError, ValueError):
            chg = 0.0
        unit = f" {f['unit']}" if f.get("unit") else ""
        sign = "+" if chg >= 0 else ""
        bits = [f"{f.get('name') or f.get('symbol')}: {f['price']}{unit} ({sign}{chg}%)"]
        sal = 0.45 + abs(chg) / 10
        curve = f.get("curve") or {}
        if curve.get("structure"):
            sp = curve.get("spread_pct", 0)
            bits.append(f"6-mo curve in {curve['structure']} ({'+' if sp >= 0 else ''}{sp}%)")
            if curve["structure"] == "backwardation":
                sal += 0.15
        if f.get("symbol") == "^VIX":
            try:
                sal = max(sal, min(1.0, float(f["price"]) / 40))  # VIX 40 ≈ full alarm
            except (TypeError, ValueError):
                pass
        out.append(WorldEvent(
            title=" — ".join(bits)[:200],
            summary=f"Supply-region anchor: {f['region']}" if f.get("region") else "",
            category="futures", source="futures",
            lat=f.get("lat"), lng=f.get("lng"),
            salience=round(min(1.0, sal), 2),
        ))
    return out


def _gdacs_events(data: dict) -> list[WorldEvent]:
    """GDACS disaster alerts — salience straight from the Red/Orange/Green level."""
    sal = {"Red": 0.95, "Orange": 0.75, "Green": 0.45}

    def _f(v):
        return float(v) if isinstance(v, (int, float)) else None

    out = []
    for e in (data or {}).get("events", []):
        if not e.get("title"):
            continue
        out.append(WorldEvent(
            title=f"[{e.get('alert', 'Green')}] {e['title']}"[:200],
            summary=f"{e.get('type', '')} — {e.get('country', '')}".strip(" —"),
            category="disaster", source="gdacs",
            lat=_f(e.get("lat")), lng=_f(e.get("lng")), url=e.get("url") or "",
            salience=sal.get(e.get("alert"), 0.45),
        ))
    return out


def _hurricane_events(data: dict) -> list[WorldEvent]:
    """NHC active storms — the forecast cone is the market's weather equivalent."""
    sal = {"Major Hurricane": 1.0, "Hurricane": 0.95, "Tropical Storm": 0.8}
    out = []
    for s in (data or {}).get("storms", []):
        if not s.get("name"):
            continue
        winds = f", {s['winds_mph']} mph winds" if s.get("winds_mph") else ""
        out.append(WorldEvent(
            title=f"{s.get('classification', 'Storm')} {s['name']}{winds} (NHC forecast cone live)"[:180],
            category="hurricane", source="nhc",
            lat=s.get("lat"), lng=s.get("lng"),
            salience=sal.get(s.get("classification"), 0.7),
        ))
    return out


def _flood_outlook_events(data: dict) -> list[WorldEvent]:
    """GloFAS 30-day discharge outlook — only basins with a real forecast surge."""
    out = []
    for b in (data or {}).get("basins", []):
        risk = b.get("risk") or 0
        if risk < 2:
            continue
        out.append(WorldEvent(
            title=f"Flood outlook: {b['name']} forecast discharge {risk}x recent median, peaking {b.get('peak_day', 'soon')}"[:180],
            summary="Copernicus GloFAS 30-day river discharge forecast.",
            category="flood-outlook", source="glofas",
            lat=b.get("lat"), lng=b.get("lng"),
            salience=round(min(1.0, 0.5 + risk / 20), 2),
        ))
    return out[:8]


def _wiki_events(data: dict) -> list[WorldEvent]:
    """Wikipedia attention spikes — what humanity suddenly cares about."""
    out = []
    for it in (data or {}).get("items", [])[:12]:
        spike = it.get("spike")
        tag = "new to the charts" if it.get("new_entry") else (f"{spike}x spike" if spike and spike >= 2 else None)
        if not tag:
            continue
        out.append(WorldEvent(
            title=f"Wikipedia attention: {it['title']} — {it['views']:,} views ({tag})"[:180],
            category="attention", source="wikipedia", url=it.get("url") or "",
            salience=round(min(0.9, 0.45 + (spike or 3) / 20), 2),
        ))
    return out


def _ioda_events(data: dict) -> list[WorldEvent]:
    """IODA country-level internet outages — darkness is often the first signal."""
    out = []
    for o in (data or {}).get("outages", [])[:10]:
        out.append(WorldEvent(
            title=f"Internet outage: {o['country']} — connectivity drop score {o['score']} (24h)"[:160],
            category="outage", source="ioda",
            lat=o.get("lat"), lng=o.get("lng"),
            salience=round(min(1.0, 0.55 + o.get("score", 0) / 40000), 2),
        ))
    return out


# Osiris country-risk emits {code, risk_score, risk_level, tags} — no name, no
# coords — so the generic path found no title and DROPPED all 20 silently. Map
# the ISO-2 codes it actually serves to a name and an approximate centroid so
# they become real, locatable events. Codes are from RISK_FACTORS in
# osiris/src/app/api/country-risk/route.ts; extend both together.
_COUNTRY = {
    "UA": ("Ukraine", 49.0, 32.0),      "RU": ("Russia", 61.5, 105.3),
    "IL": ("Israel", 31.0, 34.9),       "PS": ("Palestinian Territories", 31.9, 35.2),
    "SY": ("Syria", 34.8, 39.0),        "YE": ("Yemen", 15.6, 48.5),
    "MM": ("Myanmar", 21.9, 95.9),      "SD": ("Sudan", 12.9, 30.2),
    "AF": ("Afghanistan", 33.9, 67.7),  "KP": ("North Korea", 40.3, 127.5),
    "IR": ("Iran", 32.4, 53.7),         "CN": ("China", 35.9, 104.2),
    "TW": ("Taiwan", 23.7, 121.0),      "VE": ("Venezuela", 6.4, -66.6),
    "HT": ("Haiti", 18.9, -72.3),       "LB": ("Lebanon", 33.9, 35.9),
    "PK": ("Pakistan", 30.4, 69.3),     "SO": ("Somalia", 5.2, 46.2),
    "LY": ("Libya", 26.3, 17.2),        "ET": ("Ethiopia", 9.1, 40.5),
}


def _country_risk_events(data: dict) -> list[WorldEvent]:
    """Osiris country-risk → locatable events.

    This is a HAND-MAINTAINED geopolitical baseline (osiris marks it
    `static: true`), not a live measurement — so salience is capped well below
    breaking-news territory and derived from the score alone. It is background
    context for the oracle, not a signal that something just happened.
    """
    out = []
    for c in (data or {}).get("countries", []) or []:
        if not isinstance(c, dict):
            continue
        code = str(c.get("code") or "").upper()
        score = c.get("risk_score")
        if code not in _COUNTRY or not isinstance(score, (int, float)):
            continue
        name, lat, lng = _COUNTRY[code]
        tags = ", ".join(t.replace("_", " ") for t in (c.get("tags") or []))
        level = c.get("risk_level", "")
        out.append(WorldEvent(
            title=f"Country risk: {name} {score}/100 ({level})"[:120],
            summary=(f"Standing geopolitical baseline — {tags}." if tags else
                     "Standing geopolitical baseline.") + " Static reference, not a live event.",
            category="instability", source="risk",
            lat=lat, lng=lng,
            # Ceiling 0.5: a static table must never outrank live signal. A
            # 90/100 baseline is context; a missile landing is news.
            salience=round(min(0.5, float(score) / 200.0), 2),
        ))
    return out


def _space_weather_events(data: dict) -> list[WorldEvent]:
    """NOAA SWPC — geomagnetic storms + solar flares (satellites, GPS, grids)."""
    out = []
    kp = data.get("kp_index")
    if kp is not None:
        out.append(WorldEvent(
            title=f"Space weather: Kp {kp} — {data.get('storm_level', 'Quiet')}",
            category="space-weather", source="swpc",
            salience=round(min(1.0, 0.3 + max(0.0, float(kp) - 3) * 0.15), 2),
        ))
    for fl in (data.get("solar_flares") or [])[:3]:
        cls = str(fl.get("class", ""))
        if cls[:1] in ("M", "X"):    # only flares big enough to matter
            out.append(WorldEvent(
                title=f"Solar flare {cls} (peak {fl.get('peak', '?')})"[:120],
                category="space-weather", source="swpc",
                salience=0.85 if cls.startswith("X") else 0.6,
            ))
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


def _kev_events(data: dict) -> list[WorldEvent]:
    """CISA KEV: vulnerabilities being actively exploited in the wild — the top
    of the cyber-signal food chain. Newest additions only; ransomware use raises
    salience."""
    out: list[WorldEvent] = []
    from .models import now_ms as _now
    week_ago = _now() - 7 * 86_400_000
    for v in (data.get("vulns") or [])[:15]:
        try:
            import time as _t
            added_ms = int(_t.mktime(_t.strptime(v.get("date_added", ""), "%Y-%m-%d")) * 1000)
        except (ValueError, TypeError):
            added_ms = 0
        fresh = added_ms >= week_ago
        out.append(WorldEvent(
            title=f"Actively exploited: {v.get('cve')} — {v.get('vendor')} {v.get('product')}"[:240],
            summary=(f"[{'RANSOMWARE' if v.get('ransomware') else 'KEV'}] {v.get('name', '')}. "
                     f"{v.get('description', '')}")[:2000],
            category="cyber", source="cisa-kev", lat=None, lng=None,
            url=v.get("url"),
            salience=min(1.0, (0.8 if v.get("ransomware") else 0.65) + (0.15 if fresh else 0.0)),
            raw={},
        ))
    return out


def _faa_events(data: dict) -> list[WorldEvent]:
    """FAA airspace pain: ground stops / delay programs / closures at major US
    airports — the first visible symptom of storms, outages, and security events."""
    sal = {"closure": 0.9, "ground stop": 0.85, "ground delay": 0.7, "delays": 0.55}
    out: list[WorldEvent] = []
    for e in (data.get("events") or [])[:20]:
        typ = e.get("type", "delays")
        out.append(WorldEvent(
            title=f"FAA {typ}: {e.get('city', e.get('airport', '?'))} ({e.get('airport', '')})"[:240],
            summary=(e.get("reason") or "").strip()[:2000],
            category="aviation", source="faa",
            lat=e.get("lat"), lng=e.get("lng"),
            url="https://nasstatus.faa.gov",
            salience=sal.get(typ, 0.55),
            raw={},
        ))
    return out


def _edgar_events(data: dict) -> list[WorldEvent]:
    """SEC EDGAR tape → the high-conviction slice only. Insider BUYS matter (people
    sell for many reasons but buy for one), and big SELLS ($1M+) flag distribution.
    Routine grants/exercises are noise and dropped. 8-K volume becomes one rollup."""
    out: list[WorldEvent] = []
    for x in (data.get("insider") or []):
        act, val = x.get("action"), int(x.get("value") or 0)
        buy = act == "BUY"
        big_sell = act == "SELL" and val >= 1_000_000
        if not (buy or big_sell):
            continue
        tick = x.get("ticker") or "?"
        vm = f"${val/1e6:.1f}M" if val >= 1_000_000 else (f"${val/1e3:.0f}K" if val >= 1000 else "")
        out.append(WorldEvent(
            title=f"Insider {act.lower()}: {tick} — {x.get('owner', '')}"[:240],
            summary=(f"{x.get('company', '')} · {act} {int(x.get('shares') or 0):,} sh"
                     + (f" ({vm})" if vm else "") + " · SEC Form 4")[:2000],
            category="markets", source="sec-edgar", lat=None, lng=None,
            url=x.get("url"),
            # insider buys are the rarer, stronger tell; scale a sell by its size
            salience=(0.72 if buy else min(0.8, 0.55 + val / 20_000_000)),
            raw={},
        ))
    events = data.get("events") or []
    if events:
        names = ", ".join(e.get("company", "") for e in events[:6] if e.get("company"))
        out.append(WorldEvent(
            title=f"Material events: {len(events)} 8-K filings on the tape"[:240],
            summary=(f"Recent 8-Ks (material corporate events): {names}"
                     + ("…" if len(events) > 6 else ""))[:2000],
            category="markets", source="sec-edgar", lat=None, lng=None,
            url="https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=8-K",
            salience=0.4, raw={},
        ))
    return out


def _geohazards_events(data: dict) -> list[WorldEvent]:
    """Volcanoes + tsunamis → located natural-hazard events. Volcano salience tracks
    the aviation color code (red > orange > yellow); tsunami salience tracks the
    message level (warning > advisory > watch), with plain info statements dropped."""
    out: list[WorldEvent] = []
    vcol = {"RED": 0.92, "ORANGE": 0.75, "YELLOW": 0.55, "GREEN": 0.3}
    for v in (data.get("volcanoes") or []):
        out.append(WorldEvent(
            title=f"Volcano {v.get('color', '')}/{v.get('level', '')}: {v.get('name', '')}"[:240],
            summary=(f"{v.get('name', '')} — aviation color {v.get('color', '')}, alert {v.get('level', '')} "
                     f"({v.get('observatory', '')}). USGS elevated volcano notice.")[:2000],
            category="disaster", source="geohazards", lat=v.get("lat"), lng=v.get("lng"),
            url=v.get("url"), salience=vcol.get(v.get("color", ""), 0.5), raw={},
        ))
    tlev = {"WARNING": 0.95, "ADVISORY": 0.72, "WATCH": 0.6}
    for t in (data.get("tsunamis") or []):
        lvl = t.get("level", "")
        if lvl == "INFORMATION":
            continue  # routine "no tsunami threat" statements are noise
        out.append(WorldEvent(
            title=f"Tsunami {lvl}: {t.get('title', '')}"[:240],
            summary=(f"NOAA Tsunami Warning Center — {t.get('title', '')} (issued {t.get('issued', '')}).")[:2000],
            category="disaster", source="geohazards", lat=None, lng=None,
            url=t.get("url"), salience=tlev.get(lvl, 0.5), raw={},
        ))
    return out


def _ofac_events(data: dict) -> list[WorldEvent]:
    """OFAC recent actions → geopolitical/markets signal. A new designation names the
    countries, entities and sectors the US just sanctioned; de-listings and licenses
    matter less. Coordless — the value is the named target, not a place."""
    sal = {"DESIGNATION": 0.66, "REMOVAL": 0.52, "LICENSE": 0.42, "GUIDANCE": 0.32, "ACTION": 0.45}
    out: list[WorldEvent] = []
    for a in (data.get("actions") or [])[:12]:
        out.append(WorldEvent(
            title=f"OFAC {a.get('kind', '')}: {a.get('title', '')}"[:240],
            summary=(f"US Treasury OFAC — {a.get('title', '')} ({a.get('date', '')}).")[:2000],
            category="geopolitical", source="ofac", lat=None, lng=None,
            url=a.get("url"), salience=sal.get(a.get("kind", ""), 0.45), raw={},
        ))
    return out


def _planet_vitals_events(data: dict) -> list[WorldEvent]:
    """Atmospheric CO₂ + global temperature anomaly → chronic 'environment' signals that
    keep the Climate & Environment pillar honest about the long-run trend."""
    out: list[WorldEvent] = []
    c = data.get("co2")
    if c and c.get("ppm"):
        yoy = c.get("yoy")
        out.append(WorldEvent(
            title=f"Atmospheric CO₂: {c['ppm']} ppm" + (f" (+{yoy}/yr)" if yoy else ""),
            summary=(f"NOAA Mauna Loa global CO₂ trend {c['ppm']} ppm as of {c.get('date', '')}"
                     + (f", up {yoy} ppm year-on-year." if yoy else ".")
                     + " Pre-industrial baseline ~280 ppm.")[:2000],
            category="environment", source="planet-vitals", lat=None, lng=None,
            url="https://gml.noaa.gov/ccgg/trends/", salience=0.5, raw={},
        ))
    t = data.get("temp")
    if t and t.get("anomaly") is not None:
        a = float(t["anomaly"])
        out.append(WorldEvent(
            title=f"Global temp anomaly: {a:+.2f}°C ({t.get('month', '')})",
            summary=(f"NASA GISTEMP global surface temperature {a:+.2f}°C vs the 1951–1980 "
                     f"baseline for {t.get('month', '')}. The 1.5°C guardrail is a monthly "
                     f"anomaly around +1.5.")[:2000],
            category="environment", source="planet-vitals", lat=None, lng=None,
            url="https://data.giss.nasa.gov/gistemp/",
            salience=round(min(0.75, 0.35 + max(0.0, a) * 0.22), 3),   # hotter = louder
            raw={},
        ))
    return out


def _flights_events(data: dict) -> list[WorldEvent]:
    """Air picture → a military-activity summary (visibility only) plus GPS-jamming
    zones, which ARE a security signal (jamming clusters near conflict)."""
    out: list[WorldEvent] = []
    mil = data.get("military_flights") or []
    if mil:
        out.append(WorldEvent(
            title=f"Military air activity: {len(mil)} military aircraft airborne",
            summary=f"{len(mil)} military aircraft currently tracked worldwide (ADS-B).",
            category="movement", source="flights", lat=None, lng=None,
            salience=round(min(0.58, 0.30 + len(mil) / 700), 3), raw={}))  # surge = louder
    for j in (data.get("gps_jamming") or [])[:12]:
        out.append(WorldEvent(
            title=f"GPS jamming: {j.get('region') or j.get('name') or 'zone'}"[:240],
            summary="GPS/GNSS interference detected — often co-located with conflict or exercises.",
            category="conflict", source="gps-jamming", lat=j.get("lat"), lng=j.get("lng"),
            url="https://gpsjam.org", salience=0.72, raw={}))
    return out


def _maritime_events(data: dict) -> list[WorldEvent]:
    """Sea chokepoints + port congestion → geopolitical/economic signal (a strained
    Hormuz or Suez, or a badly congested port, ripples through everything)."""
    out: list[WorldEvent] = []
    crisk = {"CRITICAL": 0.82, "HIGH": 0.62, "ELEVATED": 0.5}
    for c in (data.get("chokepoints") or []):
        if c.get("risk") in crisk:
            out.append(WorldEvent(
                title=f"Chokepoint {c.get('risk')}: {c.get('name', '')}"[:240],
                summary=f"{c.get('name', '')} — {c.get('traffic', '')}. Maritime chokepoint at elevated risk.",
                category="geopolitical", source="maritime", lat=c.get("lat"), lng=c.get("lng"),
                salience=crisk[c["risk"]], raw={}))
    for p in (data.get("ports") or []):
        if p.get("congestion") in ("SEVERE", "CONGESTED"):
            out.append(WorldEvent(
                title=f"Port {p.get('congestion')}: {p.get('name', '')}"[:240],
                summary=f"{p.get('name', '')} ({p.get('country', '')}) — dwell {p.get('dwell_time', '?')}.",
                category="economy", source="maritime", lat=p.get("lat"), lng=p.get("lng"),
                salience=0.6 if p["congestion"] == "SEVERE" else 0.48, raw={}))
    return out[:12]


def _radiation_events(data: dict) -> list[WorldEvent]:
    """Radiation monitors → only the elevated ones matter (a spike can mean a nuclear
    incident); routine background is skipped."""
    sal = {"DANGER": 0.88, "WARNING": 0.66}
    out: list[WorldEvent] = []
    for s in (data.get("stations") or []):
        if s.get("status") in sal:
            out.append(WorldEvent(
                title=f"Radiation {s.get('status')}: {s.get('name', '')} — {s.get('reading', '?')} nSv/h"[:240],
                summary=f"{s.get('network', 'monitor')} sensor reading {s.get('reading', '?')} nSv/h ({s.get('status')}).",
                category="environment", source="radiation", lat=s.get("lat"), lng=s.get("lng"),
                salience=sal[s["status"]], raw={}))
    return out[:10]


def _satellites_events(data: dict) -> list[WorldEvent]:
    """Orbital picture → one visibility summary (not a health signal, so category 'space'
    is outside the score's pillars)."""
    total = data.get("total") or 0
    if not total:
        return []
    cc = data.get("category_counts") or {}
    return [WorldEvent(
        title=f"Orbital tracking: {total:,} objects ({cc.get('military', 0)} military/intel)",
        summary=(f"{total:,} tracked objects — {cc.get('comms', 0)} comms, {cc.get('navigation', 0)} nav, "
                 f"{cc.get('earth_obs', 0)} earth-obs, {cc.get('military', 0)} military/intel.")[:2000],
        category="space", source="satellites", lat=None, lng=None, salience=0.3, raw={})]


def _balloons_events(data: dict) -> list[WorldEvent]:
    """Upper-air balloons/radiosondes → one visibility summary (category 'movement',
    outside the score)."""
    n = data.get("total") or len(data.get("balloons") or [])
    if not n:
        return []
    return [WorldEvent(
        title=f"Upper-air: {n} weather balloons / radiosondes aloft",
        summary=f"{n} active radiosondes reporting upper-air observations (SondeHub).",
        category="movement", source="balloons", lat=None, lng=None, salience=0.25, raw={})]


def _hackernews_events(data: dict) -> list[WorldEvent]:
    """Hacker News front page → tech attention pulse (coordless). One rollup of what the
    builder world is fixated on, plus any breakout story as its own low-salience signal."""
    stories = data.get("stories") or []
    if not stories:
        return []
    out: list[WorldEvent] = []
    top = "; ".join(s.get("title", "") for s in stories[:5])
    out.append(WorldEvent(
        title=f"Tech pulse: {stories[0].get('title', '')}"[:240],
        summary=(f"Hacker News front page — top: {top}.")[:2000],
        category="attention", source="hackernews", lat=None, lng=None,
        url="https://news.ycombinator.com", salience=0.34, raw={},
    ))
    return out


def _climate_events(data: dict) -> list[WorldEvent]:
    """Climate dials → seasonal context. ENSO phase steers global weather (and grain,
    energy, insurance risk) months ahead; US drought coverage drives water, ag and
    wildfire outlooks. Non-neutral ENSO and wide severe-drought coverage carry weight."""
    out: list[WorldEvent] = []
    e = data.get("enso")
    if e:
        ph = e.get("phase", "Neutral")
        oni = e.get("oni", 0) or 0
        trend = e.get("trend", 0) or 0
        arrow = "strengthening" if trend > 0.05 else ("weakening" if trend < -0.05 else "steady")
        strong = "Strong" in ph
        out.append(WorldEvent(
            title=f"ENSO: {ph} (ONI {oni:+.2f}, {arrow})"[:240],
            summary=(f"NOAA CPC Oceanic Niño Index {oni:+.2f} for {e.get('season', '')} — "
                     f"{ph}, {arrow}. ENSO phase steers seasonal weather, grain and energy risk worldwide.")[:2000],
            category="climate", source="climate", lat=None, lng=None,
            url="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/ensostuff/ONI_v5.php",
            salience=round(min(0.75, (0.62 if strong else 0.5 if ph != "Neutral" else 0.38) + abs(trend) * 0.2), 3),
            raw={},
        ))
    d = data.get("drought")
    if d:
        any_d = d.get("anyDrought", 0) or 0
        sev = d.get("severePlus", 0) or 0
        ext = d.get("extremePlus", 0) or 0
        out.append(WorldEvent(
            title=f"US drought: {any_d:.0f}% of CONUS, {sev:.0f}% severe+"[:240],
            summary=(f"US Drought Monitor as of {d.get('asOf', '')}: {any_d:.0f}% of the "
                     f"Lower 48 in drought (D0+), {sev:.0f}% severe or worse (D2+), "
                     f"{ext:.0f}% extreme+ (D3+). Drives water, crop and wildfire outlooks.")[:2000],
            category="climate", source="climate", lat=None, lng=None,
            url="https://droughtmonitor.unl.edu",
            salience=round(min(0.72, 0.38 + (sev / 100) * 0.3 + (ext / 100) * 0.15), 3),
            raw={},
        ))
    return out


def _wastewater_events(data: dict) -> list[WorldEvent]:
    """CDC wastewater surveillance → disease early warning (leads clinical cases ~1–2wk).
    Honest about the reporting date: if CDC's series is lagging, salience is capped low so
    the oracle treats a stale reading as context, not a live signal."""
    nat = data.get("national")
    if not nat:
        return []
    as_of = data.get("as_of") or data.get("asOf") or ""
    stale_days = 999.0
    try:
        import time as _t
        from .models import now_ms as _now
        as_ms = _t.mktime(_t.strptime(as_of[:10], "%Y-%m-%d")) * 1000
        stale_days = (_now() - as_ms) / 86_400_000
    except (ValueError, TypeError):
        pass
    fresh = stale_days <= 21
    pctile = nat.get("percentile", 0) or 0
    rising = nat.get("risingPct", 0) or 0
    top = ", ".join(f"{r.get('jurisdiction')} ({r.get('percentile')})"
                    for r in (data.get("regions") or [])[:5])
    # only a fresh, elevated, rising signal earns real salience
    sal = 0.3
    if fresh:
        sal = round(min(0.78, 0.35 + (pctile / 100) * 0.3 + (rising / 100) * 0.15), 3)
    return [WorldEvent(
        title=(f"Wastewater viral activity {pctile:.0f}th pctile, {rising}% of sites rising "
               f"(CDC NWSS, as of {as_of})")[:240],
        summary=(f"CDC wastewater SARS-CoV-2 surveillance as of {as_of}: national activity "
                 f"{pctile:.0f}th percentile vs site history, {rising}% of sites trending up. "
                 f"Highest: {top}."
                 + ("" if fresh else " [CDC series lagging — treat as latest-available, not live.]"))[:2000],
        category="health", source="wastewater", lat=None, lng=None,
        url="https://www.cdc.gov/nwss/rv/COVID19-nationaltrend.html",
        salience=sal, raw={},
    )]


def _grid_events(data: dict) -> list[WorldEvent]:
    """Power grids → stress signal. A grid leaning hard on fossil peakers with high
    carbon intensity is straining to meet demand (heat/cold, industrial load); a clean,
    renewable-heavy grid has slack. Salience rises with carbon intensity and fossil share."""
    idx_boost = {"very high": 0.26, "high": 0.18, "moderate": 0.08, "low": 0.0, "very low": 0.0}
    out: list[WorldEvent] = []
    for g in (data.get("grids") or []):
        region = g.get("region", "Grid")
        fossil = g.get("fossilPct", 0) or 0
        clean = g.get("cleanPct", 0) or 0
        index = (g.get("index") or "").lower()
        inten = g.get("intensity")
        dem = g.get("demandMW")
        bits = [f"{clean}% clean", f"{fossil}% fossil"]
        if inten:
            bits.append(f"carbon {inten} gCO₂/kWh ({index})")
        if dem:
            bits.append(f"{dem/1000:.1f} GW demand")
        out.append(WorldEvent(
            title=f"{region} grid: {', '.join(bits[:2])}"[:240],
            summary=(f"{region} power grid — " + " · ".join(bits) + ".")[:2000],
            category="energy", source="grid", lat=None, lng=None,
            url="https://api.carbonintensity.org.uk" if "Britain" in region else "https://www.caiso.com/todays-outlook",
            salience=round(min(0.72, 0.36 + idx_boost.get(index, 0.0) + (fossil / 100) * 0.2), 3),
            raw={},
        ))
    return out


def _kalshi_events(data: dict) -> list[WorldEvent]:
    """Kalshi regulated event contracts → forecasting anchors (like Polymarket/Manifold).
    The yes-price is a real-money crowd probability; the most-traded, most-contested
    markets carry the most information, so weight salience by volume and closeness to a
    coin-flip (a 50/50 market is where the crowd is genuinely uncertain)."""
    out: list[WorldEvent] = []
    mkts = sorted(data.get("markets") or [], key=lambda m: m.get("volume", 0), reverse=True)
    vmax = max((m.get("volume", 0) for m in mkts[:25]), default=0) or 1
    for m in mkts[:25]:
        prob = float(m.get("prob") or 0)
        contested = 1 - abs(prob - 0.5) * 2          # 1 at 50/50, 0 at the extremes
        vshare = (m.get("volume", 0) or 0) / vmax
        out.append(WorldEvent(
            title=f"Kalshi {round(prob*100)}%: {m.get('question', '')}"[:240],
            summary=(f"[{m.get('category', 'market')}] Regulated crowd odds {round(prob*100)}% "
                     f"· closes {m.get('close', '')}. Real-money forecast anchor.")[:2000],
            category="market-odds", source="kalshi", lat=None, lng=None,
            url=m.get("url"),
            salience=round(min(0.8, 0.42 + 0.25 * vshare + 0.13 * contested), 3),
            raw={},
        ))
    return out


def _usaspending_events(data: dict) -> list[WorldEvent]:
    """Federal money → light context for the oracle. The top-by-amount awards are
    mostly recurring lab/IDV ceilings (not fresh news), so this is a single low-salience
    summary of where federal contract dollars and open opportunities are flowing —
    the browsable detail lives in the Contracts window, not the world brief."""
    aw = data.get("awarded") or []
    op = data.get("open") or []
    if not aw and not op:
        return []
    top = ", ".join(f"{a.get('recipient', '')[:28]} ({a.get('agency', '')[:18]})"
                    for a in aw[:5] if a.get("recipient"))
    return [WorldEvent(
        title=f"Federal contracts: {len(aw)} recent awards · {len(op)} open opportunities"[:240],
        summary=(f"Largest recent federal awards — {top}. "
                 f"{len(op)} open funding opportunities (Grants.gov).")[:2000],
        category="economy", source="usaspending", lat=None, lng=None,
        url="https://www.usaspending.gov", salience=0.42, raw={},
    )]


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
            async with httpx.AsyncClient(verify=HTTPX_VERIFY, timeout=5) as c:
                r = await c.get(f"{self.base}/api/health")
                return r.status_code < 500
        except Exception:  # noqa: BLE001 — health is a status dot; never raise
            return False

    async def _fetch_feed(self, c: httpx.AsyncClient, path: str, source: str, category: str) -> list[WorldEvent]:
        out: list[WorldEvent] = []
        try:
            # generous: Next.js compiles each route on first hit (cold start), and a few
            # feeds (e.g. /api/unrest aggregates many GDELT files) are slow until cached.
            # 15s cap: feeds run concurrently, so the cycle is bounded by the slowest
            # one. Capping keeps a single slow/hanging upstream from stalling the whole
            # sensing pass (and thus keeps STATE.events fresh for the agents).
            r = await c.get(f"{self.base}{path}", timeout=15)
            if r.status_code < 400:
                data = r.json()
                if source in ("markets", "crypto"):
                    out.extend(_markets_events(data, source))
                elif source == "risk":
                    out.extend(_country_risk_events(data))
                elif source == "futures":
                    out.extend(_futures_events(data))
                elif source == "gdacs":
                    out.extend(_gdacs_events(data))
                elif source == "nhc":
                    out.extend(_hurricane_events(data))
                elif source == "glofas":
                    out.extend(_flood_outlook_events(data))
                elif source == "wikipedia":
                    out.extend(_wiki_events(data))
                elif source == "ioda":
                    out.extend(_ioda_events(data))
                elif source == "swpc":
                    out.extend(_space_weather_events(data))
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
                elif source == "cisa-kev":
                    out.extend(_kev_events(data))
                elif source == "faa":
                    out.extend(_faa_events(data))
                elif source == "sec-edgar":
                    out.extend(_edgar_events(data))
                elif source == "usaspending":
                    out.extend(_usaspending_events(data))
                elif source == "kalshi":
                    out.extend(_kalshi_events(data))
                elif source == "grid":
                    out.extend(_grid_events(data))
                elif source == "wastewater":
                    out.extend(_wastewater_events(data))
                elif source == "climate":
                    out.extend(_climate_events(data))
                elif source == "geohazards":
                    out.extend(_geohazards_events(data))
                elif source == "ofac":
                    out.extend(_ofac_events(data))
                elif source == "hackernews":
                    out.extend(_hackernews_events(data))
                elif source == "planet-vitals":
                    out.extend(_planet_vitals_events(data))
                elif source == "flights":
                    out.extend(_flights_events(data))
                elif source == "maritime":
                    out.extend(_maritime_events(data))
                elif source == "radiation":
                    out.extend(_radiation_events(data))
                elif source == "satellites":
                    out.extend(_satellites_events(data))
                elif source == "balloons":
                    out.extend(_balloons_events(data))
                elif source == "hungermap":
                    out.extend(_summary_signal(data, "hungermap", "food", "Food insecurity — worst-hit"))
                elif source == "wb-unemployment":
                    out.extend(_summary_signal(data, "wb-unemployment", "economy", "Unemployment — highest"))
                elif source == "wb-gdp":
                    out.extend(_summary_signal(data, "wb-gdp", "economy", "GDP growth — weakest economies"))
                elif source == "wb-poverty":
                    out.extend(_summary_signal(data, "wb-poverty", "economy", "Extreme poverty — highest"))
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
        async with httpx.AsyncClient(verify=HTTPX_VERIFY, timeout=25) as c:
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
