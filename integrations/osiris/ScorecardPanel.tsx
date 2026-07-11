'use client';

/** PYTHIA's track record — the receipts.
 *  Brier score + hit rate, calibration (predicted vs observed), per-horizon /
 *  per-persona / per-model accuracy, and the most recent judged forecasts.
 *  Data: /api/engine/scorecard (graded by an LLM judge as horizons expire). */
import { useEffect, useState } from 'react';
import { Target, Loader2 } from 'lucide-react';

type Cal = { bin: string; n: number; avg_predicted: number; observed: number };
type Rec = { statement: string; horizon: string; probability: number; outcome: number; verdict: string; evidence?: string; location?: string };
type Score = {
  resolved: number; open: number; due: number; unresolvable: number;
  brier: number | null; hit_rate: number | null;
  per_horizon: Record<string, { resolved: number; brier: number; hit_rate: number }>;
  calibration: Cal[];
  personas: Record<string, { resolved: number; brier: number }>;
  models: Record<string, { resolved: number; brier: number }>;
  recent: Rec[];
};

const HCOLOR: Record<string, string> = {
  '24h': 'var(--alert-red)', week: 'var(--gold-primary)', month: 'var(--cyan-primary)', year: 'var(--horizon-year)',
};

function brierColor(b: number | null): string {
  if (b == null) return 'var(--text-muted)';
  return b <= 0.15 ? 'var(--cyan-primary)' : b <= 0.25 ? 'var(--gold-primary)' : 'var(--alert-red)';
}

function ScoreTable({ title, rows }: { title: string; rows: Array<[string, { resolved: number; brier: number }]> }) {
  if (!rows.length) return null;
  const best = Math.min(...rows.map(([, s]) => s.brier));
  return (
    <div className="mb-3">
      <div className="text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5">{title}</div>
      {rows.sort((a, b) => a[1].brier - b[1].brier).map(([name, s]) => (
        <div key={name} className="flex items-center gap-2.5 text-[12px] py-1">
          <span className="w-[150px] truncate text-[var(--text-secondary)]">{s.brier === best && rows.length > 1 ? '👑 ' : ''}{name}</span>
          <div className="flex-1 h-1.5 rounded-full bg-[var(--hover-accent)] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${Math.max(4, 100 - s.brier * 200)}%`, background: brierColor(s.brier) }} />
          </div>
          <span className="font-mono" style={{ color: brierColor(s.brier) }}>{s.brier.toFixed(3)}</span>
          <span className="text-[11px] text-[var(--text-muted)]">n={s.resolved}</span>
        </div>
      ))}
    </div>
  );
}

export default function ScorecardPanel() {
  const [d, setD] = useState<Score | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch('/api/engine/scorecard');
        if (r.ok) { const j = await r.json(); if (!stop) setD(j); }
      } catch { /* engine offline */ }
      if (!stop) setLoading(false);
    };
    load();
    const iv = setInterval(load, 60000);
    return () => { stop = true; clearInterval(iv); };
  }, []);

  if (loading && !d) return <div className="py-5 text-center"><Loader2 className="w-4 h-4 animate-spin inline text-[var(--text-muted)]" /></div>;
  if (!d) return null;

  return (
    <div className="mb-3 rounded-xl border border-[var(--border-secondary)] p-4" style={{ background: 'rgba(255,255,255,.02)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4" style={{ color: 'var(--gold-primary)' }} />
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">Track record</span>
        <span className="text-[11px] text-[var(--text-muted)] ml-auto">{d.resolved} resolved · {d.open} open{d.due ? ` · ${d.due} due` : ''}</span>
      </div>

      {d.resolved === 0 ? (
        <div className="text-[12px] text-[var(--text-muted)] leading-relaxed py-2">
          No resolved forecasts yet. Every prediction goes on the record when it&apos;s made;
          an LLM judge grades it against the archived world once its horizon expires
          (24-hour forecasts resolve after a day). The receipts land here.
        </div>
      ) : (
        <>
          {/* Headline */}
          <div className="flex items-end gap-6 mb-3">
            <div>
              <div className="text-[26px] font-mono font-semibold leading-none" style={{ color: brierColor(d.brier) }}>{d.brier?.toFixed(3) ?? '—'}</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1" title="Mean squared error of resolved forecasts">Brier · 0 = prophecy · 0.25 = coin-flip</div>
            </div>
            <div>
              <div className="text-[20px] font-mono font-semibold leading-none text-[var(--text-primary)]">{d.hit_rate != null ? `${Math.round(d.hit_rate * 100)}%` : '—'}</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-1">calls right</div>
            </div>
          </div>

          {/* Calibration: predicted (x) vs observed (y) */}
          {d.calibration.length > 0 && (
            <div className="mb-3">
              <div className="text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5"
                title="Dots on the diagonal = perfectly calibrated. Above = things happen more often than predicted; below = less.">Calibration</div>
              <svg viewBox="0 0 100 56" className="w-full" style={{ maxHeight: 120 }}>
                <line x1="8" y1="48" x2="96" y2="48" stroke="var(--border-secondary)" strokeWidth="0.6" />
                <line x1="8" y1="48" x2="8" y2="4" stroke="var(--border-secondary)" strokeWidth="0.6" />
                <line x1="8" y1="48" x2="96" y2="4" stroke="var(--text-muted)" strokeWidth="0.5" strokeDasharray="2,2" opacity="0.5" />
                {d.calibration.map((c) => (
                  <circle key={c.bin} cx={8 + c.avg_predicted * 88} cy={48 - c.observed * 44}
                    r={Math.min(4.5, 1.5 + Math.sqrt(c.n))} fill="var(--gold-primary)" opacity="0.85">
                    <title>{c.bin}: predicted {Math.round(c.avg_predicted * 100)}%, happened {Math.round(c.observed * 100)}% (n={c.n})</title>
                  </circle>
                ))}
                <text x="8" y="54" fontSize="4.5" fill="var(--text-muted)">0%</text>
                <text x="88" y="54" fontSize="4.5" fill="var(--text-muted)">100%</text>
              </svg>
            </div>
          )}

          {/* Per horizon */}
          {Object.keys(d.per_horizon).length > 0 && (
            <div className="mb-3">
              <div className="text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5">By horizon</div>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {Object.entries(d.per_horizon).map(([h, s]) => (
                  <span key={h} className="text-[12px] flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: HCOLOR[h] || 'var(--text-muted)' }} />
                    <span style={{ color: HCOLOR[h] }}>{h}</span>
                    <span className="font-mono" style={{ color: brierColor(s.brier) }}>{s.brier.toFixed(2)}</span>
                    <span className="text-[11px] text-[var(--text-muted)]">n={s.resolved}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <ScoreTable title="The council · Brier per persona (weights their votes)" rows={Object.entries(d.personas)} />
          <ScoreTable title="Model bake-off · Brier per local model" rows={Object.entries(d.models)} />

          {/* Recent verdicts */}
          {d.recent.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5">Recent verdicts</div>
              {d.recent.slice(0, 8).map((r, i) => (
                <div key={i} className="text-[12px] py-1 flex items-start gap-2" title={r.evidence || ''}>
                  <span style={{ color: r.outcome >= 0.5 ? 'var(--cyan-primary)' : 'var(--alert-red)' }}>
                    {(r.probability >= 0.5) === (r.outcome >= 0.5) ? '✓' : '✗'}
                  </span>
                  <span className="text-[var(--text-secondary)] leading-snug flex-1">
                    <span style={{ color: HCOLOR[r.horizon] }}>[{r.horizon}]</span> <span className="font-mono">{Math.round(r.probability * 100)}%</span> — {r.statement.slice(0, 110)}{r.statement.length > 110 ? '…' : ''}
                    <span className="text-[var(--text-muted)]"> → {r.outcome >= 0.5 ? 'happened' : 'did not'}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
