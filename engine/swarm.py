"""PYTHIA swarm — a small council of LLM personas deliberates each forecast.

Revives MiroFish's swarm-intelligence idea locally: instead of one model voice,
several specialist agents weigh in from different lenses, and we surface their
consensus *and* their dissent. No Zep, no cloud — just the local model wearing
several hats, run concurrently.
"""
from __future__ import annotations

import asyncio
import json
import logging

from .models import AgentView, Prediction, WorldBrief
from .state import STATE

log = logging.getLogger("pythia.swarm")

# name -> the lens this persona judges the future through
PERSONAS: list[tuple[str, str]] = [
    ("Strategist", "geopolitics, armed conflict, diplomacy, security and the moves of state actors"),
    ("Economist", "markets, energy, commodities, trade and the macro economy"),
    ("Naturalist", "natural disasters, seismic activity, severe weather, climate and public health"),
    ("Skeptic", "base rates and the null hypothesis — things usually continue as they are, so you "
                "discount hype, momentum and over-confidence and ask what would have to be true"),
]

_MAX_PREDS = 16           # how many forecasts to put before the swarm per pass
_SPLIT_SPREAD = 0.30      # max-min probability gap that counts as real disagreement
_MIN_TRACK = 5            # resolved forecasts a persona needs before its record moves its weight


def _persona_weights() -> dict[str, float]:
    """The swarm learns: weight each persona's vote by its resolved-forecast Brier.
    1.0 = coin-flip performance (or no track record yet); better records count for
    more, worse for less. Clamped so no voice ever dominates or vanishes."""
    try:
        from .runtime import ledger
        stats = ledger.scorecard().get("personas", {})
    except Exception:  # noqa: BLE001 — weighting is a bonus, never a blocker
        return {}
    out: dict[str, float] = {}
    for name, s in stats.items():
        if s.get("resolved", 0) >= _MIN_TRACK and s.get("brier") is not None:
            # brier 0.25 (coin-flip) -> 1.0, 0.10 -> 1.75, 0.50 -> 0.58
            out[name] = max(0.4, min(2.5, (0.25 + 0.10) / (s["brier"] + 0.10)))
    return out


def _persona_messages(name: str, lens: str, brief_text: str, preds: list[Prediction]) -> list[dict]:
    listing = "\n".join(f"{i}. [{p.horizon}] {p.statement}" for i, p in enumerate(preds))
    system = (
        f"You are the {name}, one specialist on PYTHIA's forecasting swarm. "
        f"You judge the future strictly through the lens of {lens}. "
        f"You will be given a live world snapshot and a numbered list of candidate predictions. "
        f"For EACH prediction give your OWN probability (0-100) and make your case in your own voice: "
        f"1-2 sentences citing the specific signals (or absences) that drive your view, from your lens. "
        f'Return ONLY a JSON array, one object per prediction: '
        f'{{"i": <index>, "p": <0-100>, "note": "<your 1-2 sentence argument>"}}. No prose, no markdown.'
    )
    user = (
        f"=== LIVE WORLD SNAPSHOT ===\n{brief_text[:2600]}\n\n"
        f"=== CANDIDATE PREDICTIONS ===\n{listing}\n\n"
        f"Score every prediction from your lens. JSON array only."
    )
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def _parse_scored(oracle, text: str, n_preds: int) -> dict[int, tuple[float, str]]:
    scored: dict[int, tuple[float, str]] = {}
    for chunk in oracle._extract_objects(text):
        try:
            o = json.loads(chunk)
        except (ValueError, TypeError):
            continue
        if not isinstance(o, dict) or "i" not in o:
            continue
        try:
            i = int(o["i"])
            p = float(o.get("p", 50))
        except (TypeError, ValueError):
            continue
        if not 0 <= i < n_preds:
            continue
        p = max(0.0, min(1.0, p / 100.0 if p > 1 else p))
        scored[i] = (round(p, 2), str(o.get("note", "")).strip()[:320])
    return scored


async def _ask(oracle, name: str, lens: str, brief_text: str,
               preds: list[Prediction]) -> tuple[str, str, dict[int, tuple[float, str]]]:
    """Run one persona; return (name, model used, {prediction_index: (probability, note)})."""
    persona_model = STATE.swarm_models.get(name) or None    # per-persona override (else main model)
    used_model = persona_model or oracle.model
    # Small models can run out of context on the full brief and emit a truncated
    # (unparseable) reply — so if a pass yields zero votes, retry once compacted.
    for brief_cap in (2600, 1100):
        try:
            text = await oracle._complete(_persona_messages(name, lens, brief_text[:brief_cap], preds),
                                          max_tokens=1300, model=persona_model)
        except Exception as e:  # noqa: BLE001
            log.warning("swarm persona %s (%s) failed: %s", name, used_model, e)
            return name, used_model, {}
        scored = _parse_scored(oracle, text, len(preds))
        if scored:
            return name, used_model, scored
        log.warning("swarm persona %s (%s): no votes parsed from %d chars (%r) — %s",
                    name, used_model, len(text), text[:80],
                    "retrying with a compacted brief" if brief_cap == 2600 else "giving up this pass")
    return name, used_model, {}


async def deliberate(oracle, brief: WorldBrief | None, predictions: list[Prediction],
                     on_stage=None) -> list[Prediction]:
    """Have the persona council weigh in; enrich each prediction with agent votes,
    a consensus probability, and a `split` flag when they disagree sharply."""
    if not predictions:
        return predictions
    subset = predictions[:_MAX_PREDS]
    if on_stage:
        await on_stage("deliberating", f"swarm of {len(PERSONAS)} weighing {len(subset)} forecasts")
    brief_text = brief.text if brief else ""
    results = await asyncio.gather(*[_ask(oracle, n, l, brief_text, subset) for n, l in PERSONAS])

    weights = _persona_weights()
    if weights:
        log.info("swarm weights (Brier-earned): %s",
                 {k: round(v, 2) for k, v in weights.items()})

    enriched = 0
    for idx, pred in enumerate(subset):
        views = [AgentView(name=name, probability=scored[idx][0], note=scored[idx][1], model=used)
                 for name, used, scored in results if idx in scored]
        if not views:
            continue
        pred.agents = views
        ps = [v.probability for v in views]
        if len(ps) >= 2:   # only let the council override the oracle when there's a real quorum
            pred.base_probability = pred.probability
            ws = [weights.get(v.name, 1.0) for v in views]
            pred.probability = round(sum(w * p for w, p in zip(ws, ps)) / sum(ws), 2)
            pred.split = (max(ps) - min(ps)) >= _SPLIT_SPREAD
        enriched += 1
    log.info("swarm deliberated %d/%d forecasts across %d personas", enriched, len(subset), len(PERSONAS))
    return predictions
