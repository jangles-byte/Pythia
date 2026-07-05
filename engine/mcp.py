"""PYTHIA MCP server — give any agent eyes on the planet.

Exposes the local engine API as MCP tools over stdio, so Claude Code, Claude
Desktop, or any MCP client can read the live world, pull forecasts, ask the
oracle questions, and check its track record. The engine must be running
(./run-all.sh); this server is just a thin bridge to http://localhost:8088.

Register it (Claude Code):
    claude mcp add pythia -- uv --directory /path/to/pythia run python -m engine.mcp

Or in any MCP client config:
    { "command": "uv", "args": ["--directory", "/path/to/pythia", "run", "python", "-m", "engine.mcp"] }
"""
from __future__ import annotations

import os
from typing import Optional

import httpx
from mcp.server.fastmcp import FastMCP

ENGINE = os.environ.get("PYTHIA_ENGINE_URL", "http://localhost:8088").rstrip("/")

mcp = FastMCP(
    "pythia",
    instructions=(
        "PYTHIA is a local, keyless world-watching oracle: it fuses dozens of live global "
        "feeds (conflict, disasters, markets, futures, displacement, disease, unrest, cyber) "
        "and forecasts what happens next across 24h/week/month/year horizons. Use world_brief "
        "for the current state of the planet, get_events for raw located signals, "
        "get_predictions for forecasts, ask_oracle for grounded questions, and get_scorecard "
        "for how accurate past forecasts actually were."
    ),
)


async def _get(path: str, **params) -> dict:
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{ENGINE}{path}", params={k: v for k, v in params.items() if v is not None})
        r.raise_for_status()
        return r.json()


async def _post(path: str, body: Optional[dict] = None, timeout: int = 240) -> dict:
    async with httpx.AsyncClient(timeout=timeout) as c:
        r = await c.post(f"{ENGINE}{path}", json=body or {})
        r.raise_for_status()
        return r.json()


@mcp.tool()
async def world_brief() -> dict:
    """The assembled live world brief: a prose digest of everything happening on Earth
    right now (all feeds fused), plus per-domain signal counts and the event total."""
    return await _get("/world")


@mcp.tool()
async def get_events(domain: Optional[str] = None, min_salience: float = 0.0,
                     limit: int = 30) -> dict:
    """Live world events with coordinates, most salient first. Filter by `domain`
    (e.g. conflict, seismic, futures, market-odds, displacement — the response's
    `domains_available` lists them all), `min_salience` (0..1), and `limit`."""
    return await _get("/agent/events", domain=domain, min_salience=min_salience, limit=limit)


@mcp.tool()
async def get_predictions(horizon: Optional[str] = None, min_probability: float = 0.0) -> dict:
    """PYTHIA's current forecasts. Each has a statement, probability (0..1), reasoning,
    location + coords, and the swarm's per-persona votes (with a `split` flag when the
    council disagrees sharply). Filter by `horizon` (24h|week|month|year) and
    `min_probability`."""
    data = await _get("/predictions", horizon=horizon, min_probability=min_probability)
    data.pop("world", None)   # keep the payload lean; use world_brief for the brief
    return data


@mcp.tool()
async def predict_now() -> dict:
    """Trigger a fresh oracle pass (re-sense the world, then re-forecast). Returns
    immediately; new predictions land in ~1–3 minutes depending on the local model —
    poll get_predictions afterwards."""
    return await _post("/predict")


@mcp.tool()
async def ask_oracle(question: str) -> dict:
    """Ask PYTHIA anything about the state of the world. The answer is grounded in
    every live feed and the current forecasts (slow: runs the local LLM)."""
    return await _post("/chat", {"message": question})


@mcp.tool()
async def what_if(scenario: str) -> dict:
    """Counterfactual mode: assume a hypothetical event just happened (e.g. 'the
    Strait of Hormuz closes tonight') and get the oracle's knock-on forecasts,
    grounded in the live world. Ephemeral — doesn't touch the real forecast set
    or the track record. Slow: runs the local LLM."""
    return await _post("/whatif", {"scenario": scenario})


@mcp.tool()
async def get_scorecard() -> dict:
    """PYTHIA's track record: Brier score (0.0 = prophecy, 0.25 = coin-flip), hit rate,
    per-horizon and per-persona accuracy, calibration bins, and recent resolutions —
    every forecast is graded by an LLM judge once its horizon expires."""
    return await _get("/scorecard")


def main() -> None:
    mcp.run()   # stdio transport


if __name__ == "__main__":
    main()
