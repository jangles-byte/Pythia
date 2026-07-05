"""Data models for the PYTHIA oracle."""
from __future__ import annotations

import time
import uuid
from typing import Any, Optional

from pydantic import BaseModel, Field


def _id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:10]}"


def now_ms() -> int:
    return int(time.time() * 1000)


class WorldEvent(BaseModel):
    """A normalized signal pulled from an Osiris feed."""
    id: str = Field(default_factory=lambda: _id("evt"))
    title: str
    summary: str = ""
    category: str = "general"          # conflict | disaster | seismic | news | geopolitics ...
    source: str = "osiris"
    lat: Optional[float] = None
    lng: Optional[float] = None
    url: str = ""
    salience: float = 0.5
    ts: int = Field(default_factory=now_ms)
    raw: dict[str, Any] = Field(default_factory=dict)


class WorldBrief(BaseModel):
    """A point-in-time digest of the whole globe, assembled from all feeds."""
    id: str = Field(default_factory=lambda: _id("brief"))
    ts: int = Field(default_factory=now_ms)
    event_count: int = 0
    domains: dict[str, int] = Field(default_factory=dict)   # category -> count
    text: str = ""                                          # the prose brief fed to the LLM
    top_events: list[str] = Field(default_factory=list)


class AgentView(BaseModel):
    """One swarm persona's take on a single prediction."""
    name: str                           # Strategist | Economist | Naturalist | Skeptic
    probability: float                  # 0..1, this agent's estimate
    note: str = ""                      # terse rationale from its lens
    model: str = ""                     # which local model cast this vote


class Prediction(BaseModel):
    """A single forecast from the oracle about a future event."""
    id: str = Field(default_factory=lambda: _id("pred"))
    statement: str
    horizon: str                        # 24h | week | month | year
    probability: float                  # 0..1 (consensus after swarm deliberation)
    reasoning: str = ""
    drivers: list[str] = Field(default_factory=list)   # signals that informed it
    location: str = ""                  # human place name (e.g. "Strait of Hormuz")
    lat: Optional[float] = None         # approx coords so the UI can fly there
    lng: Optional[float] = None
    agents: list[AgentView] = Field(default_factory=list)   # the swarm's per-persona votes
    base_probability: Optional[float] = None               # the oracle's pre-swarm estimate
    prev_probability: Optional[float] = None               # last run's probability for ~the same call (momentum)
    split: bool = False                 # True when the swarm disagrees sharply
    brief_id: Optional[str] = None
    ts: int = Field(default_factory=now_ms)


class RunRecord(BaseModel):
    """One oracle pass: build brief -> ask model -> predictions."""
    id: str = Field(default_factory=lambda: _id("run"))
    trigger: str = "manual"             # manual | loop
    stage: str = "queued"              # queued|sensing|thinking|done|error
    brief: Optional[WorldBrief] = None
    prediction_ids: list[str] = Field(default_factory=list)
    error: str = ""
    started_ms: int = Field(default_factory=now_ms)
    updated_ms: int = Field(default_factory=now_ms)
    elapsed_ms: int = 0

    def touch(self, stage: Optional[str] = None) -> None:
        if stage:
            self.stage = stage
        self.updated_ms = now_ms()
        self.elapsed_ms = self.updated_ms - self.started_ms
