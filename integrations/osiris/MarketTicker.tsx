'use client';

/** Rolling market ticker — indices, futures, crypto, FX + the user's watchlist,
 *  scrolling above the world-headline ticker. Keyless quotes via /api/quotes;
 *  watchlist symbols come from the engine (falls back to the core set offline).
 *  Hover to pause. */
import { useEffect, useState } from 'react';

type Quote = { symbol: string; price: number; change_percent: number; spark: number[] };

const CORE = ['^GSPC', '^IXIC', '^VIX', 'CL=F', 'BZ=F', 'NG=F', 'GC=F', 'ZW=F', 'BTC-USD', 'ETH-USD', 'EURUSD=X', 'DXY'];
const NAME: Record<string, string> = {
  '^GSPC': 'S&P 500', '^IXIC': 'NASDAQ', '^VIX': 'VIX', 'CL=F': 'WTI', 'BZ=F': 'BRENT',
  'NG=F': 'NATGAS', 'GC=F': 'GOLD', 'ZW=F': 'WHEAT', 'BTC-USD': 'BTC', 'ETH-USD': 'ETH',
  'EURUSD=X': 'EUR/USD', 'DXY': 'DXY',
};

function fmt(p: number): string {
  if (p >= 10000) return (p / 1000).toFixed(1) + 'K';
  if (p >= 100) return p.toFixed(2);
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(4);
}

export default function MarketTicker() {
  const [quotes, setQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        // engine watchlist (best-effort) + the core strip, de-duped, capped
        let symbols = [...CORE];
        try {
          const w = await fetch('/api/engine/watch').then((r) => (r.ok ? r.json() : null));
          if (w?.watchlist?.length) symbols = [...new Set([...CORE, ...w.watchlist])];
        } catch { /* engine offline — core strip still rolls */ }
        const r = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbols.slice(0, 32).join(','))}`);
        if (!r.ok) return;
        const j = await r.json();
        const qs: Quote[] = symbols.map((s) => j.quotes?.[s]).filter(Boolean);
        if (!stop && qs.length) setQuotes(qs);
      } catch { /* keep last strip */ }
    };
    load();
    const iv = setInterval(load, 60000);
    return () => { stop = true; clearInterval(iv); };
  }, []);

  if (!quotes.length) return null;

  const content = (
    <>
      {quotes.map((q, i) => {
        const up = q.change_percent >= 0;
        return (
          <span key={q.symbol + i} className="inline-flex items-center gap-1.5 mx-5 font-mono">
            <span className="text-[var(--text-secondary)] font-semibold">{NAME[q.symbol] || q.symbol}</span>
            <span className="text-[var(--text-primary)]">{fmt(q.price)}</span>
            <span style={{ color: up ? 'var(--alert-green)' : 'var(--alert-red)' }}>
              {up ? '▲' : '▼'}{Math.abs(q.change_percent).toFixed(2)}%
            </span>
          </span>
        );
      })}
    </>
  );

  return (
    <div className="hidden md:block absolute bottom-[30px] left-0 right-0 z-[199] pointer-events-none">
      <div className="h-[26px] overflow-hidden bg-black/85 border-t border-[var(--cyan-primary)]/30 flex items-center text-[11px] backdrop-blur-md pointer-events-auto">
        <div className="flex-shrink-0 px-3 h-full flex items-center gap-1.5 border-r border-[var(--cyan-primary)]/30 bg-black relative z-10">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--cyan-primary)] animate-pulse" />
          <span className="pythia-display text-[9px] font-bold tracking-[0.25em] text-[var(--cyan-primary)]">MARKETS</span>
        </div>
        <div className="flex-1 overflow-hidden relative" style={{ maskImage: 'linear-gradient(to right, transparent, black 2%, black 98%, transparent)' }}>
          <div className="flex items-center whitespace-nowrap animate-ticker hover:[animation-play-state:paused]" style={{ animationDuration: '90s' }}>
            {content}{content}
          </div>
        </div>
      </div>
    </div>
  );
}
