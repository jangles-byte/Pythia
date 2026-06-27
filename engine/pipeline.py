"""The oracle pass: sense the world (Osiris) -> think (LLM) -> predictions."""
from __future__ import annotations

import asyncio
import logging

from .models import RunRecord
from .state import STATE
from .world_state import build_brief

log = logging.getLogger("pythia.pipeline")

# one oracle pass at a time (the local model is single-stream)
_lock = asyncio.Lock()


async def refresh_world() -> int:
    """Cheap sensing pass — refresh live events + brief WITHOUT calling the LLM.
    Keeps the agent view and oracle context current between forecasts."""
    from .runtime import intake
    try:
        events = await intake.fetch(limit=250)
        STATE.events = events
        STATE.set_world(build_brief(events))
        return len(events)
    except Exception as e:  # noqa: BLE001
        log.warning("sense refresh failed: %s", e)
        return 0


async def run_prediction(trigger: str = "manual") -> RunRecord:
    from .runtime import intake, oracle

    run = RunRecord(trigger=trigger, stage="queued")
    STATE.upsert_run(run)

    async def stage(name: str, info: str = "") -> None:
        run.touch(name)
        if info:
            log.info("[%s] %s: %s", run.id, name, info)
        STATE.upsert_run(run)

    async with _lock:
        STATE.set_generating(True)
        try:
            await stage("sensing", "reading Osiris feeds")
            # high cap so no single source (weather alerts, news) starves the others;
            # build_brief then takes the top few per domain.
            events = await intake.fetch(limit=250)
            STATE.events = events
            brief = build_brief(events)
            run.brief = brief
            STATE.set_world(brief)
            await stage("thinking", f"{brief.event_count} signals -> oracle")

            preds = await oracle.predict(brief, on_stage=stage)
            STATE.set_predictions(preds)
            run.prediction_ids = [p.id for p in preds]
            await stage("done", f"{len(preds)} predictions")
        except Exception as e:  # noqa: BLE001
            run.error = str(e)
            await stage("error", str(e))
            log.exception("oracle pass failed")
        finally:
            STATE.set_generating(False)
    return run
