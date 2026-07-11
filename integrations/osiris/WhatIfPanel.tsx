'use client';

/** PYTHIA — the Hypothetical field.
 *  Ask "what if X happens?"; the oracle weighs it against the live world it can see,
 *  forecasts the knock-on effects, and — for whichever personas you check — the swarm
 *  deliberates on them. Ephemeral: nothing here enters the track record.
 *  Data: GET /api/engine/personas, POST /api/engine/whatif. */
import { useEffect, useState } from 'react';
import { FlaskConical, Loader2, Sparkles, Hexagon } from 'lucide-react';

type Agent = { name: string; probability: number; note?: string };
type Pred = { statement: string; horizon: string; probability: number; reasoning?: string; location?: string; agents?: Agent[]; split?: boolean };
type Result = { scenario: string; narrative: string; predictions: Pred[]; personas: string[] };
type Persona = { name: string; lens: string };

const E = (p: string) => `/api/engine${p}`;
const HCOLOR: Record<string, string> = { '24h': 'var(--alert-red)', week: 'var(--gold-primary)', month: 'var(--cyan-primary)', year: 'var(--horizon-year)' };
const FALLBACK: Persona[] = [
  { name: 'Strategist', lens: 'geopolitics, conflict & state actors' },
  { name: 'Economist', lens: 'markets, energy & the macro economy' },
  { name: 'Naturalist', lens: 'disasters, weather, seismic & health' },
  { name: 'Skeptic', lens: 'base rates & the null hypothesis' },
];

export default function WhatIfPanel() {
  const [scenario, setScenario] = useState('');
  const [roster, setRoster] = useState<Persona[]>(FALLBACK);
  const [checked, setChecked] = useState<Record<string, boolean>>(() => Object.fromEntries(FALLBACK.map((p) => [p.name, true])));
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pull the live persona roster so the checkboxes always match the engine's swarm.
  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const r = await fetch(E('/personas'));
        if (!r.ok) return;
        const j = await r.json();
        const list: Persona[] = j.personas || [];
        if (!stop && list.length) {
          setRoster(list);
          setChecked((prev) => Object.fromEntries(list.map((p) => [p.name, prev[p.name] ?? true])));
        }
      } catch { /* keep the hardcoded fallback roster */ }
    })();
    return () => { stop = true; };
  }, []);

  const toggle = (name: string) => setChecked((c) => ({ ...c, [name]: !c[name] }));

  const run = async () => {
    const s = scenario.trim();
    if (!s || busy) return;
    setBusy(true); setError(null); setResult(null);
    const personas = roster.map((p) => p.name).filter((n) => checked[n]);
    try {
      const r = await fetch(E('/whatif'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: s, personas }),
      });
      const j = await r.json();
      if (!r.ok) setError(j.detail || j.error || 'the oracle could not run that hypothetical');
      else setResult(j);
    } catch {
      setError('engine unreachable — is PYTHIA running?');
    } finally {
      setBusy(false);
    }
  };

  const anyChecked = roster.some((p) => checked[p.name]);

  return (
    <div className="rounded-xl border border-[var(--border-secondary)] p-4 mb-3" style={{ background: 'rgba(154,123,255,.05)' }}>
      <div className="flex items-center gap-2 mb-3">
        <FlaskConical className="w-4 h-4" style={{ color: 'var(--gold-primary)' }} />
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">Hypothetical</span>
        <span className="text-[11px] text-[var(--text-muted)] ml-auto">weighed against the live world · never recorded</span>
      </div>

      <textarea
        value={scenario}
        onChange={(e) => setScenario(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) run(); }}
        rows={2}
        placeholder="What if… the Strait of Hormuz closes tonight?"
        className="w-full resize-none bg-[var(--hover-accent)] rounded-lg px-3 py-2.5 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
      />

      <div className="flex flex-wrap items-center gap-2 mt-2.5">
        <span className="text-[11px] text-[var(--text-muted)]">Who deliberates:</span>
        {roster.map((p) => (
          <button
            key={p.name} onClick={() => toggle(p.name)} title={p.lens}
            className="text-[12px] font-medium px-2.5 py-1 rounded-full border transition-colors"
            style={{
              borderColor: checked[p.name] ? 'var(--border-active)' : 'var(--border-secondary)',
              background: checked[p.name] ? 'var(--hover-accent)' : 'transparent',
              color: checked[p.name] ? 'var(--gold-primary)' : 'var(--text-muted)',
            }}
          >
            {checked[p.name] ? '✓ ' : ''}{p.name}
          </button>
        ))}
      </div>

      <button
        onClick={run} disabled={busy || !scenario.trim()}
        className="mt-3 w-full flex items-center justify-center gap-2 text-[13px] font-semibold py-2.5 rounded-lg disabled:opacity-40 transition-colors"
        style={{ background: 'var(--gold-primary)', color: '#0E0A1E' }}
      >
        {busy
          ? <><Loader2 className="w-4 h-4 animate-spin" /> {anyChecked ? 'oracle + council deliberating…' : 'oracle forecasting…'}</>
          : <><Sparkles className="w-4 h-4" /> Run hypothetical</>}
      </button>

      {error && <div className="mt-2.5 text-[12px] text-[var(--alert-red)]">⚠ {error}</div>}

      {result && (
        <div className="mt-4">
          {result.narrative && (
            <div className="text-[13px] leading-relaxed text-[var(--text-secondary)] rounded-lg px-3 py-2.5 mb-3" style={{ background: 'rgba(255,255,255,.03)' }}>
              {result.narrative}
            </div>
          )}
          <div className="text-[11px] font-semibold text-[var(--text-secondary)] mb-2">
            Knock-on effects{result.personas?.length ? ` · ${result.personas.length} ${result.personas.length === 1 ? 'voice' : 'voices'} deliberated` : ''}
          </div>
          {result.predictions.length === 0 && (
            <div className="text-[12px] text-[var(--text-muted)]">The oracle returned no knock-on effects — try rephrasing the hypothetical.</div>
          )}
          {result.predictions.map((p, i) => {
            const color = HCOLOR[p.horizon] || 'var(--text-secondary)';
            return (
              <div key={i} className="rounded-xl border border-[var(--border-secondary)] p-3 mb-2" style={{ background: 'rgba(255,255,255,.02)' }}>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-[13px] text-[var(--text-primary)] leading-snug"><span className="font-medium" style={{ color }}>[{p.horizon}]</span> {p.statement}</span>
                  <span className="text-[15px] font-mono font-semibold shrink-0 flex items-center gap-1.5" style={{ color }}>
                    {p.split && <span title="the council disagrees sharply" style={{ color: 'var(--alert-red)', fontSize: 10 }}>⚠</span>}
                    {Math.round(p.probability * 100)}%
                  </span>
                </div>
                <div className="h-1 rounded-full bg-[var(--hover-accent)] mt-2 overflow-hidden">
                  <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.round(p.probability * 100)}%`, background: color }} />
                </div>
                {p.reasoning && <div className="text-[11px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">{p.reasoning}</div>}
                {p.location && <div className="text-[11px] mt-1.5" style={{ color }}>📍 {p.location}</div>}
                {p.agents && p.agents.length > 0 && (
                  <div className="mt-2.5 flex flex-col gap-1.5 border-t border-[var(--border-secondary)] pt-2.5">
                    {p.agents.map((a, j) => (
                      <div key={j} className="text-[11px] flex items-start gap-2">
                        <span className="shrink-0 flex items-center gap-1 font-medium" style={{ color: 'var(--gold-primary)', width: 88 }}><Hexagon className="w-3 h-3" /> {a.name}</span>
                        <span className="shrink-0 font-mono text-[var(--text-primary)]">{Math.round(a.probability * 100)}%</span>
                        {a.note && <span className="text-[var(--text-muted)] leading-snug">{a.note}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
