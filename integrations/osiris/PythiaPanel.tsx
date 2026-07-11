'use client';

/**
 * PYTHIA — the oracle deck.
 * Osiris streams the live world; a local LLM forecasts what happens next.
 * Talks to the engine via the same-origin proxy at /api/engine/*.
 * Renders inside PanelModal on desktop (`embedded`) or the mobile sheet (`mobile`).
 */
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Radio, Loader2, Globe2, Hexagon, Target, FlaskConical, Gavel, CalendarDays, Sunrise } from 'lucide-react';
import DeliberationModal from './DeliberationModal';
import SwarmConfig from './SwarmConfig';
import ScorecardPanel from './ScorecardPanel';
import WhatIfPanel from './WhatIfPanel';
import CouncilChamber, { type Delib } from './CouncilChamber';
import ForecastCalendar from './ForecastCalendar';
import BriefPanel from './BriefPanel';
import RadarStrip from './RadarStrip';

type Agent = { name: string; probability: number; note?: string };
type Prediction = { id: string; statement: string; horizon: string; probability: number; reasoning: string; location?: string; lat?: number | null; lng?: number | null; agents?: Agent[]; base_probability?: number | null; prev_probability?: number | null; split?: boolean; ts?: number };
type World = { event_count: number; domains: Record<string, number>; top_events: string[] };
type Run = { stage: string; trigger: string; error?: string; elapsed_ms?: number };
type Snap = {
  config?: { llm_model?: string };
  generating?: boolean; loop_enabled?: boolean; last_run_ms?: number | null;
  world?: World | null; predictions?: Prediction[]; runs?: Run[];
  deliberation?: Delib | null;
};
type Score = { brier?: number | null; hit_rate?: number | null; resolved?: number; open?: number };

const E = (p: string) => `/api/engine${p}`;

const HORIZONS = [
  { key: '24h', label: 'Next 24 hours', color: 'var(--alert-red)' },
  { key: 'week', label: 'Next week', color: 'var(--gold-primary)' },
  { key: 'month', label: 'Next month', color: 'var(--cyan-primary)' },
  { key: 'year', label: 'Next year', color: 'var(--horizon-year)' },
];

const STAGE_LABEL: Record<string, string> = {
  queued: 'queued', sensing: 'reading the globe…', thinking: 'oracle forecasting…',
  deliberating: 'council deliberating…', done: 'done', error: 'error',
};

function timeago(ms?: number | null): string {
  if (!ms) return '—';
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

/** Small labeled toolbar button — icons alone read like a cockpit; labels read like a product. */
function ToolButton({ active, onClick, title, icon, label, disabled, activeColor = 'var(--gold-primary)' }: {
  active?: boolean; onClick: () => void; title: string; icon: React.ReactNode; label: string; disabled?: boolean; activeColor?: string;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-colors disabled:opacity-40"
      style={{
        background: active ? 'var(--hover-accent)' : 'rgba(255,255,255,.04)',
        color: active ? activeColor : 'var(--text-secondary)',
        border: `1px solid ${active ? 'var(--border-active)' : 'var(--border-secondary)'}`,
      }}>
      {icon}{label}
    </button>
  );
}

export default function PythiaPanel({ mobile = false, embedded = false, onLocate }: { mobile?: boolean; embedded?: boolean; onLocate?: (lat: number, lng: number) => void }) {
  const [snap, setSnap] = useState<Snap>({});
  const [connected, setConnected] = useState(false);
  const [selected, setSelected] = useState<Prediction | null>(null);
  const [showSwarm, setShowSwarm] = useState(false);
  const [showScore, setShowScore] = useState(false);
  const [showWhatIf, setShowWhatIf] = useState(false);
  const [showChamber, setShowChamber] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showBrief, setShowBrief] = useState(false);
  const [score, setScore] = useState<Score | null>(null);

  // the chamber opens itself when a deliberation goes live — that's the show
  const deliberating = !!snap.deliberation?.active;
  useEffect(() => { if (deliberating) setShowChamber(true); }, [deliberating]);

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
  const plain = mobile || embedded;

  return (
    <motion.div
      initial={plain ? false : { opacity: 0, x: 20 }}
      animate={plain ? undefined : { opacity: 1, x: 0 }}
      className={plain ? 'flex flex-col' : 'glass-panel p-3 pointer-events-auto flex flex-col max-h-[82vh] overflow-hidden'}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="flex items-center gap-2 text-[12px] text-[var(--text-secondary)] mr-auto">
          <span title={connected ? 'engine connected' : 'engine offline'} className="w-2 h-2 rounded-full shrink-0" style={{ background: connected ? 'var(--cyan-primary)' : 'var(--alert-red)' }} />
          <Globe2 className="w-3.5 h-3.5" />
          watching <span className="font-mono text-[var(--text-primary)]">{world?.event_count ?? '—'}</span> signals · {Object.keys(domains).length} domains
          <span className="text-[var(--text-muted)]">
            {snap.generating
              ? <span style={{ color: 'var(--gold-primary)' }}>{STAGE_LABEL[run?.stage || 'thinking'] || 'working…'}</span>
              : <>· updated {timeago(snap.last_run_ms)}</>}
          </span>
        </span>
        <ToolButton active={showBrief} onClick={() => setShowBrief(s => !s)} title="Morning Brief — the daily digest, on your schedule" icon={<Sunrise className="w-3.5 h-3.5" />} label="Brief" />
        <ToolButton active={showWhatIf} onClick={() => setShowWhatIf(s => !s)} title="Ask a hypothetical — the council deliberates the fallout" icon={<FlaskConical className="w-3.5 h-3.5" />} label="What if" />
        <ToolButton active={showChamber} onClick={() => setShowChamber(s => !s)} title="Council chamber — watch the deliberation live, vote by vote" icon={<Gavel className="w-3.5 h-3.5" />} label="Chamber" activeColor={deliberating ? 'var(--alert-red)' : undefined} />
        <ToolButton active={showCalendar} onClick={() => setShowCalendar(s => !s)} title="Calendar — when each forecast comes due" icon={<CalendarDays className="w-3.5 h-3.5" />} label="Calendar" />
        <ToolButton active={showScore} onClick={() => setShowScore(s => !s)} title="Track record — Brier score, calibration, verdicts" icon={<Target className="w-3.5 h-3.5" />} label="Record" />
        <ToolButton active={showSwarm} onClick={() => setShowSwarm(s => !s)} title="Council setup — pick a model for each persona" icon={<Hexagon className="w-3.5 h-3.5" />} label="Council" />
        <ToolButton active={snap.loop_enabled} onClick={toggleLoop} title="Re-forecast automatically on an interval" icon={<Radio className="w-3.5 h-3.5" />} label="Auto" activeColor="var(--cyan-primary)" />
        <button onClick={predictNow} disabled={snap.generating} title="Forecast the world now"
          className="flex items-center gap-1.5 h-8 px-4 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50"
          style={{ background: 'var(--gold-primary)', color: '#0E0A1E' }}>
          {snap.generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Predict
        </button>
      </div>

      {/* Live progress while the oracle senses → thinks → deliberates */}
      {snap.generating && (
        <div className="pythia-progress h-[3px] mb-3" title={STAGE_LABEL[run?.stage || 'thinking'] || 'working…'}>
          <div />
        </div>
      )}

      {/* Track record stat row */}
      {score?.resolved ? (
        <div className="grid grid-cols-4 gap-2 mb-3">
          {[
            { label: 'Brier score', value: score.brier != null ? score.brier.toFixed(3) : '—', hint: '0 = prophecy · 0.25 = coin-flip' },
            { label: 'Calls right', value: score.hit_rate != null ? `${Math.round(score.hit_rate * 100)}%` : '—', hint: 'directional accuracy of resolved forecasts' },
            { label: 'Resolved', value: `${score.resolved}`, hint: 'forecasts graded by the judge' },
            { label: 'Open', value: `${score.open ?? 0}`, hint: 'forecasts still inside their window' },
          ].map((s) => (
            <div key={s.label} title={s.hint} className="rounded-xl border border-[var(--border-secondary)] px-3 py-2" style={{ background: 'rgba(255,255,255,.02)' }}>
              <div className="text-[16px] font-mono font-semibold text-[var(--text-primary)] leading-tight">{s.value}</div>
              <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      ) : null}

      <RadarStrip onLocate={onLocate} />
      {showBrief && <BriefPanel />}
      {showSwarm && <SwarmConfig />}
      {showScore && <ScorecardPanel />}
      {showWhatIf && <WhatIfPanel />}
      {showChamber && <CouncilChamber delib={snap.deliberation} />}
      {showCalendar && <ForecastCalendar preds={preds} onPick={(p) => setSelected(p as Prediction)} />}

      {/* Predictions */}
      <div className={plain ? 'flex flex-col gap-4' : 'flex-1 min-h-0 overflow-y-auto flex flex-col gap-4 pr-1'}>
        {preds.length === 0 && (
          <div className="text-[12px] text-[var(--text-muted)] py-8 text-center leading-relaxed">
            {snap.generating
              ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> reading the globe & forecasting…</span>
              : <>No forecast yet. Hit <span className="text-[var(--gold-primary)] font-semibold">Predict</span> — the oracle reads every live feed and tells you what happens next.</>}
          </div>
        )}

        {HORIZONS.map((h) => {
          const list = preds.filter((p) => p.horizon === h.key).sort((a, b) => b.probability - a.probability);
          if (!list.length) return null;
          return (
            <div key={h.key}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: h.color }} />
                <span className="text-[11px] font-semibold tracking-wide" style={{ color: h.color }}>{h.label}</span>
              </div>
              <div className={embedded ? 'grid md:grid-cols-2 gap-2' : ''}>
              {list.map((p, cardIdx) => (
                <motion.div key={p.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(cardIdx * 0.05, 0.3) }}
                  onClick={() => { setSelected(p); }}
                  title="Open the council's deliberation"
                  className={`rounded-xl border border-[var(--border-secondary)] p-3 transition-colors cursor-pointer hover:border-[var(--border-active)] ${embedded ? '' : 'mb-2'}`}
                  style={{ background: 'rgba(255,255,255,.02)' }}>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[13px] text-[var(--text-primary)] leading-snug">{p.statement}</span>
                    <span className="text-[15px] font-mono font-semibold shrink-0 flex items-center gap-1.5" style={{ color: h.color }}>
                      {p.split && <span title="the council disagrees sharply" style={{ color: 'var(--alert-red)', fontSize: 10 }}>⚠</span>}
                      {p.prev_probability != null && Math.abs(p.probability - p.prev_probability) >= 0.03 && (
                        <span title={`was ${Math.round(p.prev_probability * 100)}% last pass`} style={{ fontSize: 10, color: p.probability > p.prev_probability ? 'var(--alert-red)' : 'var(--cyan-primary)' }}>
                          {p.probability > p.prev_probability ? '▲' : '▼'}{Math.abs(Math.round((p.probability - p.prev_probability) * 100))}
                        </span>
                      )}
                      {Math.round(p.probability * 100)}%
                    </span>
                  </div>
                  <div className="h-1 rounded-full bg-[var(--hover-accent)] mt-2 overflow-hidden">
                    <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${Math.round(p.probability * 100)}%`, background: h.color }} />
                  </div>
                  {p.reasoning && <div className="text-[11px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">{p.reasoning}</div>}
                  <div className="flex items-center justify-between mt-1.5">
                    {p.location
                      ? <button onClick={(e) => { e.stopPropagation(); if (p.lat != null && p.lng != null) onLocate?.(p.lat, p.lng); }}
                          className="text-[11px] flex items-center gap-1 hover:underline" style={{ color: h.color }}>
                          📍 {p.location}{p.lat != null ? ' →' : ''}
                        </button>
                      : <span />}
                    {p.agents && p.agents.length > 0 && (
                      <span className="text-[10px] text-[var(--text-muted)] flex items-center gap-1">
                        <Hexagon className="w-3 h-3" style={{ color: 'var(--gold-primary)' }} />
                        {p.agents.length} {p.agents.length === 1 ? 'voice' : 'voices'}{p.split ? ' · split' : ''}
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
              </div>
            </div>
          );
        })}
      </div>

      <DeliberationModal prediction={selected} onClose={() => setSelected(null)} onLocate={onLocate} />
    </motion.div>
  );
}
