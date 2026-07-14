"""PYTHIA Global Health Score — a single 1-100 read on the state of the planet.

Weighs *everything* the oracle intakes: every live WorldEvent is bucketed into one of
six pillars, each pillar is scored from the salience of its events (how loud, how
acute), and the pillars are blended into one global score. 100 = calm, 1 = critical.
Recomputed twice a day (00:00 and 12:00 local) by HealthScoreLoop.
"""
from __future__ import annotations

import json
import logging
import time
from pathlib import Path

from .state import STATE

log = logging.getLogger("pythia.healthscore")

_STORE = Path("runs/health_score.json")

# Six pillars → the event categories that feed each, and each pillar's weight in the
# global blend (weights sum to 1.0). Categories come from engine/osiris_intake.py.
# Meta / static categories excluded from scoring: `news` (generic headlines that already
# overlap every domain), `attention` (Wikipedia/HN meta-interest), `infrastructure`
# (static facility list). They're context, not a planetary-health domain.
PILLARS: dict[str, dict] = {
    "Conflict & Security":   {"cats": {"conflict", "geopolitical", "unrest", "cyber", "instability"}, "weight": 0.22},
    "Natural Hazards":       {"cats": {"seismic", "weather", "wildfire", "disaster", "hurricane", "flood-outlook", "aviation"}, "weight": 0.20},
    "Markets & Economy":     {"cats": {"markets", "futures", "market-odds", "economy"}, "weight": 0.18},
    "Climate & Environment": {"cats": {"climate", "air-quality", "space-weather", "energy", "environment"}, "weight": 0.14},
    "Public Health":         {"cats": {"health"}, "weight": 0.14},
    "Humanitarian & Society":{"cats": {"displacement", "food", "censorship", "outage"}, "weight": 0.12},
}


def _band(score: int) -> str:
    return ("Critical" if score < 25 else "Strained" if score < 42 else "Unsettled"
            if score < 58 else "Stable" if score < 76 else "Calm")


def _pillar_score(sals: list[float]) -> int:
    """0-100 for one pillar. A domain's health tracks its *worst active signals*, not the
    average of routine monitoring — so stress is driven by the peak (mean of the top-3
    events) plus how broadly acute (≥0.75) the domain is. Sparse pillars are pulled toward
    a mild neutral so one loud event can't tank a whole domain."""
    n = len(sals)
    if n == 0:
        return 82  # nothing notable in this domain = quietly healthy
    top = sorted(sals, reverse=True)
    peak = sum(top[:3]) / min(3, n)                 # the loudest few, not the average
    acute_share = sum(1 for s in sals if s >= 0.75) / n   # how BROADLY the domain is in crisis
    # Feed salience runs high (it means "notable"), so lean on acute breadth for the
    # dynamic range: a normal day lands ~Unsettled/Stable, broad crises drop it hard.
    stress = min(1.0, 0.40 * peak + 0.30 * acute_share)
    conf = min(1.0, n / 3)                          # trust the signal only with a few events
    stress = conf * stress + (1 - conf) * 0.25
    return max(1, min(100, round(100 * (1 - stress))))


def compute() -> dict:
    events = list(STATE.events or [])
    pillars = []
    for name, cfg in PILLARS.items():
        evs = [e for e in events if getattr(e, "category", "") in cfg["cats"]]
        sals = [float(getattr(e, "salience", 0.5) or 0.5) for e in evs]
        score = _pillar_score(sals)
        top = max(evs, key=lambda e: float(getattr(e, "salience", 0) or 0), default=None)
        driver = (getattr(top, "title", "") or "")[:100] if top else "no notable signals"
        pillars.append({"name": name, "score": score, "weight": cfg["weight"],
                        "count": len(evs), "driver": driver})

    total_w = sum(p["weight"] for p in pillars) or 1.0
    glob = max(1, min(100, round(sum(p["score"] * p["weight"] for p in pillars) / total_w)))

    out = {
        "score": glob,
        "band": _band(glob),
        "pillars": pillars,
        "event_count": len(events),
        "computed_at": time.strftime("%Y-%m-%d %H:%M"),
        "ts": int(time.time() * 1000),
        "method": "Weighted blend of six pillars; each scored from the salience & acuteness "
                  "of its live feeds. 100 = calm, 1 = critical. Updates 00:00 & 12:00 local.",
    }
    STATE.health_score = out
    try:
        _STORE.parent.mkdir(exist_ok=True)
        _STORE.write_text(json.dumps(out, indent=2))
    except OSError as e:  # noqa: BLE001
        log.debug("health score save failed: %s", e)
    log.info("global health score: %d (%s) from %d events", glob, out["band"], len(events))
    return out


def latest() -> dict | None:
    cur = getattr(STATE, "health_score", None)
    if cur:
        return cur
    try:
        return json.loads(_STORE.read_text())
    except (FileNotFoundError, ValueError):
        return None
