'use client';

/**
 * MiroFish deliberation modal — the full story behind one prediction:
 * the swarm's consensus, how far the council split, each agent's vote + reasoning,
 * and the shift from the oracle's first guess to the swarm consensus.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MapPin, Hexagon, TrendingUp, TrendingDown } from 'lucide-react';

type Agent = { name: string; probability: number; note?: string };
type Prediction = {
  id: string; statement: string; horizon: string; probability: number;
  reasoning?: string; location?: string; lat?: number | null; lng?: number | null;
  agents?: Agent[]; base_probability?: number | null; split?: boolean;
};

const HORIZON_COLOR: Record<string, string> = {
  '24h': 'var(--alert-red)', week: 'var(--gold-primary)',
  month: 'var(--cyan-primary)', year: 'var(--text-secondary)',
};
const HORIZON_LABEL: Record<string, string> = {
  '24h': 'NEXT 24 HOURS', week: 'NEXT WEEK', month: 'NEXT MONTH', year: 'NEXT YEAR',
};
const AGENT_META: Record<string, { color: string; lens: string }> = {
  Strategist: { color: 'var(--alert-red)', lens: 'Geopolitics & conflict' },
  Economist: { color: 'var(--gold-primary)', lens: 'Markets & economy' },
  Naturalist: { color: 'var(--cyan-primary)', lens: 'Disasters & climate' },
  Skeptic: { color: 'var(--text-secondary)', lens: 'Base rates & doubt' },
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
            className="glass-panel w-[min(560px,94vw)] max-h-[90vh] overflow-y-auto styled-scrollbar p-4"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-1.5">
                <Hexagon className="w-3.5 h-3.5" style={{ color: 'var(--gold-primary)' }} />
                <span className="pythia-display text-[11px] tracking-[0.22em] text-[var(--gold-primary)]">MIROFISH SWARM</span>
                <span className="text-[8px] font-mono text-[var(--text-muted)] tracking-widest">· DELIBERATION</span>
              </div>
              <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] -mt-1 -mr-1 p-1"><X className="w-4 h-4" /></button>
            </div>

            {/* Statement */}
            <div className="mb-3">
              <span className="text-[8px] font-mono tracking-widest" style={{ color }}>{HORIZON_LABEL[p.horizon] || p.horizon}</span>
              <p className="text-[13px] text-[var(--text-primary)] leading-snug mt-1">{p.statement}</p>
            </div>

            {/* Consensus gauge */}
            <div className="flex items-center gap-3 rounded-xl border border-[var(--border-secondary)] p-3 mb-3" style={{ background: 'rgba(255,255,255,.02)' }}>
              <svg viewBox="0 0 200 112" className="w-[140px] shrink-0">
                <path d={arc(1)} fill="none" stroke="var(--border-primary)" strokeWidth="12" strokeLinecap="round" />
                <path d={arc(Math.min(1, Math.max(0, consensus / 100)))} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round" />
                <text x="100" y="86" textAnchor="middle" className="font-mono font-bold" style={{ fontSize: 30, fill: color }}>{consensus}%</text>
                <text x="100" y="104" textAnchor="middle" style={{ fontSize: 9, fill: 'var(--text-muted)', letterSpacing: 1 }}>CONSENSUS</text>
              </svg>
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: agreeColor }} />
                  <span className="text-[10px] font-mono font-bold" style={{ color: agreeColor }}>{agreement}</span>
                  <span className="text-[8px] font-mono text-[var(--text-muted)]">· {spread}pt spread · {agents.length} voices</span>
                </div>
                {delta != null && (
                  <div className="text-[9px] font-mono text-[var(--text-secondary)] flex items-center gap-1">
                    oracle {base}% {delta === 0 ? '·' : delta > 0 ? <TrendingUp className="w-3 h-3" style={{ color: 'var(--cyan-primary)' }} /> : <TrendingDown className="w-3 h-3" style={{ color: 'var(--alert-red)' }} />} swarm {consensus}%
                    {delta !== 0 && <span style={{ color: delta > 0 ? 'var(--cyan-primary)' : 'var(--alert-red)' }}>({delta > 0 ? '+' : ''}{delta})</span>}
                  </div>
                )}
                {p.reasoning && <p className="text-[9px] font-mono text-[var(--text-muted)] leading-relaxed">{p.reasoning}</p>}
              </div>
            </div>

            {/* Agreement spectrum */}
            {agents.length > 0 && (
              <div className="mb-3">
                <div className="text-[8px] font-mono tracking-widest text-[var(--text-muted)] mb-2">WHERE THE COUNCIL LANDED</div>
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
              <div className="flex flex-col gap-2 mb-3">
                <div className="text-[8px] font-mono tracking-widest text-[var(--text-muted)]">THE COUNCIL</div>
                {agents.map((a) => {
                  const m = AGENT_META[a.name] || { color: 'var(--text-secondary)', lens: '' };
                  const pct = Math.round(a.probability * 100);
                  return (
                    <div key={a.name} className="rounded-lg border border-[var(--border-secondary)] p-2" style={{ background: 'rgba(255,255,255,.02)' }}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Hexagon className="w-3 h-3 shrink-0" style={{ color: m.color }} />
                          <span className="text-[10px] font-bold" style={{ color: m.color }}>{a.name}</span>
                          <span className="text-[7px] font-mono text-[var(--text-muted)] truncate">{m.lens}</span>
                        </div>
                        <span className="text-[11px] font-mono font-bold shrink-0" style={{ color: m.color }}>{pct}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-[var(--hover-accent)] overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: m.color }} />
                      </div>
                      {a.note && <p className="text-[8px] font-mono text-[var(--text-secondary)] mt-1 leading-relaxed">“{a.note}”</p>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-[9px] font-mono text-[var(--text-muted)] text-center py-3 mb-2">
                The swarm didn’t deliberate this forecast this pass.<br />Switch to a larger model for full council coverage.
              </div>
            )}

            {/* Location */}
            {p.location && (
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border-secondary)]">
                <span className="text-[9px] font-mono flex items-center gap-1" style={{ color }}><MapPin className="w-3 h-3" /> {p.location}</span>
                {p.lat != null && p.lng != null && (
                  <button
                    onClick={() => { onLocate?.(p.lat as number, p.lng as number); onClose(); }}
                    className="text-[8px] font-mono px-2 py-1 rounded transition-colors hover:brightness-125"
                    style={{ background: 'rgba(154,123,255,.18)', color: 'var(--gold-primary)' }}
                  >fly to on globe →</button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
