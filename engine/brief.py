"""The Morning Brief — PYTHIA's daily digest, ready with your coffee.

Once a day at the configured local time (or on demand), the oracle writes a
60-second read: what changed overnight, which forecasts come due today, how the
watchlist moved, and what to watch. Saved to runs/briefs/, surfaced in the deck,
pushed into the alert feed (→ browser notification) and to webhooks.
"""
from __future__ import annotations

import json
import logging
import time

import httpx

from .config import CONFIG, HTTPX_VERIFY
from .models import now_ms
from .state import STATE

log = logging.getLogger("pythia.brief")

_CFG_PATH = CONFIG.runs_dir / "brief.json"
_DIR = CONFIG.runs_dir / "briefs"


def get_config() -> dict:
    try:
        d = json.loads(_CFG_PATH.read_text())
        if isinstance(d, dict):
            return {"time": str(d.get("time", CONFIG.brief_time)), "enabled": bool(d.get("enabled", CONFIG.brief_enabled))}
    except (OSError, ValueError):
        pass
    return {"time": CONFIG.brief_time, "enabled": CONFIG.brief_enabled}


def set_config(time_hhmm: str | None = None, enabled: bool | None = None) -> dict:
    cfg = get_config()
    if time_hhmm is not None:
        hh, _, mm = str(time_hhmm).partition(":")
        if not (hh.isdigit() and mm.isdigit() and 0 <= int(hh) < 24 and 0 <= int(mm) < 60):
            raise ValueError("time must be HH:MM")
        cfg["time"] = f"{int(hh):02d}:{int(mm):02d}"
    if enabled is not None:
        cfg["enabled"] = bool(enabled)
    try:
        _CFG_PATH.write_text(json.dumps(cfg, indent=1))
    except OSError:
        pass
    return cfg


def latest() -> dict | None:
    try:
        files = sorted(_DIR.glob("*.md"))
        if not files:
            return None
        f = files[-1]
        return {"date": f.stem, "text": f.read_text()}
    except OSError:
        return None


def history() -> list[str]:
    try:
        return sorted((f.stem for f in _DIR.glob("*.md")), reverse=True)[:30]
    except OSError:
        return []


async def _watch_moves() -> str:
    """Watchlist day moves through the UI's keyless quote route (best-effort)."""
    syms = list(STATE.watchlist)[:16]
    if not syms:
        return ""
    try:
        async with httpx.AsyncClient(verify=HTTPX_VERIFY, timeout=15) as c:
            r = await c.get(f"{CONFIG.osiris_url}/api/quotes", params={"symbols": ",".join(syms)})
            r.raise_for_status()
            q = r.json().get("quotes", {}) or {}
        rows = [f"{s}: {q[s]['price']} ({q[s]['change_percent']:+.2f}%)" for s in syms if q.get(s)]
        return "; ".join(rows)
    except Exception:  # noqa: BLE001
        return ""


def _due_today() -> list[str]:
    from .runtime import ledger
    now = now_ms()
    end_of_day = now + (24 * 3600 * 1000)   # roughly the next 24h — close enough for a digest
    out = []
    try:
        for f in ledger.open_recent(limit=64):
            if now <= f["resolve_after"] <= end_of_day:
                out.append(f"[{f['horizon']}] {int(f['probability'] * 100)}% — {f['statement']}")
    except Exception:  # noqa: BLE001
        pass
    return out[:10]


async def generate(trigger: str = "scheduled") -> dict:
    """Write today's brief. Returns {date, text}."""
    from .runtime import ledger, oracle
    from .tickers import watch_from_predictions

    date = time.strftime("%Y-%m-%d")
    world = STATE.world.text if STATE.world else "(no world data yet)"
    preds = STATE.predictions or []
    pred_lines = "\n".join(f"- [{p.horizon}] {int(p.probability * 100)}% {p.statement}" for p in preds[:16])
    due = _due_today()
    due_lines = "\n".join(f"- {d}" for d in due) or "- nothing resolves in the next 24h"
    moves = await _watch_moves()
    watch = watch_from_predictions(preds)[:6]
    watch_lines = "\n".join(f"- {w['symbol']} ({w['theme']}): {w['why'][:90]}" for w in watch)
    score = ledger.scorecard()
    brier = score.get("brier")

    prompt = (
        f"=== LIVE WORLD SNAPSHOT ===\n{world[:4200]}\n\n"
        f"=== CURRENT FORECASTS ===\n{pred_lines}\n\n"
        f"=== FORECASTS RESOLVING IN THE NEXT 24H ===\n{due_lines}\n\n"
        + (f"=== WATCHLIST MOVES ===\n{moves}\n\n" if moves else "")
        + (f"=== TICKERS YOUR FORECASTS TOUCH ===\n{watch_lines}\n\n" if watch_lines else "")
        + (f"(track record: Brier {brier})\n\n" if brier is not None else "")
        + f"Write PYTHIA's Morning Brief for {date} — a digest the reader finishes in about a minute.\n"
        "Structure it exactly as:\n"
        "OVERNIGHT — 3-4 bullet points on the most consequential developments.\n"
        "TODAY — what resolves or is likely to break in the next 24h (use the forecasts).\n"
        "MARKETS — one tight paragraph: watchlist moves + what your forecasts imply for them.\n"
        "WATCH FOR — 2-3 specific things that would change the picture if they happen.\n"
        "Plain text with those section headers. Concrete, calibrated, no filler, no preamble."
    )
    sys = "You are PYTHIA, a forecasting oracle writing its subscriber's daily brief. Be concrete and calibrated."
    text = await oracle._complete([{"role": "system", "content": sys},
                                   {"role": "user", "content": prompt}], CONFIG.brief_max_tokens)
    text = (text or "").strip()
    if not text:
        raise RuntimeError("the model returned an empty brief")

    _DIR.mkdir(exist_ok=True)
    (_DIR / f"{date}.md").write_text(text)
    STATE.publish("brief", {"date": date, "text": text})
    from . import alerts, webhooks
    alerts.push_external("brief", f"Morning Brief — {date}",
                         text.splitlines()[0][:200] if text.splitlines() else "your daily digest is ready")
    webhooks.fire_alerts([{"rule_name": "Morning Brief", "kind": "brief",
                           "title": f"Morning Brief — {date}", "body": text[:1500],
                           "lat": None, "lng": None, "ts": now_ms()}])
    log.info("morning brief generated (%s, %d chars, trigger=%s)", date, len(text), trigger)
    return {"date": date, "text": text}
