'use client';

/** Floating ticker — your watched symbols in a movable window that stays up.
 *  Same engine-persisted watchlist as the Watch tab; add/remove here syncs there.
 *  Rendered inside FloatingWindow (like chat), placeable anywhere on screen. */
import { useEffect, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Plus, X } from 'lucide-react';

type Quote = { symbol: string; price: number; change_percent: number; spark: number[] };

function Spark({ pts, up }: { pts: number[]; up: boolean }) {
  if (!pts || pts.length < 2) return <span className="w-[54px]" />;
  const min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
  const d = pts.map((v, i) => `${(i / (pts.length - 1)) * 54},${16 - ((v - min) / span) * 14}`).join(' ');
  return (
    <svg viewBox="0 0 54 18" className="w-[54px] h-[18px] shrink-0">
      <polyline points={d} fill="none" strokeWidth="1.5" stroke={up ? 'var(--alert-green)' : 'var(--alert-red)'} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function fmt(p?: number): string {
  if (p == null) return '—';
  if (p >= 10000) return (p / 1000).toFixed(1) + 'K';
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(4);
}

export default function TickerWindow() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote | null>>({});
  const [input, setInput] = useState('');

  const load = useCallback(async () => {
    let syms: string[] = [];
    try {
      const w = await fetch('/api/engine/watch').then((r) => (r.ok ? r.json() : null));
      syms = w?.watchlist || [];
    } catch { /* engine offline */ }
    setSymbols(syms);
    if (syms.length) {
      try {
        const q = await fetch(`/api/quotes?symbols=${encodeURIComponent(syms.join(','))}`).then((r) => r.json());
        setQuotes(q.quotes || {});
      } catch { /* keep last */ }
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 45000);
    return () => clearInterval(iv);
  }, [load]);

  const add = async () => {
    const s = input.trim().toUpperCase();
    if (!s) return;
    setInput('');
    try { await fetch('/api/engine/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: s }) }); load(); } catch { /* offline */ }
  };
  const remove = async (s: string) => {
    try { await fetch(`/api/engine/watchlist/${encodeURIComponent(s)}`, { method: 'DELETE' }); load(); } catch { /* offline */ }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)]">
      <div className="flex-1 overflow-y-auto styled-scrollbar p-2">
        {symbols.map((s) => {
          const q = quotes[s];
          const up = (q?.change_percent ?? 0) >= 0;
          return (
            <div key={s} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[var(--hover-accent)] transition-colors group">
              <span className="text-[12px] font-mono font-semibold text-[var(--text-primary)] w-[76px] truncate shrink-0">{s}</span>
              <Spark pts={q?.spark || []} up={up} />
              <span className="text-[13px] font-mono text-[var(--text-primary)] tabular-nums ml-auto shrink-0">{fmt(q?.price)}</span>
              <span className={`text-[11px] font-mono font-medium w-[64px] text-right shrink-0 inline-flex items-center justify-end gap-0.5 ${up ? 'text-[var(--alert-green)]' : 'text-[var(--alert-red)]'}`}>
                {q ? <>{up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}{Math.abs(q.change_percent).toFixed(2)}%</> : '—'}
              </span>
              <button onClick={() => remove(s)} title="Remove" className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 text-[var(--text-muted)] hover:text-[var(--alert-red)]">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
        {!symbols.length && (
          <div className="text-[12px] text-[var(--text-muted)] p-3 leading-relaxed">
            Add anything Yahoo prices — AAPL, CL=F, BTC-USD, EURUSD=X. Synced with the Watch tab.
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 p-2 border-t border-[var(--border-secondary)]">
        <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
          placeholder="Add symbol…"
          className="flex-1 bg-[var(--hover-accent)] rounded-lg px-2.5 py-1.5 text-[12px] font-mono text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" />
        <button onClick={add} disabled={!input.trim()} title="Add"
          className="flex items-center justify-center w-8 h-8 rounded-lg disabled:opacity-40" style={{ background: 'var(--gold-primary)', color: '#0E0A1E' }}>
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
