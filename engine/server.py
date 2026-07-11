"""PYTHIA oracle API — Osiris world data in, future predictions out."""
from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import Body, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from .config import CONFIG
from .state import STATE

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
log = logging.getLogger("pythia.server")


@asynccontextmanager
async def lifespan(app: FastAPI):
    from .loop import LOOP, RESOLVE, SENSE
    from .pipeline import run_prediction
    LOOP.start()
    SENSE.start()   # keep live events fresh between forecasts
    RESOLVE.start()  # grade forecasts once their horizon expires
    log.info("PYTHIA oracle up | %s", CONFIG.summary())

    async def _boot():
        from .runtime import intake
        from .pipeline import hydrate_from_ledger, refresh_world
        hydrate_from_ledger()              # deck + rings light up with live forecasts instantly
        # wait for Osiris to be reachable, then give its routes a moment to compile
        for _ in range(20):
            if await intake.health():
                break
            await asyncio.sleep(2)
        await asyncio.sleep(4)
        await refresh_world()              # populate live events immediately (for agents/chat)
        await run_prediction(trigger="boot")

    asyncio.create_task(_boot())
    yield


app = FastAPI(title="PYTHIA Oracle", version="0.2.0", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "pythia-oracle", "config": CONFIG.summary()}


@app.get("/config")
async def config():
    return CONFIG.summary()


_links_cache: dict = {"ts": 0.0, "data": None}


@app.get("/links")
async def links():
    import time as _t
    now = _t.monotonic()
    if _links_cache["data"] and now - _links_cache["ts"] < 8:
        data = dict(_links_cache["data"])
    else:
        from .runtime import intake, oracle
        osiris_up, oracle_up = await asyncio.gather(intake.health(), oracle.health())
        data = {"engine": True, "osiris": bool(osiris_up), "oracle": bool(oracle_up)}
        _links_cache.update(ts=now, data=dict(data))
    from .runtime import oracle as _oracle
    data.update(model=_oracle.model, generating=STATE.generating,
                loop=STATE.loop_enabled, last_run_ms=STATE.last_run_ms,
                prediction_count=len(STATE.predictions))
    return data


@app.get("/models")
async def models():
    """Installed local models + the one currently in use."""
    from .runtime import oracle
    return {"models": await oracle.list_models(), "current": oracle.model}


@app.post("/model")
async def set_model(payload: dict = Body(...)):
    """Switch the oracle's model at runtime."""
    from .runtime import oracle
    name = (payload or {}).get("model", "").strip()
    if not name:
        raise HTTPException(400, "provide `model`")
    oracle.model = name
    STATE.publish("model", {"model": name})
    log.info("oracle model switched -> %s", name)
    return {"model": oracle.model}


@app.get("/swarm/models")
async def swarm_models_get():
    """Per-persona model overrides for the swarm council + the models available to pick from."""
    from .runtime import oracle
    from .swarm import PERSONAS
    return {
        "personas": [name for name, _ in PERSONAS],
        "overrides": STATE.swarm_models,          # persona -> model (only those overridden)
        "default_model": oracle.model,            # what a persona uses when not overridden
        "available": await oracle.list_models(),
    }


@app.post("/swarm/model")
async def swarm_model_set(payload: dict = Body(...)):
    """Set (or clear) the model for one swarm persona. Empty/blank model = use the main model."""
    from .swarm import PERSONAS
    persona = (payload or {}).get("persona", "").strip()
    model = (payload or {}).get("model", "").strip()
    if persona not in {name for name, _ in PERSONAS}:
        raise HTTPException(400, "unknown persona")
    if model:
        STATE.swarm_models[persona] = model
    else:
        STATE.swarm_models.pop(persona, None)
    STATE.save_swarm_models()   # survive engine restarts
    log.info("swarm persona %s -> %s", persona, model or "(main)")
    return {"overrides": STATE.swarm_models}


@app.get("/predictions")
async def predictions(horizon: str | None = None, min_probability: float = 0.0):
    """Current forecasts, optionally filtered by `horizon` (24h|week|month|year)
    and `min_probability` (0..1)."""
    preds = [p for p in STATE.predictions
             if (not horizon or p.horizon == horizon) and p.probability >= min_probability]
    return {"predictions": [p.model_dump() for p in preds],
            "horizons": CONFIG.horizons,
            "world": STATE.world.model_dump() if STATE.world else None}


@app.post("/predict")
async def predict():
    """Run an oracle pass now (sense the world -> forecast)."""
    from .pipeline import run_prediction
    if STATE.generating:
        return {"status": "already running"}
    asyncio.create_task(run_prediction(trigger="manual"))
    return {"status": "started"}


@app.get("/agent/view")
async def agent_view():
    """One consolidated, machine-readable view of the world for external agents:
    the assembled brief, every live event (with coords), and current predictions.
    For a live feed, subscribe to GET /state/stream (SSE)."""
    from .runtime import oracle
    by_domain: dict[str, list] = {}
    for e in STATE.events:
        by_domain.setdefault(e.category, []).append({
            "title": e.title, "summary": e.summary, "source": e.source,
            "lat": e.lat, "lng": e.lng, "salience": e.salience, "ts": e.ts,
        })
    return {
        "generated_at": STATE.last_run_ms,
        "model": oracle.model,
        "summary": (STATE.world.text if STATE.world else ""),
        "domains": (STATE.world.domains if STATE.world else {}),
        "events_by_domain": by_domain,
        "event_count": len(STATE.events),
        "predictions": [p.model_dump() for p in STATE.predictions],
        "live_stream": "/state/stream",
    }


@app.get("/agent/events")
async def agent_events(domain: str | None = None, source: str | None = None,
                       min_salience: float = 0.0, since: int = 0, limit: int = 0):
    """Every live world event, with optional filters so an agent gets exactly what it wants:
    `domain` (category), `source`, `min_salience` (0..1), `since` (epoch ms), `limit`.
    Returned most-salient first, with the list of available domains for discovery."""
    out = []
    for e in STATE.events:
        if domain and e.category != domain:
            continue
        if source and e.source != source:
            continue
        if e.salience < min_salience:
            continue
        if since and e.ts < since:
            continue
        out.append(e)
    out.sort(key=lambda e: e.salience, reverse=True)
    if limit > 0:
        out = out[:limit]
    return {"count": len(out), "events": [e.model_dump() for e in out],
            "domains_available": sorted({e.category for e in STATE.events})}


@app.get("/scorecard")
async def scorecard():
    """PYTHIA's track record. Every forecast is persisted when made; an LLM judge
    grades it against the archived world once its horizon expires. Returns overall
    Brier score, hit rate, per-horizon + per-persona accuracy, calibration bins,
    and the most recent resolutions."""
    from .runtime import ledger
    return ledger.scorecard()


@app.post("/scorecard/resolve")
async def scorecard_resolve():
    """Run a resolution pass now (grade any due forecasts) instead of waiting
    for the hourly loop."""
    from .loop import resolve_due
    if STATE.generating:
        return {"status": "busy — oracle pass in progress"}
    judged = await resolve_due()
    return {"status": "ok", "judged": judged}


@app.get("/world")
async def world():
    if not STATE.world:
        raise HTTPException(404, "no world brief yet — run /predict")
    return STATE.world.model_dump()


@app.get("/runs")
async def runs():
    return {"runs": [r.model_dump() for r in list(STATE.runs.values())[-20:]]}


@app.get("/state")
async def state():
    return STATE.snapshot()


@app.get("/state/stream")
async def stream():
    async def gen():
        q = STATE.subscribe()
        try:
            yield STATE.sse({"kind": "snapshot", "payload": STATE.snapshot()})
            while True:
                try:
                    msg = await asyncio.wait_for(q.get(), timeout=15)
                    yield STATE.sse(msg)
                except asyncio.TimeoutError:
                    yield ": ping\n\n"
        finally:
            STATE.unsubscribe(q)

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@app.post("/chat")
async def chat(payload: dict = Body(...)):
    """Ask the oracle anything — it sees every live source + current predictions.
    Pass `persona` (e.g. "Strategist") to put one council specialist on the line,
    answered in its voice by its own configured model."""
    from .runtime import intake, oracle
    from .swarm import PERSONAS
    from .world_state import build_brief
    payload = payload or {}
    msg = payload.get("message", "").strip()
    if not msg:
        raise HTTPException(400, "provide `message`")
    persona = None
    model = None
    want = str(payload.get("persona") or "").strip()
    if want:
        match = next(((n, l) for n, l in PERSONAS if n.lower() == want.lower()), None)
        if match is None:
            raise HTTPException(400, f"unknown persona {want!r} — one of {[n for n, _ in PERSONAS]}")
        persona = match
        model = STATE.swarm_models.get(match[0]) or None
    brief = STATE.world
    if brief is None:
        try:
            brief = build_brief(await intake.fetch(limit=150))
            STATE.set_world(brief)
        except Exception:  # noqa: BLE001
            brief = None
    answer = await oracle.chat(msg, brief, STATE.predictions, payload.get("history", []),
                               persona=persona, model=model)
    return {"answer": answer, "persona": persona[0] if persona else None}


@app.post("/loop")
async def loop(payload: dict = Body(default={})):
    STATE.set_loop(bool(payload.get("enabled", not STATE.loop_enabled)))
    return {"loop_enabled": STATE.loop_enabled}


@app.get("/personas")
async def personas():
    """The swarm's persona roster — name + the lens each judges through. Drives the
    what-if field's 'who deliberates' checkboxes."""
    from .swarm import PERSONAS
    return {"personas": [{"name": n, "lens": l} for n, l in PERSONAS]}


@app.post("/whatif")
async def whatif(payload: dict = Body(...)):
    """Counterfactual mode: 'assume X just happened' — the oracle forecasts the
    knock-on effects grounded in the live world, then (optionally) the chosen swarm
    personas deliberate on those knock-ons. Ephemeral: nothing is stored, nothing
    enters the track record. Returns {scenario, narrative, predictions, personas}."""
    from .config import CONFIG
    from .runtime import intake, oracle
    from .world_state import build_brief
    payload = payload or {}
    scenario = payload.get("scenario", "").strip()
    if not scenario:
        raise HTTPException(400, "provide `scenario`, e.g. {\"scenario\": \"the Strait of Hormuz closes tonight\"}")
    # which personas the user checked; omit/empty list = no council (single-shot)
    personas = payload.get("personas")
    if personas is not None and not isinstance(personas, list):
        personas = None
    brief = STATE.world
    if brief is None:
        try:
            brief = build_brief(await intake.fetch(limit=150))
            STATE.set_world(brief)
        except Exception:  # noqa: BLE001
            brief = None
    scen, narrative, preds = await oracle.what_if(scenario, brief)
    used = list(personas) if personas else []
    if used and CONFIG.swarm_enabled and preds:
        from .swarm import deliberate
        try:
            preds = await deliberate(oracle, brief, preds, personas=used)
        except Exception as e:  # noqa: BLE001 — a stalled council shouldn't sink the what-if
            log.warning("what-if deliberation skipped: %s", e)
    return {"scenario": scen, "narrative": narrative,
            "predictions": [p.model_dump() for p in preds], "personas": used}


@app.get("/webhooks")
async def webhooks_list():
    """Registered outbound webhooks (see engine/webhooks.py for payload shapes)."""
    from . import webhooks
    return {"webhooks": webhooks.HOOKS}


@app.post("/webhooks")
async def webhooks_add(payload: dict = Body(...)):
    """Register a webhook: {"url": "...", "min_probability": 0.7, "min_salience": 0.85}.
    The engine POSTs {kind: "forecasts"|"events", ...} when thresholds are crossed."""
    from . import webhooks
    url = (payload or {}).get("url", "").strip()
    if not url.startswith(("http://", "https://")):
        raise HTTPException(400, "provide an http(s) `url`")
    hook = webhooks.add(url, payload.get("min_probability", 0.7), payload.get("min_salience", 0.85))
    return {"added": hook, "webhooks": webhooks.HOOKS}


@app.delete("/webhooks")
async def webhooks_remove(url: str):
    """Unregister a webhook by exact URL."""
    from . import webhooks
    if not webhooks.remove(url):
        raise HTTPException(404, "no webhook with that url")
    return {"webhooks": webhooks.HOOKS}
