"""Central configuration for the PYTHIA oracle (Osiris world data -> LLM -> predictions)."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv

_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(_ROOT / ".env", override=False)

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

    def summary(self) -> dict:
        return {
            "osiris_url": self.osiris_url,
            "llm_base_url": self.llm_base_url,
            "llm_model": self.llm_model,
            "horizons": self.horizons,
            "loop_interval_sec": self.loop_interval_sec,
        }


CONFIG = Config()
CONFIG.runs_dir.mkdir(exist_ok=True)
