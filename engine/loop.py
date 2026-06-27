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


LOOP = OracleLoop()
SENSE = SenseLoop()
