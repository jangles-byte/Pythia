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


async def _ask(oracle, name: str, lens: str, brief_text: str,
               preds: list[Prediction]) -> tuple[str, dict[int, tuple[float, str]]]:
    """Run one persona; return its {prediction_index: (probability, note)} map."""
    try:
        text = await oracle._complete(_persona_messages(name, lens, brief_text, preds), max_tokens=1300)
    except Exception as e:  # noqa: BLE001
        log.warning("swarm persona %s failed: %s", name, e)
        return name, {}
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
        if not 0 <= i < len(preds):
            continue
        p = max(0.0, min(1.0, p / 100.0 if p > 1 else p))
        scored[i] = (round(p, 2), str(o.get("note", "")).strip()[:320])
    return name, scored


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

    enriched = 0
    for idx, pred in enumerate(subset):
        views = [AgentView(name=name, probability=scored[idx][0], note=scored[idx][1])
                 for name, scored in results if idx in scored]
        if not views:
            continue
        pred.agents = views
        ps = [v.probability for v in views]
        if len(ps) >= 2:   # only let the council override the oracle when there's a real quorum
            pred.base_probability = pred.probability
            pred.probability = round(sum(ps) / len(ps), 2)   # consensus = mean of the council
            pred.split = (max(ps) - min(ps)) >= _SPLIT_SPREAD
        enriched += 1
    log.info("swarm deliberated %d/%d forecasts across %d personas", enriched, len(subset), len(PERSONAS))
    return predictions
