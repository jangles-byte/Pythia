"""Central configuration for the PYTHIA oracle (Osiris world data -> LLM -> predictions)."""
from __future__ import annotations

import os
import ssl
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_ROOT / ".env", override=False)

# httpx defaults its CA bundle to certifi, which fails to load under some OpenSSL 3
# setups (X509: NO_CERTIFICATE_OR_CRL_FOUND) and 500s every request. The system
# trust store loads fine, so use it — this keeps full TLS verification on.
try:
    HTTPX_VERIFY: "ssl.SSLContext | bool" = ssl.create_default_context()
except Exception:  # noqa: BLE001 — fall back to httpx's default if the system store is unavailable
    HTTPX_VERIFY = True

# Reuse MiroFish's local LLM as the oracle's brain unless overridden in pythia/.env.
_MIROFISH_DIR = Path(os.environ.get("MIROFISH_DIR", str(Path.home() / "MiroFish")))


def _mirofish_env() -> dict:
    out: dict[str, str] = {}
    p = _MIROFISH_DIR / ".env"
    if p.exists():
        for line in p.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                out[k.strip()] = v.strip()
    return out


_MF = _mirofish_env()


def _i(name: str, default: int) -> int:
    try:
        return int(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _f(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, default))
    except (TypeError, ValueError):
        return default


def _b(name: str, default: bool) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


@dataclass
class Config:
    root: Path = _ROOT
    runs_dir: Path = _ROOT / "runs"

    osiris_url: str = field(default_factory=lambda: os.environ.get("OSIRIS_URL", "http://localhost:3000"))
    engine_host: str = field(default_factory=lambda: os.environ.get("ENGINE_HOST", "0.0.0.0"))
    engine_port: int = field(default_factory=lambda: _i("ENGINE_PORT", 8088))

    # ── Oracle LLM (defaults to MiroFish's configured local model) ──
    llm_base_url: str = field(default_factory=lambda: os.environ.get("LLM_BASE_URL") or _MF.get("LLM_BASE_URL") or "http://localhost:11434/v1")
    llm_api_key: str = field(default_factory=lambda: os.environ.get("LLM_API_KEY") or _MF.get("LLM_API_KEY") or "ollama")
    llm_model: str = field(default_factory=lambda: os.environ.get("LLM_MODEL") or _MF.get("LLM_MODEL_NAME") or "llama3.1")
    temperature: float = field(default_factory=lambda: _f("ORACLE_TEMPERATURE", 0.5))
    request_timeout: int = field(default_factory=lambda: _i("ORACLE_TIMEOUT_SEC", 180))

    # ── Prediction behaviour ──
    horizons: list[str] = field(default_factory=lambda: [h.strip() for h in os.environ.get("HORIZONS", "24h,week,month,year").split(",") if h.strip()])
    predictions_per_horizon: int = field(default_factory=lambda: _i("PREDICTIONS_PER_HORIZON", 3))
    loop_interval_sec: int = field(default_factory=lambda: _i("LOOP_INTERVAL_SEC", 900))
    sense_interval_sec: int = field(default_factory=lambda: _i("SENSE_INTERVAL_SEC", 180))
    # max events kept per sensing pass after salience-ranking. Higher = quieter domains
    # (space weather, Green disaster alerts) survive the cut and stay visible to agents.
    event_cap: int = field(default_factory=lambda: _i("EVENT_CAP", 500))
    # token budget for a what-if pass — narrative + 4-6 knock-on predictions. Reasoning
    # models burn ~1300 tokens (mostly hidden chain-of-thought) here, so keep generous
    # headroom or the JSON truncates mid-answer (see JUDGE_MAX_TOKENS).
    whatif_max_tokens: int = field(default_factory=lambda: _i("WHATIF_MAX_TOKENS", 2400))

    # ── Swarm (a council of LLM personas deliberates each forecast) ──
    swarm_enabled: bool = field(default_factory=lambda: _b("SWARM_ENABLED", True))
    # per-persona scoring token budget. Reasoning models spend most of it on hidden
    # chain-of-thought, so a tight cap truncates the votes (personas end up scoring
    # only the first prediction or none) — keep generous (see JUDGE_MAX_TOKENS).
    swarm_max_tokens: int = field(default_factory=lambda: _i("SWARM_MAX_TOKENS", 2400))
    # how many personas hit the local model at once. Default 1 (sequential) is the
    # reliable choice for a single heavy model — 4 concurrent 12B calls starve each
    # other and most drop out ("only 1 opinion"). Raise it only for small/fast models.
    swarm_concurrency: int = field(default_factory=lambda: _i("SWARM_CONCURRENCY", 1))
    # per-persona model seeds, e.g. SWARM_MODELS=Strategist=llama3.1:70b,Skeptic=qwen3:8b
    # (UI picks are saved to runs/swarm_models.json and win over these)
    swarm_models: dict = field(default_factory=lambda: {
        k.strip(): v.strip()
        for pair in os.environ.get("SWARM_MODELS", "").split(",") if "=" in pair
        for k, v in [pair.split("=", 1)] if k.strip() and v.strip()
    })

    # ── Track record (persist forecasts, judge them when the horizon expires) ──
    track_enabled: bool = field(default_factory=lambda: _b("TRACK_RECORD_ENABLED", True))
    resolve_interval_sec: int = field(default_factory=lambda: _i("RESOLVE_INTERVAL_SEC", 3600))
    # The judge's token budget must be generous: reasoning models (gemma4, qwen3, …)
    # spend tokens on a hidden chain-of-thought *before* the answer, so a tight cap
    # returns an empty verdict and the forecast never resolves. 700 fits CoT + JSON.
    judge_max_tokens: int = field(default_factory=lambda: _i("JUDGE_MAX_TOKENS", 700))
    # forecasts LLM-judged per resolve pass (voiding long-dead ones is unlimited)
    resolve_max_per_pass: int = field(default_factory=lambda: _i("RESOLVE_MAX_PER_PASS", 12))

    def summary(self) -> dict:
        return {
            "osiris_url": self.osiris_url,
            "llm_base_url": self.llm_base_url,
            "llm_model": self.llm_model,
            "horizons": self.horizons,
            "loop_interval_sec": self.loop_interval_sec,
            "event_cap": self.event_cap,
        }


CONFIG = Config()
CONFIG.runs_dir.mkdir(exist_ok=True)
