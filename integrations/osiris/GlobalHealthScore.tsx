'use client';

/** PYTHIA's Global Health Score — a single 1-100 read on the state of the planet,
 *  weighed from everything the oracle intakes. A always-on corner badge; click for the
 *  six-pillar breakdown + explanation. Updates 00:00 & 12:00 local (engine-side). */
import { useState, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

type Pillar = { name: string; score: number; weight: number; count: number; driver: string };
type Score = { score: number; band: string; pillars: Pillar[]; event_count: number; computed_at: string; method: string };

function bandOf(s: number) {
  return s < 25 ? { c: '#FF1744', l: 'Critical' } : s < 42 ? { c: '#FF6D00', l: 'Strained' }
    : s < 58 ? { c: '#FFC400', l: 'Unsettled' } : s < 76 ? { c: '#26C6DA', l: 'Stable' }
    : { c: '#00E676', l: 'Calm' };
}

export default function GlobalHealthScore() {
  const [d, setD] = useState<Score | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try { const r = await fetch('/api/engine/health-score').then(x => (x.ok ? x.json() : null)); if (r?.score) setD(r); } catch { /* engine offline */ }
  }, []);
  useEffect(() => { load(); const iv = setInterval(load, 15 * 60_000); return () => clearInterval(iv); }, [load]);

  if (!d) return null;   // graceful: nothing until the engine serves a score
  const band = bandOf(d.score);

  return (
    <div className="fixed z-[300] top-[104px] left-3 w-[172px] font-mono">
      <button onClick={() => setOpen(o => !o)}
        className="w-full glass-panel rounded-xl px-3 py-2 flex items-center gap-2.5 text-left hover:brightness-110 transition"
        style={{ borderTop: `2px solid ${band.c}` }}>
        <span className="text-[30px] font-bold leading-none tabular-nums" style={{ color: band.c }}>{d.score}</span>
        <div className="min-w-0 flex-1">
          <div className="text-[8px] tracking-[0.14em] text-[var(--text-muted)] leading-tight">GLOBAL HEALTH</div>
          <div className="text-[11px] font-semibold leading-tight" style={{ color: band.c }}>{band.l}</div>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mt-1.5 glass-panel rounded-xl p-2.5 max-h-[62vh] overflow-y-auto">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-[9px] tracking-[0.14em] text-[var(--text-secondary)]">PYTHIA · PLANETARY HEALTH</span>
            <span className="text-[8px] text-[var(--text-muted)]">{d.event_count} signals</span>
          </div>
          <div className="text-[8px] text-[var(--text-muted)] mb-2 leading-tight">Scale 1–100 · 100 = calm, 1 = critical</div>

          {d.pillars.map(p => {
            const pb = bandOf(p.score);
            return (
              <div key={p.name} className="mb-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] text-[var(--text-primary)] truncate">{p.name}</span>
                  <span className="text-[10px] font-bold tabular-nums shrink-0" style={{ color: pb.c }}>{p.score}</span>
                </div>
                <div className="h-1 rounded-full bg-white/8 overflow-hidden my-0.5">
                  <div className="h-full rounded-full" style={{ width: `${p.score}%`, background: pb.c }} />
                </div>
                <div className="text-[8px] text-[var(--text-muted)] truncate leading-tight">{p.count} signals · {p.driver}</div>
              </div>
            );
          })}

          <div className="mt-1 pt-1.5 border-t border-[var(--border-subtle)] text-[8px] text-[var(--text-muted)] leading-snug">
            {d.method}
            <div className="mt-1 opacity-70">as of {d.computed_at}</div>
          </div>
        </div>
      )}
    </div>
  );
}
