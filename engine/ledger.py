"""The forecast ledger — PYTHIA's accountability.

Every prediction is persisted the moment it's made. When its horizon expires,
an LLM judge grades it against the archived world (the top signals PYTHIA saw
during the window). Resolved forecasts get a Brier score; the scorecard shows
overall accuracy, calibration, and how each swarm persona is really doing.
Append-only JSONL in runs/ledger.jsonl — no database, no cloud.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Optional

from .config import CONFIG
from .models import Prediction, WorldBrief, now_ms

log = logging.getLogger("pythia.ledger")

HORIZON_MS = {
    "24h": 86_400_000,
    "week": 7 * 86_400_000,
    "month": 30 * 86_400_000,
    "year": 365 * 86_400_000,
}
GRACE = 2.0                    # keep trying to judge until due + GRACE × horizon, then void
MAX_BRIEFS = 500               # compact world archive kept in memory
CAL_BINS = [(0.0, 0.2), (0.2, 0.4), (0.4, 0.6), (0.6, 0.8), (0.8, 1.01)]


class Ledger:
    def __init__(self, path: Optional[Path] = None):
        self.path = path or (CONFIG.runs_dir / "ledger.jsonl")
        self.forecasts: dict[str, dict] = {}     # id -> forecast record
        self.resolutions: dict[str, dict] = {}   # id -> resolution record
        self.briefs: list[dict] = []             # {ts, top_events} — the world archive
        self._load()

    # ── persistence ──
    def _load(self) -> None:
        if not self.path.exists():
            return
        n = 0
        for line in self.path.read_text().splitlines():
            try:
                rec = json.loads(line)
            except ValueError:
                continue
            kind = rec.get("kind")
            if kind == "forecast" and rec.get("id"):
                self.forecasts[rec["id"]] = rec
            elif kind == "resolution" and rec.get("id"):
                self.resolutions[rec["id"]] = rec
            elif kind == "brief":
                self.briefs.append(rec)
            n += 1
        self.briefs = self.briefs[-MAX_BRIEFS:]
        log.info("ledger loaded: %d records, %d forecasts (%d resolved)",
                 n, len(self.forecasts), len(self.resolutions))

    def _append(self, rec: dict) -> None:
        try:
            with self.path.open("a") as f:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        except OSError as e:  # a full disk shouldn't sink a forecast pass
            log.warning("ledger write failed: %s", e)

    # ── recording ──
    def record_forecasts(self, preds: list[Prediction], brief: Optional[WorldBrief]) -> None:
        for p in preds:
            if p.id in self.forecasts:
                continue
            rec = {
                "kind": "forecast", "id": p.id, "statement": p.statement,
                "horizon": p.horizon, "probability": p.probability,
                "base_probability": p.base_probability, "location": p.location,
                "reasoning": p.reasoning, "lat": p.lat, "lng": p.lng,
                "split": p.split, "ts": p.ts,
                "resolve_after": p.ts + HORIZON_MS.get(p.horizon, HORIZON_MS["week"]),
                "agents": [{"name": a.name, "probability": a.probability, "model": a.model}
                           for a in p.agents],
                "brief_id": brief.id if brief else None,
            }
            self.forecasts[p.id] = rec
            self._append(rec)

    def maybe_record_brief(self, brief: WorldBrief, min_gap_ms: int = 3_300_000) -> None:
        """Archive the brief's top signals, at most ~hourly — the judge's evidence base.
        500 hourly snapshots ≈ 3 weeks of world memory."""
        if self.briefs and brief.ts - self.briefs[-1]["ts"] < min_gap_ms:
            return
        rec = {"kind": "brief", "ts": brief.ts, "top_events": brief.top_events[:20]}
        self.briefs.append(rec)
        self.briefs = self.briefs[-MAX_BRIEFS:]
        self._append(rec)

    def resolve(self, fid: str, verdict: str, outcome: Optional[float], evidence: str) -> None:
        rec = {"kind": "resolution", "id": fid, "verdict": verdict,
               "outcome": outcome, "evidence": evidence[:400], "resolved_ms": now_ms()}
        self.resolutions[fid] = rec
        self._append(rec)

    def history_for(self, statement: str, horizon: str, cap: int = 20) -> list[dict]:
        """Probability drift: this forecast's probability across past passes.
        Statements are re-drafted each pass, so match by similarity (same horizon,
        ≥0.6 ratio) — the same trick the deck's momentum arrows use."""
        import difflib
        target = statement.lower()
        pts = []
        for f in self.forecasts.values():
            if f["horizon"] != horizon:
                continue
            r = difflib.SequenceMatcher(None, f["statement"].lower(), target).ratio()
            if r >= 0.6:
                pts.append({"ts": f["ts"], "p": f["probability"]})
        pts.sort(key=lambda x: x["ts"])
        return pts[-cap:]

    def open_recent(self, limit: int = 16) -> list[dict]:
        """Still-live forecasts (horizon not yet expired), newest first — used to
        rehydrate the deck after an engine restart."""
        now = now_ms()
        out = [f for fid, f in self.forecasts.items()
               if fid not in self.resolutions and f["resolve_after"] > now]
        out.sort(key=lambda f: f["ts"], reverse=True)
        return out[:limit]

    # ── resolution queue ──
    def due(self, now: Optional[int] = None) -> list[dict]:
        """Open forecasts past their horizon, oldest first."""
        now = now or now_ms()
        out = [f for fid, f in self.forecasts.items()
               if fid not in self.resolutions and now >= f["resolve_after"]]
        out.sort(key=lambda f: f["resolve_after"])
        return out

    @staticmethod
    def past_grace(f: dict, now: Optional[int] = None) -> bool:
        now = now or now_ms()
        horizon = HORIZON_MS.get(f["horizon"], HORIZON_MS["week"])
        return now > f["resolve_after"] + GRACE * horizon

    def window_events(self, start_ms: int, end_ms: int, cap: int = 40) -> list[str]:
        """Top world signals archived during a forecast's window (evidence for the judge)."""
        seen: list[str] = []
        for b in self.briefs:
            if start_ms <= b["ts"] <= end_ms + 6 * 3_600_000:   # small slack after the window
                for t in b.get("top_events", []):
                    if t not in seen:
                        seen.append(t)
        return seen[-cap:]

    # ── the scorecard ──
    def scorecard(self) -> dict:
        resolved = [(f, self.resolutions[fid]) for fid, f in self.forecasts.items()
                    if fid in self.resolutions and self.resolutions[fid].get("outcome") is not None]
        briers = [(f["probability"] - r["outcome"]) ** 2 for f, r in resolved]
        hits = [1 for f, r in resolved
                if (f["probability"] >= 0.5) == (r["outcome"] >= 0.5)]

        per_horizon: dict[str, dict] = {}
        for h in HORIZON_MS:
            hs = [(f, r) for f, r in resolved if f["horizon"] == h]
            if hs:
                per_horizon[h] = {
                    "resolved": len(hs),
                    "brier": round(sum((f["probability"] - r["outcome"]) ** 2 for f, r in hs) / len(hs), 3),
                    "hit_rate": round(sum(1 for f, r in hs
                                          if (f["probability"] >= 0.5) == (r["outcome"] >= 0.5)) / len(hs), 2),
                }

        calibration = []
        for lo, hi in CAL_BINS:
            bin_ = [(f, r) for f, r in resolved if lo <= f["probability"] < hi]
            if bin_:
                calibration.append({
                    "bin": f"{int(lo * 100)}–{int(min(hi, 1.0) * 100)}%",
                    "n": len(bin_),
                    "avg_predicted": round(sum(f["probability"] for f, _ in bin_) / len(bin_), 2),
                    "observed": round(sum(r["outcome"] for _, r in bin_) / len(bin_), 2),
                })

        personas: dict[str, dict] = {}
        for f, r in resolved:
            for a in f.get("agents", []):
                s = personas.setdefault(a["name"], {"n": 0, "sum": 0.0})
                s["n"] += 1
                s["sum"] += (a["probability"] - r["outcome"]) ** 2
        persona_scores = {name: {"resolved": s["n"], "brier": round(s["sum"] / s["n"], 3)}
                          for name, s in personas.items() if s["n"]}

        # per-MODEL accuracy — votes carry the model that cast them, so the
        # scorecard doubles as a local model bake-off on real-world forecasting
        by_model: dict[str, dict] = {}
        for f, r in resolved:
            for a in f.get("agents", []):
                m = a.get("model") or "(main)"
                s = by_model.setdefault(m, {"n": 0, "sum": 0.0})
                s["n"] += 1
                s["sum"] += (a["probability"] - r["outcome"]) ** 2
        model_scores = {m: {"resolved": s["n"], "brier": round(s["sum"] / s["n"], 3)}
                        for m, s in by_model.items() if s["n"]}

        unresolved = [fid for fid in self.resolutions
                      if self.resolutions[fid].get("outcome") is None]
        recent = sorted(
            ({"statement": f["statement"], "horizon": f["horizon"],
              "probability": f["probability"], "location": f.get("location", ""),
              "outcome": r["outcome"], "verdict": r["verdict"],
              "evidence": r.get("evidence", ""), "resolved_ms": r["resolved_ms"], "ts": f["ts"]}
             for f, r in resolved),
            key=lambda x: x["resolved_ms"], reverse=True)[:12]

        return {
            "resolved": len(resolved),
            "open": len(self.forecasts) - len(self.resolutions),
            "due": len(self.due()),
            "unresolvable": len(unresolved),
            "brier": round(sum(briers) / len(briers), 3) if briers else None,
            "hit_rate": round(len(hits) / len(resolved), 2) if resolved else None,
            "per_horizon": per_horizon,
            "calibration": calibration,
            "personas": persona_scores,
            "models": model_scores,
            "recent": recent,
        }
