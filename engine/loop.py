"""Continuous oracle: re-forecast the world on an interval when enabled."""
from __future__ import annotations

import asyncio
import logging

from .config import CONFIG
from .pipeline import run_prediction
from .state import STATE

log = logging.getLogger("pythia.loop")


class SenseLoop:
    """Keeps live events fresh (no LLM) so the agent view + chat always see 'now'."""
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._run(), name="sense-loop")

    async def _run(self) -> None:
        from .pipeline import refresh_world
        while True:
            try:
                if not STATE.generating:
                    await refresh_world()
            except Exception as e:  # noqa: BLE001
                log.warning("sense loop failed: %s", e)
            await asyncio.sleep(CONFIG.sense_interval_sec)


class OracleLoop:
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._run(), name="oracle-loop")

    async def _run(self) -> None:
        while True:
            try:
                if STATE.loop_enabled and not STATE.generating:
                    await run_prediction(trigger="loop")
                    await asyncio.sleep(CONFIG.loop_interval_sec)
                else:
                    await asyncio.sleep(5)
            except Exception as e:  # noqa: BLE001
                log.warning("loop iteration failed: %s", e)
                await asyncio.sleep(10)


async def resolve_due(max_judged: int | None = None) -> int:
    """Grade expired forecasts: LLM-judge the due ones (bounded per pass so the
    local model isn't hogged), void the ones long past their grace window."""
    from .runtime import ledger, oracle
    if max_judged is None:
        max_judged = CONFIG.resolve_max_per_pass
    due = ledger.due()
    if not due:
        return 0
    judged = 0
    for f in due:
        if ledger.past_grace(f):
            ledger.resolve(f["id"], "unresolved", None, "window passed with insufficient evidence")
            continue
        if judged >= max_judged:
            break
        evidence = ledger.window_events(f["ts"], f["resolve_after"])
        current = STATE.world.text if STATE.world else ""
        try:
            verdict, note = await oracle.judge(f, evidence, current)
        except Exception as e:  # noqa: BLE001 — a dead model shouldn't spin the loop
            log.warning("judge failed for %s: %s", f["id"], e)
            break
        judged += 1
        log.info("resolved %s -> %s (%s)", f["id"], verdict, f["statement"][:60])
        if verdict == "yes":
            ledger.resolve(f["id"], "yes", 1.0, note)
        elif verdict == "no":
            ledger.resolve(f["id"], "no", 0.0, note)
        # "unclear" stays open — retried next pass until its grace window expires
    STATE.publish("scorecard", ledger.scorecard())
    return judged


class ResolveLoop:
    """Keeps the track record honest: grades forecasts once their horizon expires."""
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._run(), name="resolve-loop")

    async def _run(self) -> None:
        await asyncio.sleep(150)   # let boot + the first forecast land first
        while True:
            try:
                if CONFIG.track_enabled and not STATE.generating:
                    await resolve_due()
            except Exception as e:  # noqa: BLE001
                log.warning("resolve loop failed: %s", e)
            await asyncio.sleep(CONFIG.resolve_interval_sec)


class AlertLoop:
    """Evaluates the user's alert rules against the live world on an interval."""
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._run(), name="alert-loop")

    async def _run(self) -> None:
        await asyncio.sleep(30)   # let the first sensing pass land
        while True:
            try:
                from . import alerts
                await alerts.evaluate()
            except Exception as e:  # noqa: BLE001
                log.warning("alert loop failed: %s", e)
            await asyncio.sleep(CONFIG.alert_interval_sec)


class BriefLoop:
    """Writes the Morning Brief once a day at the configured local time."""
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._run(), name="brief-loop")

    async def _run(self) -> None:
        import time as _t
        from . import brief
        await asyncio.sleep(120)   # boot first; a brief needs a sensed world
        while True:
            try:
                cfg = brief.get_config()
                today = _t.strftime("%Y-%m-%d")
                last = brief.latest()
                if (cfg["enabled"] and (last is None or last["date"] != today)
                        and _t.strftime("%H:%M") >= cfg["time"] and not STATE.generating):
                    await brief.generate(trigger="scheduled")
            except Exception as e:  # noqa: BLE001
                log.warning("brief loop failed: %s", e)
            await asyncio.sleep(60)


class HealthScoreLoop:
    """Recomputes the Global Health Score twice a day (00:00 & 12:00 local), plus once
    shortly after boot so a score is available immediately."""
    def __init__(self) -> None:
        self._task: asyncio.Task | None = None

    def start(self) -> None:
        if self._task is None:
            self._task = asyncio.create_task(self._run(), name="health-score-loop")

    async def _run(self) -> None:
        import time as _t
        from . import healthscore
        await asyncio.sleep(100)   # boot first; the score needs a sensed world
        last_key = None
        while True:
            try:
                hh = int(_t.strftime("%H"))
                key = _t.strftime("%Y-%m-%d") + ("PM" if hh >= 12 else "AM")  # noon/midnight half-day
                if key != last_key and STATE.events:
                    healthscore.compute()
                    last_key = key
            except Exception as e:  # noqa: BLE001
                log.warning("health score loop failed: %s", e)
            await asyncio.sleep(60)


LOOP = OracleLoop()
SENSE = SenseLoop()
RESOLVE = ResolveLoop()
ALERTS = AlertLoop()
BRIEF = BriefLoop()
HEALTH = HealthScoreLoop()
