'use client';

/** Forecast calendar — every open prediction lands on the day its window closes
 *  (made + horizon). Colored by horizon, click a day to see its docket, click a
 *  forecast to open the council's deliberation. */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';

type Pred = { id: string; statement: string; horizon: string; probability: number; ts?: number; location?: string };

const HORIZON_MS: Record<string, number> = {
  '24h': 86_400_000, week: 7 * 86_400_000, month: 30 * 86_400_000, year: 365 * 86_400_000,
};
const HCOLOR: Record<string, string> = {
  '24h': 'var(--alert-red)', week: 'var(--gold-primary)', month: 'var(--cyan-primary)', year: 'var(--horizon-year)',
};
const DOW = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export default function ForecastCalendar({ preds, onPick }: { preds: Pred[]; onPick: (p: Pred) => void }) {
  const now = new Date();
  const [view, setView] = useState<{ y: number; m: number }>({ y: now.getFullYear(), m: now.getMonth() });
  const [pickedDay, setPickedDay] = useState<string | null>(null);

  // due date per prediction → bucket by calendar day
  const byDay = useMemo(() => {
    const map: Record<string, (Pred & { due: Date })[]> = {};
    for (const p of preds) {
      if (!p.ts) continue;
      const due = new Date(p.ts + (HORIZON_MS[p.horizon] || HORIZON_MS.week));
      (map[dayKey(due)] ||= []).push({ ...p, due });
    }
    return map;
  }, [preds]);

  const first = new Date(view.y, view.m, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: startPad }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(view.y, view.m, i + 1)),
  ];
  const todayKey = dayKey(now);
  const monthCount = Object.entries(byDay).filter(([, l]) => l[0].due.getFullYear() === view.y && l[0].due.getMonth() === view.m)
    .reduce((n, [, l]) => n + l.length, 0);
  const docket = pickedDay ? byDay[pickedDay] || [] : [];

  const nav = (d: number) => {
    setPickedDay(null);
    setView(({ y, m }) => {
      const nm = m + d;
      return { y: y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });
  };

  return (
    <div className="mb-3 rounded-xl border border-[var(--border-secondary)] p-4" style={{ background: 'rgba(255,255,255,.02)' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <CalendarDays className="w-4 h-4" style={{ color: 'var(--gold-primary)' }} />
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">{MONTHS[view.m]} {view.y}</span>
        <span className="text-[11px] text-[var(--text-muted)]">{monthCount ? `${monthCount} forecasts come due` : 'no forecasts due this month'}</span>
        <div className="ml-auto flex items-center gap-1">
          <button onClick={() => nav(-1)} title="Previous month" className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-accent)] transition-colors"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => { setView({ y: now.getFullYear(), m: now.getMonth() }); setPickedDay(null); }} className="px-2 h-7 rounded-lg text-[11px] font-medium text-[var(--text-secondary)] hover:bg-[var(--hover-accent)] transition-colors">Today</button>
          <button onClick={() => nav(1)} title="Next month" className="w-7 h-7 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-accent)] transition-colors"><ChevronRight className="w-4 h-4" /></button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {DOW.map((d, i) => (
          <div key={i} className="text-center text-[10px] font-medium text-[var(--text-muted)] pb-1">{d}</div>
        ))}
        {cells.map((d, idx) => {
          if (!d) return <div key={`pad-${idx}`} />;
          const k = dayKey(d);
          const list = byDay[k] || [];
          const isToday = k === todayKey;
          const isPicked = k === pickedDay;
          return (
            <button
              key={k}
              onClick={() => setPickedDay(isPicked ? null : list.length ? k : null)}
              className="min-h-[58px] rounded-lg border p-1 flex flex-col items-stretch gap-0.5 text-left transition-colors"
              style={{
                borderColor: isPicked ? 'var(--border-active)' : isToday ? 'var(--gold-primary)' : 'var(--border-secondary)',
                background: isPicked ? 'var(--hover-accent)' : list.length ? 'rgba(255,255,255,.03)' : 'transparent',
                cursor: list.length ? 'pointer' : 'default',
              }}
            >
              <span className="text-[10px] font-mono leading-none" style={{ color: isToday ? 'var(--gold-primary)' : 'var(--text-muted)', fontWeight: isToday ? 700 : 400 }}>
                {d.getDate()}
              </span>
              <div className="flex flex-wrap gap-0.5 mt-auto">
                {list.slice(0, 4).map((p) => (
                  <motion.span
                    key={p.id}
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    title={`${Math.round(p.probability * 100)}% — ${p.statement}`}
                    className="w-2 h-2 rounded-full"
                    style={{ background: HCOLOR[p.horizon] || 'var(--text-muted)' }}
                  />
                ))}
                {list.length > 4 && <span className="text-[9px] font-mono text-[var(--text-muted)] leading-none">+{list.length - 4}</span>}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 mt-2.5">
        {Object.entries(HCOLOR).map(([h, c]) => (
          <span key={h} className="text-[10px] text-[var(--text-muted)] flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ background: c }} /> {h} due
          </span>
        ))}
      </div>

      {/* Day docket */}
      {pickedDay && docket.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-3 border-t border-[var(--border-secondary)] pt-2.5">
          <div className="text-[11px] font-semibold text-[var(--text-secondary)] mb-1.5">
            Due {docket[0].due.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          <div className="flex flex-col gap-1">
            {docket.map((p) => (
              <button key={p.id} onClick={() => onPick(p)}
                className="flex items-center justify-between gap-3 text-left px-2.5 py-1.5 rounded-lg hover:bg-[var(--hover-accent)] transition-colors border border-transparent hover:border-[var(--border-secondary)]">
                <span className="text-[12px] text-[var(--text-primary)] leading-snug truncate">
                  <span className="font-medium" style={{ color: HCOLOR[p.horizon] }}>[{p.horizon}]</span> {p.statement}
                </span>
                <span className="text-[12px] font-mono font-semibold shrink-0" style={{ color: HCOLOR[p.horizon] }}>{Math.round(p.probability * 100)}%</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
