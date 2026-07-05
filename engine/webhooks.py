"""Outbound webhooks — PYTHIA pushes the world to you.

Register any URL and the engine POSTs JSON when something crosses your
thresholds: high-probability forecasts after each oracle pass, and fresh
high-salience world events as the sensing loop spots them. Hooks persist in
runs/webhooks.json. Fire-and-forget: a dead endpoint never slows the oracle.

Payloads:
  {"kind": "forecasts", "ts": <ms>, "forecasts": [{statement, horizon, probability, location, lat, lng, reasoning}]}
  {"kind": "events",    "ts": <ms>, "events":    [{title, category, source, salience, lat, lng}]}
"""
from __future__ import annotations

import asyncio
import json
import logging

import httpx

from .config import CONFIG, HTTPX_VERIFY
from .models import now_ms

log = logging.getLogger("pythia.webhooks")

_PATH = CONFIG.runs_dir / "webhooks.json"
_seen_titles: set[str] = set()          # events already announced (dedupe across senses)
_MAX_SEEN = 6000


def load() -> list[dict]:
    try:
        data = json.loads(_PATH.read_text())
        return [h for h in data if isinstance(h, dict) and h.get("url")] if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


HOOKS: list[dict] = load()


def _save() -> None:
    try:
        _PATH.write_text(json.dumps(HOOKS, indent=1))
    except OSError as e:
        log.warning("webhooks save failed: %s", e)


def add(url: str, min_probability: float = 0.7, min_salience: float = 0.85) -> dict:
    hook = {"url": url.strip(),
            "min_probability": max(0.0, min(1.0, float(min_probability))),
            "min_salience": max(0.0, min(1.0, float(min_salience)))}
    global HOOKS
    HOOKS = [h for h in HOOKS if h["url"] != hook["url"]] + [hook]
    _save()
    return hook


def remove(url: str) -> bool:
    global HOOKS
    before = len(HOOKS)
    HOOKS = [h for h in HOOKS if h["url"] != url.strip()]
    if len(HOOKS) != before:
        _save()
    return len(HOOKS) != before


async def _post(url: str, body: dict) -> None:
    try:
        async with httpx.AsyncClient(verify=HTTPX_VERIFY, timeout=6) as c:
            await c.post(url, json=body)
    except Exception as e:  # noqa: BLE001 — a dead endpoint is the subscriber's problem
        log.debug("webhook %s failed: %s", url, e)


def fire_forecasts(preds: list) -> None:
    """After an oracle pass: push forecasts above each hook's probability bar."""
    for hook in HOOKS:
        sel = [{"statement": p.statement, "horizon": p.horizon, "probability": p.probability,
                "location": p.location, "lat": p.lat, "lng": p.lng, "reasoning": p.reasoning}
               for p in preds if p.probability >= hook["min_probability"]]
        if sel:
            asyncio.create_task(_post(hook["url"], {"kind": "forecasts", "ts": now_ms(), "forecasts": sel}))


def fire_events(events: list) -> None:
    """After a sensing pass: push never-before-seen events above the salience bar."""
    global _seen_titles
    fresh = [e for e in events if e.title not in _seen_titles]
    _seen_titles.update(e.title for e in fresh)
    if len(_seen_titles) > _MAX_SEEN:                      # keep the dedupe set bounded
        _seen_titles = set(list(_seen_titles)[-_MAX_SEEN // 2:])
    if not fresh:
        return
    for hook in HOOKS:
        sel = [{"title": e.title, "category": e.category, "source": e.source,
                "salience": e.salience, "lat": e.lat, "lng": e.lng}
               for e in fresh if e.salience >= hook["min_salience"]]
        if sel:
            asyncio.create_task(_post(hook["url"], {"kind": "events", "ts": now_ms(), "events": sel}))
