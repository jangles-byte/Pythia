'use client';

/** Floating SEC filings tape — live insider trades (Form 4) + material events (8-K)
 *  across ALL public companies, straight from EDGAR (keyless). Rendered inside
 *  FloatingWindow like chat/ticker, placeable anywhere and left up 24/7. */
import { useEffect, useState, useCallback } from 'react';
import { ArrowUpRight, ArrowDownRight, Gift, Repeat, Circle, ExternalLink } from 'lucide-react';

type Insider = {
  owner: string; company: string; ticker: string;
  action: 'BUY' | 'SELL' | 'GRANT' | 'EXERCISE' | 'OTHER';
  shares: number; value: number; filed: string; url: string;
};
type Event = { company: string; cik: string; filed: string; url: string };

const money = (v: number): string =>
  v >= 1e9 ? '$' + (v / 1e9).toFixed(2) + 'B'
    : v >= 1e6 ? '$' + (v / 1e6).toFixed(2) + 'M'
    : v >= 1e3 ? '$' + (v / 1e3).toFixed(0) + 'K'
    : v > 0 ? '$' + v : '—';

const shares = (n: number): string =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(0) + 'K' : String(n);

const ACT: Record<Insider['action'], { c: string; Icon: typeof Circle; label: string }> = {
  BUY: { c: 'var(--alert-green)', Icon: ArrowUpRight, label: 'BUY' },
  SELL: { c: 'var(--alert-red)', Icon: ArrowDownRight, label: 'SELL' },
  GRANT: { c: 'var(--text-muted)', Icon: Gift, label: 'GRANT' },
  EXERCISE: { c: 'var(--text-muted)', Icon: Repeat, label: 'EXER' },
  OTHER: { c: 'var(--text-muted)', Icon: Circle, label: '·' },
};

export default function FilingsWindow() {
  const [tab, setTab] = useState<'insider' | 'events'>('insider');
  const [insider, setInsider] = useState<Insider[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [filter, setFilter] = useState<'all' | 'buys' | 'sells'>('all');
  const [loading, setLoading] = useState(true);
  const [ts, setTs] = useState(0);

  const load = useCallback(async () => {
    try {
      const d = await fetch('/api/edgar').then(r => r.json());
      setInsider(d.insider || []);
      setEvents(d.events || []);
      setTs(d.ts || Date.now());
    } catch { /* keep last */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 150000); // route caches ~150s; match it
    return () => clearInterval(iv);
  }, [load]);

  const rows = insider.filter(x =>
    filter === 'all' ? true : filter === 'buys' ? x.action === 'BUY' : x.action === 'SELL');

  return (
    <div className="flex flex-col h-full text-[var(--text-primary)]">
      {/* Tabs inlined (NOT a nested component): the floating window re-renders on
          mousedown to raise itself, which would remount a nested component between
          press and release and swallow the click. */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--border-subtle)]">
        {(['insider', 'events'] as const).map(id => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={`px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wide transition-colors ${
              tab === id ? 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--hover-accent)]'}`}>
            {id === 'insider' ? `INSIDER · ${insider.length}` : `8-K · ${events.length}`}
          </button>
        ))}
        <span className="ml-auto text-[9px] font-mono text-[var(--text-muted)] pr-1">
          {ts ? 'SEC EDGAR · ' + new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </span>
      </div>

      {tab === 'insider' && (
        <div className="flex items-center gap-1 px-2 py-1 border-b border-[var(--border-subtle)]">
          {(['all', 'buys', 'sells'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase transition-colors ${
                filter === f ? 'text-[var(--text-primary)] bg-[var(--hover-accent)]' : 'text-[var(--text-muted)] hover:text-[var(--text-secondary)]'}`}>
              {f}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading && <div className="p-4 text-center text-[10px] font-mono text-[var(--text-muted)]">reading the tape…</div>}

        {tab === 'insider' && rows.map((x, i) => {
          const a = ACT[x.action];
          return (
            <a key={i} href={x.url} target="_blank" rel="noreferrer"
              className="group flex items-center gap-2 px-2.5 py-1.5 border-b border-[var(--border-subtle)]/50 hover:bg-[var(--hover-accent)]">
              <a.Icon className="w-3.5 h-3.5 shrink-0" style={{ color: a.c }} />
              <span className="w-9 text-[9px] font-mono font-semibold shrink-0" style={{ color: a.c }}>{a.label}</span>
              <span className="w-12 text-[11px] font-mono font-bold shrink-0">{x.ticker || '—'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] truncate leading-tight">{x.company}</div>
                <div className="text-[9px] text-[var(--text-muted)] truncate leading-tight">{x.owner}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[11px] font-mono font-semibold" style={{ color: x.value > 0 ? a.c : 'var(--text-muted)' }}>{money(x.value)}</div>
                <div className="text-[9px] font-mono text-[var(--text-muted)]">{shares(x.shares)}sh</div>
              </div>
              <ExternalLink className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 shrink-0" />
            </a>
          );
        })}
        {tab === 'insider' && !loading && rows.length === 0 &&
          <div className="p-4 text-center text-[10px] font-mono text-[var(--text-muted)]">no {filter === 'all' ? '' : filter + ' '}filings in the latest tape</div>}

        {tab === 'events' && events.map((e, i) => (
          <a key={i} href={e.url} target="_blank" rel="noreferrer"
            className="group flex items-center gap-2 px-2.5 py-1.5 border-b border-[var(--border-subtle)]/50 hover:bg-[var(--hover-accent)]">
            <span className="px-1.5 py-0.5 rounded text-[8px] font-mono font-bold shrink-0 bg-[var(--cyan-primary)]/15 text-[var(--cyan-primary)]">8-K</span>
            <span className="flex-1 min-w-0 text-[11px] truncate">{e.company}</span>
            <span className="text-[9px] font-mono text-[var(--text-muted)] shrink-0">{e.filed}</span>
            <ExternalLink className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 shrink-0" />
          </a>
        ))}
      </div>

      <div className="px-2.5 py-1 border-t border-[var(--border-subtle)] text-[8px] font-mono text-[var(--text-muted)] leading-tight">
        Live from SEC EDGAR · all public companies · not investment advice
      </div>
    </div>
  );
}
