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

from .config import CONFIG
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
        f"Your expertise is {lens} — use it as your evidence base and blind spot check. "
        f"You will be given a live world snapshot and a numbered list of candidate predictions. "
        f"For EACH prediction, estimate the probability (0-100) that THE EVENT ACTUALLY HAPPENS "
        f"within its horizon — NOT how relevant it is to your domain. A storm you can't assess "
        f"geopolitically is still likely if the weather data says so; defer to the evidence, then "
        f"sharpen with what your lens uniquely sees. Make your case in your own voice: 1-2 sentences "
        f"citing the specific signals (or absences) that drive your number. "
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
                                          max_tokens=CONFIG.swarm_max_tokens, model=persona_model)
        except Exception as e:  # noqa: BLE001 — a transient local-model hiccup shouldn't drop the voice
            log.warning("swarm persona %s (%s) errored (%s: %r) — %s", name, used_model,
                        type(e).__name__, str(e),
                        "retrying compacted" if brief_cap == 2600 else "giving up this pass")
            continue          # retry with the smaller brief instead of losing the persona
        scored = _parse_scored(oracle, text, len(preds))
        if scored:
            return name, used_model, scored
        log.warning("swarm persona %s (%s): no votes parsed from %d chars (%r) — %s",
                    name, used_model, len(text), text[:80],
                    "retrying with a compacted brief" if brief_cap == 2600 else "giving up this pass")
    return name, used_model, {}


async def deliberate(oracle, brief: WorldBrief | None, predictions: list[Prediction],
                     on_stage=None, personas: list[str] | None = None,
                     context: str = "forecast") -> list[Prediction]:
    """Have the persona council weigh in; enrich each prediction with agent votes,
    a consensus probability, and a `split` flag when they disagree sharply.

    `personas` optionally restricts the council to a subset of persona names (the
    what-if field lets the user check which voices deliberate); None = the full council.
    Progress is streamed into STATE.deliberation voice-by-voice so the UI can watch
    the argument happen live."""
    if not predictions:
        return predictions
    active = PERSONAS if personas is None else [(n, l) for n, l in PERSONAS if n in personas]
    if not active:                      # user unchecked everyone — skip the council this pass
        return predictions
    subset = predictions[:_MAX_PREDS]
    if on_stage:
        await on_stage("deliberating", f"swarm of {len(active)} weighing {len(subset)} forecasts")
    brief_text = brief.text if brief else ""

    # live chamber state — every voice starts "voting", flips to "done"/"silent" as it lands
    import time as _t
    delib: dict = {
        "ts": int(_t.time() * 1000), "active": True, "context": context,
        "statements": [{"statement": p.statement[:140], "horizon": p.horizon} for p in subset],
        "voices": {n: {"model": STATE.swarm_models.get(n) or oracle.model,
                       "status": "voting", "votes": [], "elapsed_ms": None}
                   for n, _ in active},
    }
    STATE.set_deliberation(dict(delib))

    # One heavy local model can't serve 4 personas at once — fire them off in bounded
    # batches (default 1 = sequential) so nobody times out and every voice actually lands.
    sem = asyncio.Semaphore(max(1, CONFIG.swarm_concurrency))

    async def _voice(n: str, l: str):
        async with sem:
            t0 = _t.time()
            name, used, scored = await _ask(oracle, n, l, brief_text, subset)
            delib["voices"][n] = {
                "model": used, "status": "done" if scored else "silent",
                "votes": [{"i": i, "p": p, "note": note} for i, (p, note) in sorted(scored.items())],
                "elapsed_ms": int((_t.time() - t0) * 1000),
            }
            STATE.set_deliberation(dict(delib))
            return name, used, scored

    results = await asyncio.gather(*[_voice(n, l) for n, l in active])

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
        # The headline number IS the council's consensus of the voices shown — so it can
        # never disagree with them (a 90% headline over a lone 85% vote made no sense).
        # Keep the oracle's own estimate as base_probability for the "oracle → council" delta.
        pred.base_probability = pred.probability
        ws = [weights.get(v.name, 1.0) for v in views]
        pred.probability = round(sum(w * p for w, p in zip(ws, ps)) / sum(ws), 2)
        pred.split = (max(ps) - min(ps)) >= _SPLIT_SPREAD
        enriched += 1
    delib["active"] = False
    delib["consensus"] = [{"i": i, "p": p.probability, "base": p.base_probability, "split": p.split}
                          for i, p in enumerate(subset)]
    STATE.set_deliberation(dict(delib))
    log.info("swarm deliberated %d/%d forecasts across %d personas", enriched, len(subset), len(active))
    return predictions
