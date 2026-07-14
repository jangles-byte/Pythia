"""In-memory oracle state + async pub/sub for SSE."""
from __future__ import annotations

import asyncio
import json
from collections import OrderedDict
from typing import Any, Optional

from .config import CONFIG
from .models import Prediction, RunRecord, WorldBrief, now_ms


class EngineState:
    def __init__(self) -> None:
        self.predictions: list[Prediction] = []     # current forecast set
        self.world: Optional[WorldBrief] = None
        self.events: list = []                       # latest raw WorldEvents (for agents)
        self.health_score: Optional[dict] = None     # latest Global Health Score (1-100 + pillars)
        # persona name -> model override (empty = use main model).
        # Seeded from SWARM_MODELS in .env, then saved UI picks win; persisted across restarts.
        self.swarm_models: dict[str, str] = dict(CONFIG.swarm_models)
        self.swarm_models.update(self._load_swarm_models())
        # user's market watchlist (symbols priced by the UI's keyless quote route)
        self.watchlist: list[str] = self._load_watchlist()
        self.runs: "OrderedDict[str, RunRecord]" = OrderedDict()
        # live view of the council at work: voices flip from "voting" to "done" as
        # they land, so the UI can watch the argument happen. Keeps the last one.
        self.deliberation: dict = {}
        self.generating: bool = False
        self.loop_enabled: bool = False
        self.last_run_ms: Optional[int] = None
        self.started_ms: int = now_ms()
        self._subs: set[asyncio.Queue] = set()

    # ── swarm model persistence ──
    @staticmethod
    def _swarm_models_path():
        return CONFIG.runs_dir / "swarm_models.json"

    def _load_swarm_models(self) -> dict[str, str]:
        try:
            data = json.loads(self._swarm_models_path().read_text())
            return {str(k): str(v) for k, v in data.items() if v} if isinstance(data, dict) else {}
        except (OSError, ValueError):
            return {}

    def save_swarm_models(self) -> None:
        try:
            self._swarm_models_path().write_text(json.dumps(self.swarm_models, indent=1))
        except OSError:
            pass   # persistence is best-effort; the in-memory picks still apply

    # ── watchlist persistence ──
    DEFAULT_WATCHLIST = ["SPY", "QQQ", "^VIX", "CL=F", "GC=F", "NG=F", "BTC-USD", "EURUSD=X"]

    @staticmethod
    def _watchlist_path():
        return CONFIG.runs_dir / "watchlist.json"

    def _load_watchlist(self) -> list[str]:
        try:
            data = json.loads(self._watchlist_path().read_text())
            if isinstance(data, list):
                return [str(s).upper() for s in data if s][:40]
        except (OSError, ValueError):
            pass
        return list(self.DEFAULT_WATCHLIST)

    def save_watchlist(self) -> None:
        try:
            self._watchlist_path().write_text(json.dumps(self.watchlist, indent=1))
        except OSError:
            pass

    # ── pub/sub ──
    def subscribe(self) -> asyncio.Queue:
        q: asyncio.Queue = asyncio.Queue(maxsize=128)
        self._subs.add(q)
        return q

    def unsubscribe(self, q: asyncio.Queue) -> None:
        self._subs.discard(q)

    def publish(self, kind: str, payload: Any) -> None:
        msg = {"kind": kind, "ts": now_ms(), "payload": payload}
        for q in list(self._subs):
            try:
                q.put_nowait(msg)
            except asyncio.QueueFull:
                self._subs.discard(q)

    # ── mutations ──
    def set_predictions(self, preds: list[Prediction]) -> None:
        self.predictions = preds
        self.last_run_ms = now_ms()
        self.publish("predictions", [p.model_dump() for p in preds])

    def set_world(self, brief: WorldBrief) -> None:
        self.world = brief
        self.publish("world", brief.model_dump())

    def upsert_run(self, run: RunRecord) -> None:
        run.touch()
        self.runs[run.id] = run
        self.runs.move_to_end(run.id)
        while len(self.runs) > 50:
            self.runs.popitem(last=False)
        self.publish("run", run.model_dump())

    def set_deliberation(self, delib: dict) -> None:
        self.deliberation = delib
        self.publish("deliberation", delib)

    def set_generating(self, on: bool) -> None:
        self.generating = on
        self.publish("generating", {"generating": on})

    def set_loop(self, on: bool) -> None:
        self.loop_enabled = on
        self.publish("loop", {"enabled": on})

    # ── snapshot ──
    def snapshot(self) -> dict:
        return {
            "config": CONFIG.summary(),
            "generating": self.generating,
            "loop_enabled": self.loop_enabled,
            "last_run_ms": self.last_run_ms,
            "uptime_ms": now_ms() - self.started_ms,
            "world": self.world.model_dump() if self.world else None,
            "predictions": [p.model_dump() for p in self.predictions],
            "runs": [r.model_dump() for r in list(self.runs.values())[-8:]],
            "deliberation": self.deliberation,
        }

    @staticmethod
    def sse(msg: dict) -> str:
        return f"data: {json.dumps(msg)}\n\n"


STATE = EngineState()
