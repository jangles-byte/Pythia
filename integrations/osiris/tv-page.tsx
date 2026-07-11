'use client';

/** PYTHIA TV — kiosk mode for wall screens.
 *  Full-screen, zero chrome, auto-rotating boards (forecasts → signals → brief →
 *  markets) with the tickers pinned at the bottom. Click anywhere to advance;
 *  ?board=forecasts|signals|brief|markets pins one. Big type — readable across a room. */
import { useEffect, useState } from 'react';
import HeadlineTicker from '@/components/HeadlineTicker';
import MarketTicker from '@/components/MarketTicker';

type Pred = { id: string; statement: string; horizon: string; probability: number; location?: string; split?: boolean };
type Ev = { title: string; category: string; salience: number; source: string };
type Quote = { symbol: string; price: number; change_percent: number };

const HZC: Record<string, string> = { '24h': 'var(--alert-red)', week: 'var(--gold-primary)', month: 'var(--cyan-primary)', year: 'var(--horizon-year)' };
const BOARDS = ['forecasts', 'signals', 'brief', 'markets'] as const;
const ROTATE_MS = 25000;
const TICKER_SYMS = ['^GSPC', '^VIX', 'CL=F', 'GC=F', 'NG=F', 'BTC-USD', 'ZW=F', 'EURUSD=X'];
const NAME: Record<string, string> = { '^GSPC': 'S&P 500', '^VIX': 'VIX', 'CL=F': 'WTI Crude', 'GC=F': 'Gold', 'NG=F': 'Nat Gas', 'BTC-USD': 'Bitcoin', 'ZW=F': 'Wheat', 'EURUSD=X': 'EUR/USD' };

function Clock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const iv = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(iv); }, []);
  return (
    <span className="font-mono text-[15px] text-[var(--text-secondary)] tabular-nums">
      {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      <span className="text-[var(--text-muted)] ml-3">{now.toUTCString().slice(17, 22)}Z</span>
    </span>
  );
}

export default function TvPage() {
  const [board, setBoard] = useState(0);
  const [pinned, setPinned] = useState<number | null>(null);
  const [preds, setPreds] = useState<Pred[]>([]);
  const [evs, setEvs] = useState<Ev[]>([]);
  const [brief, setBrief] = useState<{ date: string; text: string } | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('board');
    const i = BOARDS.indexOf((q || '') as typeof BOARDS[number]);
    if (i >= 0) { setPinned(i); setBoard(i); }
  }, []);

  useEffect(() => {
    if (pinned != null) return;
    const iv = setInterval(() => setBoard((b) => (b + 1) % BOARDS.length), ROTATE_MS);
    return () => clearInterval(iv);
  }, [pinned]);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const s = await fetch('/api/engine/state').then((r) => (r.ok ? r.json() : null));
        if (s && !stop) setPreds(s.predictions || []);
      } catch { /* engine offline */ }
      try {
        const e = await fetch('/api/engine/agent/events?min_salience=0.7&limit=14').then((r) => (r.ok ? r.json() : null));
        if (e && !stop) setEvs(e.events || []);
      } catch { /* ignore */ }
      try {
        const b = await fetch('/api/engine/brief').then((r) => (r.ok ? r.json() : null));
        if (b?.latest && !stop) setBrief(b.latest);
      } catch { /* ignore */ }
      try {
        const qq = await fetch(`/api/quotes?symbols=${encodeURIComponent(TICKER_SYMS.join(','))}`).then((r) => (r.ok ? r.json() : null));
        if (qq && !stop) setQuotes(TICKER_SYMS.map((s2) => qq.quotes?.[s2]).filter(Boolean));
      } catch { /* ignore */ }
    };
    load();
    const iv = setInterval(load, 60000);
    return () => { stop = true; clearInterval(iv); };
  }, []);

  const top = [...preds].sort((a, b) => b.probability - a.probability).slice(0, 8);
  const name = BOARDS[board];

  return (
    <div className="fixed inset-0 overflow-hidden select-none" style={{ background: '#08060F' }}
      onClick={() => { setPinned(null); setBoard((b) => (b + 1) % BOARDS.length); }}>
      {/* header */}
      <div className="absolute top-0 left-0 right-0 flex items-center px-8 py-5 z-10">
        <img src="/pythia-logo.png" alt="" className="w-10 h-10 rounded-lg mr-4" />
        <span className="pythia-display text-[22px] tracking-[0.3em] text-[var(--gold-primary)]">PYTHIA</span>
        <span className="ml-4 text-[13px] text-[var(--text-muted)] tracking-widest uppercase">{name}</span>
        <span className="ml-auto"><Clock /></span>
      </div>

      {/* boards */}
      <div className="absolute inset-x-0 top-[84px] bottom-[68px] px-8 overflow-hidden">
        {name === 'forecasts' && (
          <div className="grid grid-cols-2 gap-4 h-full content-start">
            {top.map((p) => (
              <div key={p.id} className="rounded-2xl border border-[var(--border-secondary)] p-5" style={{ background: 'rgba(255,255,255,.025)' }}>
                <div className="flex items-start justify-between gap-4">
                  <span className="text-[19px] text-[var(--text-primary)] leading-snug">{p.statement}</span>
                  <span className="text-[30px] font-mono font-bold shrink-0" style={{ color: HZC[p.horizon] }}>{Math.round(p.probability * 100)}%</span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[13px] text-[var(--text-muted)]">
                  <span style={{ color: HZC[p.horizon] }}>{p.horizon}</span>
                  {p.location && <span>📍 {p.location}</span>}
                  {p.split && <span style={{ color: 'var(--alert-red)' }}>council split</span>}
                </div>
              </div>
            ))}
            {!top.length && <div className="text-[18px] text-[var(--text-muted)]">Waiting for the oracle…</div>}
          </div>
        )}

        {name === 'signals' && (
          <div className="flex flex-col gap-3 h-full content-start">
            {evs.map((e, i) => (
              <div key={i} className="flex items-center gap-4 rounded-xl border border-[var(--border-secondary)] px-5 py-3" style={{ background: 'rgba(255,255,255,.02)' }}>
                <span className="text-[12px] font-mono uppercase tracking-widest w-[110px] shrink-0 text-[var(--cyan-primary)]">{e.category}</span>
                <span className="text-[17px] text-[var(--text-primary)] truncate">{e.title}</span>
                <span className="ml-auto text-[12px] font-mono text-[var(--text-muted)] shrink-0">{e.source}</span>
              </div>
            ))}
            {!evs.length && <div className="text-[18px] text-[var(--text-muted)]">No high-salience signals right now.</div>}
          </div>
        )}

        {name === 'brief' && (
          <div className="h-full max-w-[900px] mx-auto">
            <div className="text-[14px] tracking-widest text-[var(--gold-primary)] mb-3 uppercase">Morning Brief {brief ? `· ${brief.date}` : ''}</div>
            <pre className="text-[17px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap font-[inherit] overflow-hidden">
              {brief?.text || 'No brief yet today.'}
            </pre>
          </div>
        )}

        {name === 'markets' && (
          <div className="grid grid-cols-4 gap-4 content-start">
            {quotes.map((q) => {
              const up = q.change_percent >= 0;
              return (
                <div key={q.symbol} className="rounded-2xl border border-[var(--border-secondary)] p-5" style={{ background: 'rgba(255,255,255,.025)' }}>
                  <div className="text-[14px] text-[var(--text-secondary)]">{NAME[q.symbol] || q.symbol}</div>
                  <div className="text-[30px] font-mono font-bold text-[var(--text-primary)] mt-1 tabular-nums">
                    {q.price >= 10000 ? (q.price / 1000).toFixed(1) + 'K' : q.price.toFixed(2)}
                  </div>
                  <div className="text-[16px] font-mono mt-1" style={{ color: up ? 'var(--alert-green)' : 'var(--alert-red)' }}>
                    {up ? '▲' : '▼'} {Math.abs(q.change_percent).toFixed(2)}%
                  </div>
                </div>
              );
            })}
            {!quotes.length && <div className="text-[18px] text-[var(--text-muted)]">Loading markets…</div>}
          </div>
        )}
      </div>

      {/* board dots */}
      <div className="absolute bottom-[74px] left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {BOARDS.map((b, i) => (
          <span key={b} className="w-1.5 h-1.5 rounded-full transition-colors" style={{ background: i === board ? 'var(--gold-primary)' : 'var(--border-secondary)' }} />
        ))}
      </div>

      <MarketTicker />
      <HeadlineTicker />
    </div>
  );
}
