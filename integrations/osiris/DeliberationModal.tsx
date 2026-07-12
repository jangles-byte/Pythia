'use client';

/**
 * MiroFish deliberation modal — the full story behind one prediction:
 * the swarm's consensus, how far the council split, each agent's vote + reasoning,
 * and the shift from the oracle's first guess to the swarm consensus.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useState as _useState } from 'react';
import { X, MapPin, Hexagon, TrendingUp, TrendingDown, ImageDown, Video } from 'lucide-react';
import { downloadShareCard } from '@/lib/shareCard';
import CamsNearby from './CamsNearby';

type Agent = { name: string; probability: number; note?: string; model?: string };
type Prediction = {
  id: string; statement: string; horizon: string; probability: number;
  reasoning?: string; location?: string; lat?: number | null; lng?: number | null;
  agents?: Agent[]; base_probability?: number | null; split?: boolean;
};

const HORIZON_COLOR: Record<string, string> = {
  '24h': 'var(--alert-red)', week: 'var(--gold-primary)',
  month: 'var(--cyan-primary)', year: 'var(--horizon-year)',
};
const HORIZON_LABEL: Record<string, string> = {
  '24h': 'Next 24 hours', week: 'Next week', month: 'Next month', year: 'Next year',
};
const AGENT_META: Record<string, { color: string; lens: string }> = {
  Strategist: { color: 'var(--alert-red)', lens: 'Geopolitics & conflict' },
  Economist: { color: 'var(--gold-primary)', lens: 'Markets & economy' },
  Naturalist: { color: 'var(--cyan-primary)', lens: 'Disasters & climate' },
  Skeptic: { color: 'var(--horizon-year)', lens: 'Base rates & doubt' },
};

// semicircle gauge path from 0..1
function arc(frac: number): string {
  const a = Math.PI - frac * Math.PI;            // 180° (left) -> 0° (right)
  const x = 100 + 80 * Math.cos(a);
  const y = 100 - 80 * Math.sin(a);
  const large = 0, sweep = 1;
  return `M 20 100 A 80 80 0 ${large} ${sweep} ${x.toFixed(2)} ${y.toFixed(2)}`;
}

export default function DeliberationModal({ prediction, onClose, onLocate }: {
  prediction: Prediction | null;
  onClose: () => void;
  onLocate?: (lat: number, lng: number) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [showCams, setShowCams] = _useState(false);
  useEffect(() => setMounted(true), []);
  const p = prediction;
  const color = p ? (HORIZON_COLOR[p.horizon] || 'var(--gold-primary)') : 'var(--gold-primary)';
  const agents = p?.agents || [];
  const ps = agents.map((a) => a.probability);
  const spread = ps.length ? Math.round((Math.max(...ps) - Math.min(...ps)) * 100) : 0;
  const agreement = spread >= 30 ? 'DIVIDED' : spread >= 15 ? 'MIXED' : 'ALIGNED';
  const agreeColor = spread >= 30 ? 'var(--alert-red)' : spread >= 15 ? 'var(--gold-primary)' : 'var(--cyan-primary)';
  const consensus = p ? Math.round(p.probability * 100) : 0;
  const base = typeof p?.base_probability === 'number' ? Math.round((p.base_probability || 0) * 100) : null;
  const delta = base != null ? consensus - base : null;

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {p && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[600] flex items-center justify-center p-3 bg-black/70 backdrop-blur-sm pointer-events-auto"
        >
          <motion.div
            initial={{ scale: 0.94, y: 12 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 12 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel w-[min(640px,94vw)] max-h-[90vh] overflow-y-auto styled-scrollbar p-5"
            style={{ borderRadius: 16 }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: 'var(--hover-accent)', color: 'var(--gold-primary)' }}><Hexagon className="w-4 h-4" /></span>
                <div>
                  <div className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight">Council deliberation</div>
                  <div className="text-[11px] text-[var(--text-muted)] leading-tight mt-0.5">how the MiroFish swarm weighed this forecast</div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => downloadShareCard({
                    kicker: `PYTHIA forecast · ${HORIZON_LABEL[p.horizon] || p.horizon}`,
                    headline: p.statement,
                    big: `${consensus}%`,
                    sub: agents.length ? `council consensus · ${agents.length} voices${p.split ? ' · split' : ''}` : (p.reasoning || '').slice(0, 90),
                    footer: `${p.location || ''} · ${new Date().toISOString().slice(0, 10)}`,
                  }, `pythia-forecast-${consensus}pct.png`)}
                  title="Download a share card (PNG)"
                  className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-accent)]"><ImageDown className="w-4 h-4" /></button>
                <button onClick={onClose} title="Close (Esc)" className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-accent)]"><X className="w-4 h-4" /></button>
              </div>
            </div>

            {/* Statement */}
            <div className="mb-4">
              <span className="text-[11px] font-semibold tracking-wide" style={{ color }}>{HORIZON_LABEL[p.horizon] || p.horizon}</span>
              <p className="text-[15px] text-[var(--text-primary)] leading-snug mt-1">{p.statement}</p>
            </div>

            {/* Consensus gauge */}
            <div className="flex items-center gap-4 rounded-xl border border-[var(--border-secondary)] p-4 mb-4" style={{ background: 'rgba(255,255,255,.02)' }}>
              <svg viewBox="0 0 200 112" className="w-[150px] shrink-0">
                <path d={arc(1)} fill="none" stroke="var(--border-primary)" strokeWidth="12" strokeLinecap="round" />
                <path d={arc(Math.min(1, Math.max(0, consensus / 100)))} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />
                <text x="100" y="86" textAnchor="middle" className="font-mono font-bold" style={{ fontSize: 30, fill: color }}>{consensus}%</text>
                <text x="100" y="104" textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--text-muted)' }}>consensus</text>
              </svg>
              <div className="flex-1 min-w-0 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: agreeColor }} />
                  <span className="text-[12px] font-semibold" style={{ color: agreeColor }}>{agreement.charAt(0) + agreement.slice(1).toLowerCase()}</span>
                  <span className="text-[11px] text-[var(--text-muted)]">{spread}-point spread · {agents.length} {agents.length === 1 ? 'voice' : 'voices'}</span>
                </div>
                {delta != null && (
                  <div className="text-[11px] text-[var(--text-secondary)] flex items-center gap-1.5">
                    oracle <span className="font-mono">{base}%</span>
                    {delta === 0 ? '·' : delta > 0 ? <TrendingUp className="w-3.5 h-3.5" style={{ color: 'var(--cyan-primary)' }} /> : <TrendingDown className="w-3.5 h-3.5" style={{ color: 'var(--alert-red)' }} />}
                    council <span className="font-mono">{consensus}%</span>
                    {delta !== 0 && <span className="font-mono" style={{ color: delta > 0 ? 'var(--cyan-primary)' : 'var(--alert-red)' }}>({delta > 0 ? '+' : ''}{delta})</span>}
                  </div>
                )}
                {p.reasoning && <p className="text-[11px] text-[var(--text-muted)] leading-relaxed">{p.reasoning}</p>}
              </div>
            </div>

            {/* Agreement spectrum */}
            {agents.length > 0 && (
              <div className="mb-4">
                <div className="text-[11px] font-semibold text-[var(--text-secondary)] mb-2">Where the council landed</div>
                <svg viewBox="0 0 300 46" className="w-full">
                  <line x1="10" y1="30" x2="290" y2="30" stroke="var(--border-primary)" strokeWidth="1" />
                  {[0, 25, 50, 75, 100].map((t) => (
                    <g key={t}>
                      <line x1={10 + t * 2.8} y1="27" x2={10 + t * 2.8} y2="33" stroke="var(--text-muted)" strokeWidth="1" />
                      <text x={10 + t * 2.8} y="43" textAnchor="middle" style={{ fontSize: 7, fill: 'var(--text-muted)' }}>{t}</text>
                    </g>
                  ))}
                  {/* consensus marker */}
                  <line x1={10 + consensus * 2.8} y1="14" x2={10 + consensus * 2.8} y2="30" stroke={color} strokeWidth="1.5" strokeDasharray="2 2" />
                  {/* agent dots */}
                  {agents.map((a, i) => {
                    const x = 10 + Math.round(a.probability * 100) * 2.8;
                    const m = AGENT_META[a.name] || { color: 'var(--text-secondary)' };
                    return <circle key={a.name} cx={x} cy="30" r="4" fill={m.color} stroke="#000" strokeWidth="0.5"
                      transform={`translate(0 ${(i % 2 ? 1 : -1) * 0})`}><title>{a.name}: {Math.round(a.probability * 100)}%</title></circle>;
                  })}
                </svg>
              </div>
            )}

            {/* The council */}
            {agents.length > 0 ? (
              <div className="flex flex-col gap-2 mb-4">
                <div className="text-[11px] font-semibold text-[var(--text-secondary)]">The council</div>
                {agents.map((a) => {
                  const m = AGENT_META[a.name] || { color: 'var(--text-secondary)', lens: '' };
                  const pct = Math.round(a.probability * 100);
                  return (
                    <div key={a.name} className="rounded-xl border border-[var(--border-secondary)] p-3" style={{ background: 'rgba(255,255,255,.02)' }}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <Hexagon className="w-3.5 h-3.5 shrink-0" style={{ color: m.color }} />
                          <span className="text-[13px] font-semibold" style={{ color: m.color }}>{a.name}</span>
                          <span className="text-[10px] text-[var(--text-muted)] truncate">{m.lens}</span>
                          {a.model && (
                            <span className="text-[9px] font-mono shrink-0 px-1.5 py-[2px] rounded truncate max-w-[110px]"
                              title={`this vote was cast by ${a.model}`}
                              style={{ background: 'rgba(255,255,255,.05)', color: 'var(--text-muted)', border: '1px solid var(--border-secondary)' }}>
                              {a.model}
                            </span>
                          )}
                        </div>
                        <span className="text-[14px] font-mono font-semibold shrink-0" style={{ color: m.color }}>{pct}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-[var(--hover-accent)] overflow-hidden">
                        <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, background: m.color }} />
                      </div>
                      {a.note && <p className="text-[11px] text-[var(--text-secondary)] mt-1.5 leading-relaxed">“{a.note}”</p>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[12px] text-[var(--text-muted)] text-center py-4 mb-2 leading-relaxed">
                The council didn’t deliberate this forecast this pass.<br />Check the council setup, or re-run the forecast.
              </div>
            )}

            {/* Location */}
            {p.location && (
              <div className="flex items-center justify-between gap-2 pt-3 border-t border-[var(--border-secondary)]">
                <span className="text-[12px] flex items-center gap-1.5" style={{ color }}><MapPin className="w-3.5 h-3.5" /> {p.location}</span>
                {p.lat != null && p.lng != null && (
                  <span className="flex items-center gap-1.5">
                    <button onClick={() => setShowCams(true)}
                      className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors hover:brightness-125 flex items-center gap-1"
                      style={{ background: 'var(--hover-accent)', color: 'var(--gold-primary)', border: '1px solid var(--border-secondary)' }}><Video className="w-3.5 h-3.5" /> Cams near</button>
                    <button onClick={() => { onLocate?.(p.lat as number, p.lng as number); onClose(); }}
                      className="text-[11px] font-medium px-3 py-1.5 rounded-lg transition-colors hover:brightness-125"
                      style={{ background: 'var(--hover-accent)', color: 'var(--gold-primary)', border: '1px solid var(--border-secondary)' }}>Fly to on globe →</button>
                  </span>
                )}
              </div>
            )}
            {showCams && p.lat != null && p.lng != null && (
              <CamsNearby lat={p.lat} lng={p.lng} label={p.location || p.statement.slice(0, 40)} onClose={() => setShowCams(false)} />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
