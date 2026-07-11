"""PYTHIA's Watch — map live forecasts to the tickers they touch.

The oracle already says what's about to happen; this module says which markets
feel it. Pure keyword heuristics over the forecast text (statement + reasoning +
location), so it stays keyless and instant. Each hit carries the *why*: the
forecast that put the symbol on watch.
"""
from __future__ import annotations

import re

# (pattern, [symbols], theme) — first ~3 matching rules per forecast apply.
# Symbols are Yahoo-style so the UI's keyless quote route can price everything.
RULES: list[tuple[str, list[str], str]] = [
    (r"strait|hormuz|suez|shipping|tanker|maritime|port|canal|red sea",
     ["BZ=F", "CL=F", "ZIM", "FRO"], "shipping & oil chokepoints"),
    (r"oil|opec|crude|petrol|refiner",
     ["CL=F", "BZ=F", "XLE"], "crude & energy"),
    (r"natural gas|pipeline|lng",
     ["NG=F", "XLE"], "natural gas"),
    (r"war|conflict|strike[sd]?\b|missile|drone|invasion|offensive|military|troops|airstrike",
     ["ITA", "LMT", "RTX", "NOC"], "defense"),
    (r"nuclear|npp|radiation|reactor",
     ["CCJ", "URA", "ITA"], "nuclear & uranium"),
    (r"hurricane|cyclone|typhoon|storm surge|flood",
     ["NG=F", "GNRC", "HD", "ALL"], "storm impact & recovery"),
    (r"drought|harvest|crop|wheat|grain|food (in)?security|famine",
     ["ZW=F", "ZC=F", "ZS=F", "DBA"], "agriculture & grains"),
    (r"earthquake|seismic|tsunami|volcan",
     ["ALL", "TRV", "CAT"], "insurers & rebuild"),
    (r"cyber|ransomware|hack|malware|outage|ddos|breach",
     ["CIBR", "CRWD", "PANW"], "cybersecurity"),
    (r"outbreak|virus|pandemic|epidemic|disease|h5n1|cholera|ebola",
     ["XPH", "PFE", "MRNA", "BNTX"], "pharma & response"),
    (r"inflation|cpi|rate hike|federal reserve|interest rate|recession|bond",
     ["^TNX", "GC=F", "TLT"], "rates & safe havens"),
    (r"escalat|tension|geopolit|sanction|standoff|crisis|instability|unrest|coup|protest",
     ["GC=F", "^VIX", "DXY"], "risk-off"),
    (r"market (pullback|correction|volatil)|vix|equity|sell-?off|stocks",
     ["^VIX", "SPY", "QQQ"], "equity volatility"),
    (r"taiwan|semiconductor|chip",
     ["SMH", "TSM", "NVDA"], "semiconductors"),
    (r"china|prc\b|beijing",
     ["FXI", "SMH", "DXY"], "china exposure"),
    (r"crypto|bitcoin|ethereum|stablecoin",
     ["BTC-USD", "ETH-USD", "COIN"], "crypto"),
    (r"space weather|solar (flare|storm)|geomagnetic|kp\b|satellite",
     ["VSAT", "IRDM", "XLU"], "satellites & grid"),
    (r"power grid|blackout|electricit|utility",
     ["XLU", "GNRC"], "grid & utilities"),
    (r"gold|safe.?haven",
     ["GC=F", "GDX"], "gold"),
    (r"airline|airspace|aviation|airport",
     ["JETS", "CL=F"], "aviation"),
]

_COMPILED = [(re.compile(p, re.I), syms, theme) for p, syms, theme in RULES]


def watch_from_predictions(predictions, cap: int = 14) -> list[dict]:
    """Cross-reference live forecasts with the tickers they touch.
    Returns [{symbol, theme, why, horizon, probability, prediction_id}], strongest first,
    one entry per symbol (the highest-probability forecast that flagged it wins)."""
    hits: dict[str, dict] = {}
    for p in predictions or []:
        text = f"{getattr(p, 'statement', '')} {getattr(p, 'reasoning', '')} {getattr(p, 'location', '') or ''}"
        matched = 0
        for rx, syms, theme in _COMPILED:
            if matched >= 3:
                break
            if not rx.search(text):
                continue
            matched += 1
            for s in syms:
                prev = hits.get(s)
                prob = float(getattr(p, "probability", 0) or 0)
                if prev is None or prob > prev["probability"]:
                    hits[s] = {
                        "symbol": s,
                        "theme": theme,
                        "why": getattr(p, "statement", "")[:160],
                        "horizon": getattr(p, "horizon", ""),
                        "probability": prob,
                        "prediction_id": getattr(p, "id", ""),
                    }
    ranked = sorted(hits.values(), key=lambda h: h["probability"], reverse=True)
    return ranked[:cap]
