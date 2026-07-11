'use client';

/** The Council Chamber — watch the deliberation happen.
 *  A live vote matrix: rows are the forecasts on the table, columns are the four
 *  personas. Cells fill in voice-by-voice as each specialist finishes arguing
 *  (streamed from STATE.deliberation via the deck's /state poll). Click any cell
 *  to read that voice's argument. Persists the last concluded session. */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Hexagon, Loader2, Gavel } from 'lucide-react';

type Vote = { i: number; p: number; note: string };
type Voice = { model: string; status: 'voting' | 'done' | 'silent'; votes: Vote[]; elapsed_ms?: number | null };
export type Delib = {
  ts: number; active: boolean; context: string;
  statements: { statement: string; horizon: string }[];
  voices: Record<string, Voice>;
  consensus?: { i: number; p: number; base?: number | null; split?: boolean }[];
};

const PERSONA_COLOR: Record<string, string> = {
  Strategist: 'var(--alert-red)', Economist: 'var(--gold-primary)',
  Naturalist: 'var(--cyan-primary)', Skeptic: 'var(--horizon-year)',
};
const HCOLOR: Record<string, string> = {
  '24h': 'var(--alert-red)', week: 'var(--gold-primary)', month: 'var(--cyan-primary)', year: 'var(--horizon-year)',
};

function timeago(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function CouncilChamber({ delib }: { delib: Delib | null | undefined }) {
  const [picked, setPicked] = useState<{ voice: string; i: number } | null>(null);

  if (!delib || !delib.statements?.length) {
    return (
      <div className="mb-3 rounded-xl border border-[var(--border-secondary)] p-4 text-[12px] text-[var(--text-muted)]" style={{ background: 'rgba(255,255,255,.02)' }}>
        No deliberation on record yet — hit <span className="text-[var(--gold-primary)] font-semibold">Predict</span> and
        the chamber fills in live as each voice argues.
      </div>
    );
  }

  const voiceNames = Object.keys(delib.voices);
  const votesByVoice: Record<string, Record<number, Vote>> = {};
  for (const [name, v] of Object.entries(delib.voices)) {
    votesByVoice[name] = Object.fromEntries((v.votes || []).map((vt) => [vt.i, vt]));
  }
  const consensusByI: Record<number, { p: number; split?: boolean }> =
    Object.fromEntries((delib.consensus || []).map((c) => [c.i, c]));
  const pickedNote = picked ? votesByVoice[picked.voice]?.[picked.i] : null;

  return (
    <div className="mb-3 rounded-xl border border-[var(--border-secondary)] p-4" style={{ background: 'rgba(255,255,255,.02)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Gavel className="w-4 h-4" style={{ color: 'var(--gold-primary)' }} />
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">Council chamber</span>
        {delib.active ? (
          <span className="flex items-center gap-1.5 text-[11px] font-medium" style={{ color: 'var(--alert-red)' }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--alert-red)' }} /> LIVE — deliberating
          </span>
        ) : (
          <span className="text-[11px] text-[var(--text-muted)]">concluded {timeago(delib.ts)}{delib.context === 'whatif' ? ' · hypothetical' : ''}</span>
        )}
        <span className="text-[11px] text-[var(--text-muted)] ml-auto">{delib.statements.length} forecasts · {voiceNames.length} voices</span>
      </div>

      {/* Voice status chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {voiceNames.map((name) => {
          const v = delib.voices[name];
          const color = PERSONA_COLOR[name] || 'var(--text-secondary)';
          return (
            <div key={name} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px]"
              style={{ borderColor: 'var(--border-secondary)', background: 'rgba(255,255,255,.02)' }}>
              <Hexagon className="w-3.5 h-3.5" style={{ color }} />
              <span className="font-semibold" style={{ color }}>{name}</span>
              {v.status === 'voting' && <span className="flex items-center gap-1 text-[var(--gold-primary)]"><Loader2 className="w-3 h-3 animate-spin" /> arguing…</span>}
              {v.status === 'done' && <span className="text-[var(--text-muted)]">{v.votes.length} votes{v.elapsed_ms ? ` · ${Math.round(v.elapsed_ms / 1000)}s` : ''}</span>}
              {v.status === 'silent' && <span style={{ color: 'var(--alert-orange, #FFA63D)' }}>no votes parsed</span>}
            </div>
          );
        })}
      </div>

      {/* The vote matrix */}
      <div className="overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th className="text-left text-[10px] font-medium text-[var(--text-muted)] pb-1.5 pr-2 w-[42%]">Forecast on the table</th>
              {voiceNames.map((n) => (
                <th key={n} className="text-center text-[10px] font-semibold pb-1.5 px-1" style={{ color: PERSONA_COLOR[n] || 'var(--text-secondary)' }}>{n.slice(0, 9)}</th>
              ))}
              <th className="text-center text-[10px] font-semibold text-[var(--text-primary)] pb-1.5 pl-1">Council</th>
            </tr>
          </thead>
          <tbody>
            {delib.statements.map((s, i) => {
              const cons = consensusByI[i];
              return (
                <tr key={i} className="border-t border-[var(--border-secondary)]">
                  <td className="py-2 pr-2 align-top">
                    <span className="text-[11px] leading-snug text-[var(--text-secondary)]">
                      <span className="font-medium" style={{ color: HCOLOR[s.horizon] || 'var(--text-muted)' }}>[{s.horizon}]</span> {s.statement}
                    </span>
                  </td>
                  {voiceNames.map((name) => {
                    const vt = votesByVoice[name]?.[i];
                    const v = delib.voices[name];
                    const color = PERSONA_COLOR[name] || 'var(--text-secondary)';
                    const isPicked = picked?.voice === name && picked?.i === i;
                    return (
                      <td key={name} className="text-center px-1 py-2 align-middle">
                        {vt ? (
                          <button
                            onClick={() => setPicked(isPicked ? null : { voice: name, i })}
                            title={vt.note || 'no argument recorded'}
                            className="inline-flex flex-col items-center gap-0.5 px-1.5 py-1 rounded-md transition-colors w-[52px]"
                            style={{ background: isPicked ? 'var(--hover-accent)' : 'transparent', border: `1px solid ${isPicked ? 'var(--border-active)' : 'transparent'}` }}
                          >
                            <motion.span key={`${name}-${i}-${vt.p}`} initial={{ opacity: 0, scale: 0.7 }} animate={{ opacity: 1, scale: 1 }}
                              className="text-[12px] font-mono font-semibold" style={{ color }}>
                              {Math.round(vt.p * 100)}%
                            </motion.span>
                            <span className="h-0.5 rounded-full w-full overflow-hidden" style={{ background: 'var(--hover-accent)' }}>
                              <span className="block h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.round(vt.p * 100)}%`, background: color }} />
                            </span>
                          </button>
                        ) : v.status === 'voting' ? (
                          <span className="inline-block w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--text-muted)' }} />
                        ) : (
                          <span className="text-[11px] text-[var(--text-muted)]">—</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-center pl-1 py-2 align-middle">
                    {cons ? (
                      <span className="text-[12px] font-mono font-bold text-[var(--text-primary)]">
                        {cons.split && <span title="sharp disagreement" style={{ color: 'var(--alert-red)', fontSize: 9 }}>⚠ </span>}
                        {Math.round(cons.p * 100)}%
                      </span>
                    ) : delib.active ? (
                      <span className="text-[11px] text-[var(--text-muted)]">…</span>
                    ) : (
                      <span className="text-[11px] text-[var(--text-muted)]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* The floor — the picked argument, verbatim */}
      <AnimatePresence>
        {picked && pickedNote && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="mt-2 rounded-lg border px-3 py-2.5" style={{ borderColor: 'var(--border-secondary)', background: 'var(--hover-accent)' }}>
              <div className="flex items-center gap-1.5 mb-1">
                <Hexagon className="w-3.5 h-3.5" style={{ color: PERSONA_COLOR[picked.voice] }} />
                <span className="text-[12px] font-semibold" style={{ color: PERSONA_COLOR[picked.voice] }}>{picked.voice}</span>
                <span className="text-[11px] font-mono text-[var(--text-muted)]">{Math.round(pickedNote.p * 100)}% on #{picked.i + 1}</span>
              </div>
              <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">“{pickedNote.note || 'no argument recorded for this vote'}”</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
