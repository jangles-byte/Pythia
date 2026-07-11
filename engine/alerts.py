"""Custom alert rules — PYTHIA taps you on the shoulder.

Users define rules over everything the engine already watches; an evaluator pass
(every ALERT_INTERVAL_SEC) checks them and fires alerts into a feed the UI polls
for browser notifications — and to every registered webhook. Rules persist in
runs/alerts.json, the fired feed in runs/alert_feed.json (bounded).

Rule kinds and their params:
  event      {keywords, domain?, min_salience}   fresh world events matching terms
  quake      {min_magnitude}                     seismic events at/above magnitude
  market     {symbol, move_percent}              |day move| of a symbol crosses bar
  vix        {level}                             ^VIX at/above level
  forecast   {min_probability, horizon?, keywords?}  new oracle forecast crosses bar
  odds_swing {min_move}                          a Polymarket/Manifold question moves that much
"""
from __future__ import annotations

import asyncio
import json
import logging
import re
import uuid

import httpx

from .config import CONFIG, HTTPX_VERIFY
from .models import now_ms
from .state import STATE

log = logging.getLogger("pythia.alerts")

_RULES_PATH = CONFIG.runs_dir / "alerts.json"
_FEED_PATH = CONFIG.runs_dir / "alert_feed.json"
_FEED_MAX = 200
_MAG_RX = re.compile(r"\bM\s?(\d+(?:\.\d+)?)\b", re.I)

KINDS = ("event", "quake", "market", "vix", "forecast", "odds_swing")
_ODDS_RX = re.compile(r"crowd odds:\s*(\d{1,3})%\s*YES", re.I)
_odds_last: dict[str, float] = {}       # question -> last seen probability


def _load(path, default):
    try:
        data = json.loads(path.read_text())
        return data if isinstance(data, list) else default
    except (OSError, ValueError):
        return default


RULES: list[dict] = _load(_RULES_PATH, [])
FEED: list[dict] = _load(_FEED_PATH, [])

_seen_events: set[str] = set()          # event titles already alerted (per rule id prefix)
_seen_forecasts: set[str] = set()       # forecast ids already alerted
_last_fired: dict[str, int] = {}        # rule id -> ts of last fire (cooldowns)


def _save_rules() -> None:
    try:
        _RULES_PATH.write_text(json.dumps(RULES, indent=1))
    except OSError as e:
        log.warning("alert rules save failed: %s", e)


def _save_feed() -> None:
    try:
        _FEED_PATH.write_text(json.dumps(FEED[-_FEED_MAX:], indent=1))
    except OSError:
        pass


def upsert_rule(payload: dict) -> dict:
    kind = str(payload.get("kind", "")).lower()
    if kind not in KINDS:
        raise ValueError(f"kind must be one of {KINDS}")
    rule = {
        "id": str(payload.get("id") or uuid.uuid4().hex[:10]),
        "name": str(payload.get("name") or kind)[:80],
        "kind": kind,
        "params": dict(payload.get("params") or {}),
        "enabled": bool(payload.get("enabled", True)),
        "cooldown_sec": max(60, int(payload.get("cooldown_sec", 1800))),
        "created_ms": int(payload.get("created_ms") or now_ms()),
    }
    global RULES
    RULES = [r for r in RULES if r["id"] != rule["id"]] + [rule]
    _save_rules()
    return rule


def remove_rule(rule_id: str) -> bool:
    global RULES
    before = len(RULES)
    RULES = [r for r in RULES if r["id"] != rule_id]
    if len(RULES) != before:
        _save_rules()
    return len(RULES) != before


def push_external(kind: str, title: str, body: str) -> None:
    """Non-rule producers (the Morning Brief) drop items into the same feed the
    UI polls for browser notifications."""
    item = {"id": uuid.uuid4().hex[:10], "rule_id": "", "rule_name": kind,
            "kind": kind, "ts": now_ms(), "title": title[:180], "body": body[:400],
            "lat": None, "lng": None}
    FEED.append(item)
    del FEED[:-_FEED_MAX]
    _save_feed()
    STATE.publish("alert", item)


def _fire(rule: dict, title: str, body: str, lat=None, lng=None) -> None:
    item = {
        "id": uuid.uuid4().hex[:10], "rule_id": rule["id"], "rule_name": rule["name"],
        "kind": rule["kind"], "ts": now_ms(), "title": title[:180], "body": body[:400],
        "lat": lat, "lng": lng,
    }
    FEED.append(item)
    del FEED[:-_FEED_MAX]
    _save_feed()
    _last_fired[rule["id"]] = item["ts"]
    STATE.publish("alert", item)
    from . import webhooks
    webhooks.fire_alerts([item])
    log.info("alert fired [%s] %s", rule["name"], title[:80])


def _cooled(rule: dict) -> bool:
    return now_ms() - _last_fired.get(rule["id"], 0) >= rule["cooldown_sec"] * 1000


def _terms(s: str) -> list[str]:
    return [t.strip().lower() for t in (s or "").split(",") if t.strip()]


async def _quotes(symbols: list[str]) -> dict:
    """Price symbols through the UI's keyless quote route (60s-cached there)."""
    if not symbols:
        return {}
    try:
        async with httpx.AsyncClient(verify=HTTPX_VERIFY, timeout=15) as c:
            r = await c.get(f"{CONFIG.osiris_url}/api/quotes", params={"symbols": ",".join(symbols)})
            r.raise_for_status()
            return r.json().get("quotes", {}) or {}
    except Exception as e:  # noqa: BLE001 — quotes down just skips market rules this pass
        log.debug("alert quotes fetch failed: %s", e)
        return {}


async def evaluate() -> int:
    """One evaluator pass over every enabled rule. Returns alerts fired."""
    global _seen_events, _seen_forecasts
    active = [r for r in RULES if r.get("enabled")]
    if not active:
        return 0
    fired = 0
    events = STATE.events or []
    preds = STATE.predictions or []

    # one quote fetch covers every market/vix rule this pass
    need = {str(r["params"].get("symbol", "")).upper() for r in active if r["kind"] == "market"}
    if any(r["kind"] == "vix" for r in active):
        need.add("^VIX")
    quotes = await _quotes(sorted(s for s in need if s))

    for rule in active:
        k, p = rule["kind"], rule["params"]
        try:
            if k in ("event", "quake"):
                terms = _terms(p.get("keywords", "")) if k == "event" else []
                dom = str(p.get("domain", "")).lower()
                min_sal = float(p.get("min_salience", 0.6)) if k == "event" else 0.0
                min_mag = float(p.get("min_magnitude", 5.5)) if k == "quake" else None
                for e in events:
                    key = f"{rule['id']}:{e.title}"
                    if key in _seen_events:
                        continue
                    text = f"{e.title} {getattr(e, 'summary', '')}".lower()
                    if k == "quake":
                        if getattr(e, "category", "") not in ("seismic", "earthquake") and "earthquake" not in text:
                            continue
                        m = _MAG_RX.search(e.title)
                        if not m or float(m.group(1)) < min_mag:
                            continue
                    else:
                        if dom and dom not in str(getattr(e, "category", "")).lower():
                            continue
                        if e.salience < min_sal:
                            continue
                        if terms and not any(t in text for t in terms):
                            continue
                    _seen_events.add(key)
                    _fire(rule, e.title, f"{getattr(e, 'category', '')} · {getattr(e, 'source', '')} · salience {e.salience:.2f}",
                          getattr(e, "lat", None), getattr(e, "lng", None))
                    fired += 1

            elif k == "market" and _cooled(rule):
                sym = str(p.get("symbol", "")).upper()
                q = quotes.get(sym)
                bar = abs(float(p.get("move_percent", 3.0)))
                if q and abs(q.get("change_percent", 0)) >= bar:
                    _fire(rule, f"{sym} {q['change_percent']:+.2f}% on the day",
                          f"price {q['price']} — crossed your ±{bar}% bar")
                    fired += 1

            elif k == "vix" and _cooled(rule):
                q = quotes.get("^VIX")
                level = float(p.get("level", 25))
                if q and q.get("price", 0) >= level:
                    _fire(rule, f"VIX at {q['price']:.1f}", f"at/above your {level} bar — equity markets pricing turmoil")
                    fired += 1

            elif k == "odds_swing":
                min_move = abs(float(p.get("min_move", 0.10)))
                for e in events:
                    if getattr(e, "category", "") != "market-odds":
                        continue
                    m = _ODDS_RX.search(getattr(e, "summary", "") or "")
                    if not m:
                        continue
                    prob = int(m.group(1)) / 100.0
                    q = e.title[:120]
                    last = _odds_last.get(q)
                    _odds_last[q] = prob
                    if last is not None and abs(prob - last) >= min_move:
                        _fire(rule, f"Crowd odds swing: {q}",
                              f"{int(last * 100)}% → {int(prob * 100)}% YES ({(prob - last) * 100:+.0f}pts) · {getattr(e, 'source', '')}")
                        fired += 1

            elif k == "forecast":
                bar = float(p.get("min_probability", 0.85))
                hz = str(p.get("horizon", "")).lower()
                terms = _terms(p.get("keywords", ""))
                for f in preds:
                    fid = getattr(f, "id", "")
                    if not fid or f"{rule['id']}:{fid}" in _seen_forecasts:
                        continue
                    if f.probability < bar or (hz and f.horizon != hz):
                        continue
                    if terms and not any(t in f.statement.lower() for t in terms):
                        continue
                    _seen_forecasts.add(f"{rule['id']}:{fid}")
                    _fire(rule, f"{int(f.probability * 100)}% [{f.horizon}] {f.statement}",
                          getattr(f, "reasoning", "") or "new oracle forecast crossed your bar",
                          getattr(f, "lat", None), getattr(f, "lng", None))
                    fired += 1
        except Exception as e:  # noqa: BLE001 — one bad rule must not sink the pass
            log.warning("alert rule %s failed: %s", rule.get("name"), e)

    # keep dedupe sets bounded
    if len(_seen_events) > 8000:
        _seen_events = set(list(_seen_events)[-4000:])
    if len(_seen_forecasts) > 4000:
        _seen_forecasts = set(list(_seen_forecasts)[-2000:])
    return fired
