'use client';

/**
 * PYTHIA — the oracle deck.
 * Osiris streams the live world; a local LLM forecasts what happens next.
 * Talks to the engine via the same-origin proxy at /api/engine/*.
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Eye, Sparkles, Radio, Loader2, Globe2, Hexagon } from 'lucide-react';
import DeliberationModal from './DeliberationModal';
import SwarmConfig from './SwarmConfig';

type Agent = { name: string; probability: number; note?: string };
type Prediction = { id: string; statement: string; horizon: string; probability: number; reasoning: string; location?: string; lat?: number | null; lng?: number | null; agents?: Agent[]; base_probability?: number | null; split?: boolean };
type World = { event_count: number; domains: Record<string, number>; top_events: string[] };
type Run = { stage: string; trigger: string; error?: string; elapsed_ms?: number };
type Snap = {
  config?: { llm_model?: string };
  generating?: boolean; loop_enabled?: boolean; last_run_ms?: number | null;
  world?: World | null; predictions?: Prediction[]; runs?: Run[];
};
type Score = { brier?: number | null; hit_rate?: number | null; resolved?: number; open?: number };

const E = (p: string) => `/api/engine${p}`;

const HORIZONS = [
  { key: '24h', label: 'NEXT 24 HOURS', color: 'var(--alert-red)' },
  { key: 'week', label: 'NEXT WEEK', color: 'var(--gold-primary)' },
  { key: 'month', label: 'NEXT MONTH', color: 'var(--cyan-primary)' },
  { key: 'year', label: 'NEXT YEAR', color: 'var(--text-secondary)' },
];

const STAGE_LABEL: Record<string, string> = {
  queued: 'queued', sensing: 'reading the globe…', thinking: 'oracle forecasting…',
  deliberating: 'swarm deliberating…', done: 'done', error: 'error',
};


function timeago(ms?: number | null): string {
  if (!ms) return '—';
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function PythiaPanel({ mobile = false, onLocate }: { mobile?: boolean; onLocate?: (lat: number, lng: number) => void }) {
  const [snap, setSnap] = useState<Snap>({});
  const [connected, setConnected] = useState(false);
  const [selected, setSelected] = useState<Prediction | null>(null);
  const [showSwarm, setShowSwarm] = useState(false);
  const [score, setScore] = useState<Score | null>(null);

  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const r = await fetch(E('/state'));
        if (!r.ok) { if (!stop) setConnected(false); return; }
        const d = await r.json();
        if (!stop) { setSnap(d); setConnected(true); }
      } catch { if (!stop) setConnected(false); }
    };
    poll();
    const iv = setInterval(poll, 2500);
    return () => { stop = true; clearInterval(iv); };
  }, []);

  // Track record — resolved-forecast accuracy (updates slowly; poll once a minute)
  useEffect(() => {
    let stop = false;
    const poll = async () => {
      try {
        const r = await fetch(E('/scorecard'));
        if (r.ok) { const d = await r.json(); if (!stop) setScore(d); }
      } catch { /* engine offline — strip just hides */ }
    };
    poll();
    const iv = setInterval(poll, 60000);
    return () => { stop = true; clearInterval(iv); };
  }, []);

  const predictNow = async () => { await fetch(E('/predict'), { method: 'POST' }); };
  const toggleLoop = async () => {
    await fetch(E('/loop'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: !snap.loop_enabled }) });
  };

  const preds = snap.predictions || [];
  const world = snap.world;
  const domains = world?.domains || {};
  const run = (snap.runs || []).slice(-1)[0];

  return (
    <motion.div
      initial={mobile ? false : { opacity: 0, x: 20 }}
      animate={mobile ? undefined : { opacity: 1, x: 0 }}
      className={mobile ? 'flex flex-col' : 'glass-panel p-3 pointer-events-auto flex flex-col max-h-[82vh] overflow-hidden'}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Eye className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
          <span className="hud-text text-[12px] text-[var(--text-primary)]">PYTHIA</span>
          <span className="gotham-tag" style={{ fontSize: '7px', padding: '1px 5px', background: 'rgba(154,123,255,.16)', color: 'var(--gold-primary)', borderRadius: 3 }}>ORACLE</span>
        </div>
        <div className="flex items-center gap-2">
          <span title={connected ? 'engine connected' : 'engine offline'} className="w-1.5 h-1.5 rounded-full" style={{ background: connected ? 'var(--cyan-primary)' : 'var(--alert-red)' }} />
          <button onClick={() => setShowSwarm((s) => !s)} title="Swarm models — pick a model for each persona" className="flex items-center px-1.5 py-0.5 rounded" style={{ background: showSwarm ? 'rgba(154,123,255,.2)' : 'rgba(255,255,255,.05)', color: showSwarm ? 'var(--gold-primary)' : 'var(--text-muted)' }}>
            <Hexagon className="w-3 h-3" />
          </button>
          <button onClick={toggleLoop} title="Auto-refresh forecasts on an interval" className="flex items-center gap-1 text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: snap.loop_enabled ? 'rgba(45,245,200,.15)' : 'rgba(255,255,255,.05)', color: snap.loop_enabled ? 'var(--cyan-primary)' : 'var(--text-muted)' }}>
            <Radio className="w-3 h-3" /> AUTO
          </button>
          <button onClick={predictNow} disabled={snap.generating} title="Forecast the world now" className="flex items-center gap-1 text-[9px] font-mono font-bold px-2 py-0.5 rounded disabled:opacity-50" style={{ background: 'rgba(154,123,255,.2)', color: 'var(--gold-primary)' }}>
            {snap.generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />} PREDICT
          </button>
        </div>
      </div>

      {/* World-watch strip */}
      <div className="flex items-center justify-between text-[9px] font-mono mb-2 px-1 text-[var(--text-muted)]">
        <span className="flex items-center gap-1"><Globe2 className="w-3 h-3" /> watching <span className="text-[var(--text-primary)]">{world?.event_count ?? '—'}</span> signals · {Object.keys(domains).length} domains</span>
        <span>{snap.generating ? <span className="text-[var(--gold-primary)]">{STAGE_LABEL[run?.stage || 'thinking'] || 'working…'}</span> : <>updated {timeago(snap.last_run_ms)}</>}</span>
      </div>

      {/* Track record strip — how the oracle has actually done */}
      {score?.resolved ? (
        <div
          className="flex items-center justify-between text-[9px] font-mono mb-2 px-1 text-[var(--text-muted)]"
          title="Brier score = mean squared error of resolved forecasts — 0.0 is prophecy, 0.25 is coin-flipping. Each forecast is graded by an LLM judge when its horizon expires."
        >
          <span>⌾ track record · <span className="text-[var(--text-primary)]">Brier {score.brier ?? '—'}</span>{score.hit_rate != null ? <> · {Math.round(score.hit_rate * 100)}% calls right</> : null} · {score.resolved} resolved</span>
          <span>{score.open ?? 0} open</span>
        </div>
      ) : null}

      {showSwarm && <SwarmConfig />}

      {/* Predictions */}
      <div className={mobile ? 'flex flex-col gap-3' : 'overflow-y-auto flex flex-col gap-3 pr-1'}>
        {preds.length === 0 && (
          <div className="text-[10px] text-[var(--text-muted)] py-6 text-center leading-relaxed">
            {snap.generating
              ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> reading the globe & forecasting…</span>
              : <>No forecast yet.<br />Hit <span className="text-[var(--gold-primary)] font-bold">PREDICT</span> — the oracle reads every live feed and tells you what happens next.</>}
          </div>
        )}

        {HORIZONS.map((h) => {
          const list = preds.filter((p) => p.horizon === h.key).sort((a, b) => b.probability - a.probability);
          if (!list.length) return null;
          return (
            <div key={h.key}>
              <div className="flex items-center gap-1.5 mb-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: h.color }} />
                <span className="text-[9px] font-mono tracking-widest" style={{ color: h.color }}>{h.label}</span>
              </div>
              {list.map((p) => (
                <div key={p.id}
                  onClick={() => { setSelected(p); if (p.lat != null && p.lng != null) onLocate?.(p.lat, p.lng); }}
                  title="Open the swarm deliberation"
                  className="rounded-lg border border-[var(--border-secondary)] p-2 mb-1.5 transition-colors cursor-pointer hover:border-[var(--border-active)]"
                  style={{ background: 'rgba(255,255,255,.02)' }}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] text-[var(--text-primary)] leading-snug">{p.statement}</span>
                    <span className="text-[11px] font-mono font-bold shrink-0 flex items-center gap-1" style={{ color: h.color }}>{p.split && <span title="the swarm disagrees sharply" style={{ color: 'var(--alert-red)', fontSize: 8 }}>⚠</span>}{Math.round(p.probability * 100)}%</span>
                  </div>
                  <div className="h-1 rounded-full bg-[var(--hover-accent)] mt-1.5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${Math.round(p.probability * 100)}%`, background: h.color }} />
                  </div>
                  {p.reasoning && <div className="text-[8px] font-mono text-[var(--text-muted)] mt-1 leading-relaxed">{p.reasoning}</div>}
                  {p.location && <div className="text-[8px] font-mono mt-1 flex items-center gap-1" style={{ color: h.color }}>📍 {p.location}{p.lat != null ? ' · fly →' : ''}</div>}
                  {p.agents && p.agents.length > 0 && (
                    <div className="mt-1.5 text-[8px] font-mono flex items-center gap-1 text-[var(--text-muted)]">
                      <span style={{ color: 'var(--gold-primary)' }}>⬡</span> swarm · {p.agents.length} voices
                      {p.split && <span style={{ color: 'var(--alert-red)' }}> · split</span>}
                      <span className="text-[var(--text-secondary)] opacity-80">· tap for deliberation →</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <DeliberationModal prediction={selected} onClose={() => setSelected(null)} onLocate={onLocate} />
    </motion.div>
  );
}
