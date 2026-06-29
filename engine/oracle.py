"""The Oracle — feeds a world snapshot to the local LLM and gets back predictions.

Uses MiroFish's configured model (local Ollama by default), OpenAI chat format.
No Zep, no cloud, no cost.
"""
from __future__ import annotations

import json
import logging
from typing import Awaitable, Callable, Optional

import httpx

from .config import CONFIG, HTTPX_VERIFY
from .models import Prediction, WorldBrief

log = logging.getLogger("pythia.oracle")
StageCB = Optional[Callable[[str, str], Awaitable[None]]]

SYSTEM = (
    "You are PYTHIA, a forecasting oracle. You watch a live snapshot of world activity "
    "(conflicts, disasters, seismic events, geopolitics, news) and predict concrete future "
    "events. Be specific, plausible, and grounded in the snapshot. Output strictly JSON."
)

_HORIZON_LABEL = {"24h": "the next 24 hours", "week": "the next week",
                  "month": "the next month", "year": "the next year"}


def _norm_horizon(h: str) -> str:
    h = (h or "").lower()
    if "24" in h or "day" in h or "tomorrow" in h or "hour" in h:
        return "24h"
    if "week" in h:
        return "week"
    if "month" in h:
        return "month"
    if "year" in h:
        return "year"
    return "week"


class Oracle:
    def __init__(self) -> None:
        self.base = CONFIG.llm_base_url.rstrip("/")
        self.key = CONFIG.llm_api_key
        self.model = CONFIG.llm_model

    async def health(self) -> bool:
        try:
            async with httpx.AsyncClient(verify=HTTPX_VERIFY, timeout=5) as c:
                r = await c.get(f"{self.base}/models", headers={"Authorization": f"Bearer {self.key}"})
                return r.status_code < 500
        except Exception:  # noqa: BLE001 — health is a status dot; never raise
            return False

    async def list_models(self) -> list[str]:
        """Scan the LLM backend (Ollama) for installed models."""
        try:
            async with httpx.AsyncClient(verify=HTTPX_VERIFY, timeout=8) as c:
                r = await c.get(f"{self.base}/models", headers={"Authorization": f"Bearer {self.key}"})
                r.raise_for_status()
                data = r.json().get("data", [])
                names = sorted({m.get("id", "") for m in data if m.get("id")})
                # drop embedding-only models — they can't do chat completions
                return [n for n in names if n and "embed" not in n.lower()]
        except Exception:  # noqa: BLE001
            return []

    def _prompt(self, brief: WorldBrief) -> str:
        horizons = ", ".join(f'"{h}"' for h in CONFIG.horizons)
        spans = "; ".join(f"{h} = {_HORIZON_LABEL.get(h, h)}" for h in CONFIG.horizons)
        return (
            f"=== LIVE WORLD SNAPSHOT ({brief.event_count} signals) ===\n{brief.text}\n\n"
            f"Note: any [MARKET-ODDS] signals are real-money crowd probabilities from Polymarket — "
            f"treat them as strong anchors; you may sharpen or disagree with them, but stay calibrated.\n"
            f"Give {CONFIG.predictions_per_horizon} concrete predictions for EACH horizon ({spans}).\n"
            f"Return ONLY a JSON array. Each element exactly:\n"
            f'{{"statement": "<specific predicted event>", "horizon": <one of {horizons}>, '
            f'"probability": <integer 0-100>, "reasoning": "<one sentence grounded in the snapshot>", '
            f'"location": "<the place this is about, e.g. Strait of Hormuz>", '
            f'"lat": <approx latitude or null>, "lng": <approx longitude or null>}}\n'
            f"JSON array only — no markdown, no commentary."
        )

    async def predict(self, brief: WorldBrief, on_stage: StageCB = None) -> list[Prediction]:
        if on_stage:
            await on_stage("thinking", f"asking {self.model}")
        text = await self._chat(self._prompt(brief))
        preds = self._parse(text, brief.id)
        log.info("oracle produced %d predictions", len(preds))
        return preds

    async def _chat(self, user: str) -> str:
        return await self._complete([{"role": "system", "content": SYSTEM}, {"role": "user", "content": user}], 1400)

    async def _complete(self, messages: list[dict], max_tokens: int = 900) -> str:
        body = {"model": self.model, "messages": messages, "temperature": CONFIG.temperature, "max_tokens": max_tokens}
        async with httpx.AsyncClient(verify=HTTPX_VERIFY, timeout=CONFIG.request_timeout) as c:
            r = await c.post(f"{self.base}/chat/completions", json=body,
                             headers={"Authorization": f"Bearer {self.key}"})
            r.raise_for_status()
            return r.json()["choices"][0]["message"]["content"]

    async def chat(self, question: str, brief, predictions, history=None) -> str:
        """Answer a free-form question grounded in EVERY live source + current predictions."""
        parts = []
        if brief:
            parts.append(f"=== LIVE WORLD DATA — {brief.event_count} signals across {len(brief.domains)} domains ===\n{brief.text}")
        if predictions:
            parts.append("=== YOUR CURRENT PREDICTIONS ===\n" + "\n".join(
                f"- [{p.horizon}] {int(p.probability * 100)}% {p.statement}" + (f" — {p.reasoning}" if p.reasoning else "")
                for p in predictions[:24]))
        context = "\n\n".join(parts) or "(no live data loaded yet — tell the user to run a forecast)"
        sys = ("You are PYTHIA, an oracle watching the world through live global feeds (news, conflict, "
               "weather/disasters, seismic, cyber, infrastructure, and Polymarket crowd odds). Answer the "
               "user's question using the live data below and sound reasoning. Be specific and concise, cite "
               "concrete signals, and give probabilities when it helps. If the data doesn't cover something, say so.")
        messages: list[dict] = [{"role": "system", "content": sys}]
        for h in (history or [])[-6:]:
            role = "assistant" if h.get("role") == "assistant" else "user"
            messages.append({"role": role, "content": str(h.get("content", ""))[:2000]})
        messages.append({"role": "user", "content": f"{context}\n\n— USER QUESTION —\n{question}"})
        return await self._complete(messages, 800)

    @staticmethod
    def _extract_objects(text: str) -> list[str]:
        """Pull every balanced top-level {...} object out of arbitrary model output.

        Robust to ```fences```, multiple JSON arrays, trailing prose, etc.
        """
        objs: list[str] = []
        depth, start, in_str, esc = 0, None, False, False
        for i, ch in enumerate(text):
            if in_str:
                if esc:
                    esc = False
                elif ch == "\\":
                    esc = True
                elif ch == '"':
                    in_str = False
                continue
            if ch == '"':
                in_str = True
            elif ch == "{":
                if depth == 0:
                    start = i
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0 and start is not None:
                    objs.append(text[start:i + 1])
                    start = None
        return objs

    @classmethod
    def _parse(cls, text: str, brief_id: str) -> list[Prediction]:
        preds: list[Prediction] = []
        for chunk in cls._extract_objects(text):
            try:
                it = json.loads(chunk)
            except (ValueError, TypeError):
                continue
            if not isinstance(it, dict) or not it.get("statement"):
                continue
            p = it.get("probability", 50)
            try:
                p = float(p)
            except (TypeError, ValueError):
                p = 50.0
            p = max(0.0, min(1.0, p / 100.0 if p > 1 else p))

            def _num(v):
                try:
                    return float(v)
                except (TypeError, ValueError):
                    return None
            lat, lng = _num(it.get("lat")), _num(it.get("lng"))
            if lat is not None and not (-90 <= lat <= 90):
                lat = None
            if lng is not None and not (-180 <= lng <= 180):
                lng = None
            preds.append(Prediction(
                statement=str(it["statement"]).strip()[:300],
                horizon=_norm_horizon(str(it.get("horizon", "week"))),
                probability=round(p, 2),
                reasoning=str(it.get("reasoning", "")).strip()[:400],
                location=str(it.get("location", "")).strip()[:80],
                lat=lat, lng=lng,
                brief_id=brief_id,
            ))
        if not preds:
            log.warning("oracle: no predictions parsed from: %s", text[:200])
        return preds
