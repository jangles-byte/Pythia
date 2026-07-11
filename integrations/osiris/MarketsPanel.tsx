'use client';

/** Markets & intel — live tickers, futures, crowd odds and space weather.
 *  Renders inside PanelModal (desktop) or the mobile sheet — the container
 *  provides the chrome, so this is just the content. */
import { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, Zap, Shield, Droplets, Gem, Bitcoin, LineChart, Percent, Star, Eye, X, Plus,
} from 'lucide-react';

interface MarketsPanelProps { data: any; spaceWeather?: any; }

const SECTIONS = [
  { key: 'watch', label: 'Watch', icon: Star },
  { key: 'indices', label: 'Indices', icon: LineChart },
  { key: 'stocks', label: 'Defense', icon: Shield },
  { key: 'oil', label: 'Energy', icon: Droplets },
  { key: 'commodities', label: 'Commodities', icon: Gem },
  { key: 'crypto', label: 'Crypto', icon: Bitcoin },
  { key: 'odds', label: 'Odds', icon: Percent },
];

// ── the Watch tab: your symbols + PYTHIA's Watch (forecast-linked tickers) ──
type Quote = { symbol: string; price: number; change_percent: number; spark: number[] };
type WatchHit = { symbol: string; theme: string; why: string; horizon: string; probability: number };
const HZC: Record<string, string> = { '24h': 'var(--alert-red)', week: 'var(--gold-primary)', month: 'var(--cyan-primary)', year: 'var(--horizon-year)' };

function Spark({ pts, up }: { pts: number[]; up: boolean }) {
  if (!pts || pts.length < 2) return <span className="w-[64px]" />;
  const min = Math.min(...pts), max = Math.max(...pts), span = max - min || 1;
  const d = pts.map((v, i) => `${(i / (pts.length - 1)) * 64},${18 - ((v - min) / span) * 16}`).join(' ');
  return (
    <svg viewBox="0 0 64 20" className="w-[64px] h-[20px] shrink-0">
      <polyline points={d} fill="none" strokeWidth="1.5" stroke={up ? 'var(--alert-green)' : 'var(--alert-red)'} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function fmtPrice(p?: number): string {
  if (p == null) return '—';
  if (p >= 10000) return (p / 1000).toFixed(1) + 'K';
  if (p >= 1) return p.toFixed(2);
  return p.toFixed(4);
}

function WatchTab() {
  const [symbols, setSymbols] = useState<string[]>([]);
  const [hits, setHits] = useState<WatchHit[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote | null>>({});
  const [input, setInput] = useState('');
  const [engineUp, setEngineUp] = useState(true);

  const load = useCallback(async () => {
    let syms: string[] = [];
    let watchHits: WatchHit[] = [];
    try {
      const w = await fetch('/api/engine/watch').then((r) => (r.ok ? r.json() : Promise.reject()));
      syms = w.watchlist || [];
      watchHits = w.pythia_watch || [];
      setEngineUp(true);
    } catch { setEngineUp(false); }
    setSymbols(syms);
    setHits(watchHits);
    const all = [...new Set([...syms, ...watchHits.map((h) => h.symbol)])];
    if (all.length) {
      try {
        const q = await fetch(`/api/quotes?symbols=${encodeURIComponent(all.join(','))}`).then((r) => r.json());
        setQuotes(q.quotes || {});
      } catch { /* keep last prices */ }
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 60000);
    return () => clearInterval(iv);
  }, [load]);

  const add = async () => {
    const s = input.trim().toUpperCase();
    if (!s) return;
    setInput('');
    try {
      await fetch('/api/engine/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: s }) });
      load();
    } catch { /* engine offline */ }
  };
  const remove = async (s: string) => {
    try { await fetch(`/api/engine/watchlist/${encodeURIComponent(s)}`, { method: 'DELETE' }); load(); } catch { /* offline */ }
  };

  const Row = ({ s, extra }: { s: string; extra?: React.ReactNode }) => {
    const q = quotes[s];
    const up = (q?.change_percent ?? 0) >= 0;
    return (
      <div className="flex items-center gap-3 py-2 px-2.5 rounded-lg hover:bg-[var(--hover-accent)] transition-colors group">
        <span className="text-[12px] font-mono font-semibold text-[var(--text-primary)] w-[86px] shrink-0 truncate">{s}</span>
        <Spark pts={q?.spark || []} up={up} />
        <span className="text-[13px] font-mono text-[var(--text-primary)] tabular-nums w-[76px] text-right shrink-0">{fmtPrice(q?.price)}</span>
        <span className={`text-[11px] font-mono font-medium w-[72px] shrink-0 flex items-center gap-0.5 justify-end ${up ? 'text-[var(--alert-green)]' : 'text-[var(--alert-red)]'}`}>
          {q ? <>{up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}{q.change_percent > 0 ? '+' : ''}{q.change_percent.toFixed(2)}%</> : '—'}
        </span>
        <span className="flex-1 min-w-0">{extra}</span>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-1">
      {!engineUp && <div className="text-[11px] text-[var(--text-muted)] px-2.5 pb-1">engine offline — showing prices only when it returns</div>}

      {/* your list */}
      <div className="flex items-center gap-2 px-2.5 pb-1">
        <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Your watchlist</span>
        <div className="ml-auto flex items-center gap-1.5">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            placeholder="AAPL · CL=F · BTC-USD" className="w-[150px] bg-[var(--hover-accent)] rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]" />
          <button onClick={add} title="Add to watchlist" className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors" style={{ background: 'var(--hover-accent)', color: 'var(--gold-primary)' }}><Plus className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      {symbols.map((s) => (
        <Row key={s} s={s} extra={
          <button onClick={() => remove(s)} title="Remove" className="opacity-0 group-hover:opacity-100 transition-opacity float-right text-[var(--text-muted)] hover:text-[var(--alert-red)]"><X className="w-3.5 h-3.5" /></button>
        } />
      ))}
      {!symbols.length && <div className="text-[12px] text-[var(--text-muted)] px-2.5 py-3">No symbols yet — add anything Yahoo prices: stocks, CL=F futures, BTC-USD, EURUSD=X.</div>}

      {/* PYTHIA's Watch */}
      <div className="flex items-center gap-1.5 px-2.5 pt-3 pb-1 border-t border-[var(--border-secondary)] mt-2">
        <Eye className="w-3.5 h-3.5" style={{ color: 'var(--gold-primary)' }} />
        <span className="text-[11px] font-semibold text-[var(--text-secondary)]">PYTHIA&apos;s Watch</span>
        <span className="text-[10px] text-[var(--text-muted)]">· tickers the oracle&apos;s live forecasts touch</span>
      </div>
      {hits.map((h) => (
        <div key={h.symbol} className="px-2.5 py-2 rounded-lg hover:bg-[var(--hover-accent)] transition-colors">
          <Row s={h.symbol} extra={
            <span className="text-[10px] px-1.5 py-[2px] rounded-full float-right" style={{ background: 'var(--hover-accent)', color: 'var(--gold-primary)', border: '1px solid var(--border-secondary)' }}>{h.theme}</span>
          } />
          <div className="text-[11px] text-[var(--text-muted)] leading-snug pl-2.5 -mt-1">
            <span className="font-mono" style={{ color: HZC[h.horizon] || 'var(--text-muted)' }}>[{h.horizon}] {Math.round(h.probability * 100)}%</span> — {h.why}
          </div>
        </div>
      ))}
      {!hits.length && engineUp && <div className="text-[12px] text-[var(--text-muted)] px-2.5 py-3">Nothing flagged yet — run a forecast and the oracle&apos;s picks land here with the reason.</div>}
    </div>
  );
}

// Crowd odds — real-money (Polymarket) + play-money (Manifold) probabilities of
// future events. These are the same anchors PYTHIA's oracle reads.
type Odd = { question: string; yes_prob: number; volume: number; url?: string; src: 'POLY' | 'MANI' };

function OddRow({ o }: { o: Odd }) {
  const pct = Math.round(o.yes_prob * 100);
  const vol = o.volume >= 1e6 ? `$${(o.volume / 1e6).toFixed(1)}M` : o.volume >= 1e3 ? `$${Math.round(o.volume / 1e3)}K` : `$${o.volume}`;
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-[12px] text-[var(--text-primary)] leading-snug flex-1">{o.question}</span>
        <span className="text-[14px] font-mono font-semibold tabular-nums shrink-0 text-[var(--gold-primary)]">{pct}%<span className="text-[9px] text-[var(--text-muted)] ml-1">yes</span></span>
      </div>
      <div className="h-1 rounded-full bg-[var(--hover-accent)] mt-1.5 overflow-hidden">
        <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, background: 'var(--gold-primary)' }} />
      </div>
      <div className="flex items-center justify-between mt-1 text-[10px] text-[var(--text-muted)]">
        <span>{o.src === 'POLY' ? 'Polymarket · real money' : 'Manifold'}</span>
        <span className="font-mono">{vol} vol</span>
      </div>
    </>
  );
  return o.url
    ? <a href={o.url} target="_blank" rel="noreferrer" className="block py-2 px-2.5 rounded-lg hover:bg-[var(--hover-accent)] transition-colors">{inner}</a>
    : <div className="py-2 px-2.5 rounded-lg">{inner}</div>;
}

function Ticker({ name, data: d }: { name: string; data: any }) {
  if (!d) return null;
  return (
    <div className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-[var(--hover-accent)] transition-colors border border-transparent hover:border-[var(--border-secondary)]">
      <span className="text-[12px] text-[var(--text-secondary)]">{name}</span>
      <div className="flex items-center gap-2.5">
        <span className="text-[13px] font-mono font-semibold text-[var(--text-primary)] tabular-nums">
          {d.price >= 1000 ? `${(d.price / 1000).toFixed(1)}K` : d.price?.toFixed(2)}
        </span>
        <span className={`text-[11px] font-mono font-medium flex items-center gap-0.5 min-w-[64px] justify-end ${d.up ? 'text-[var(--alert-green)]' : 'text-[var(--alert-red)]'}`}>
          {d.up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
          {d.change_percent > 0 ? '+' : ''}{d.change_percent?.toFixed(2)}%
        </span>
      </div>
    </div>
  );
}

export default function MarketsPanel({ data, spaceWeather }: MarketsPanelProps) {
  const [activeSection, setActiveSection] = useState('watch');
  const markets = data.markets || {};

  // Crowd odds (Polymarket + Manifold) — fetched here so the tab is always current
  const [odds, setOdds] = useState<Odd[]>([]);
  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const [pm, mf] = await Promise.all([
          fetch('/api/polymarket').then(r => (r.ok ? r.json() : { markets: [] })).catch(() => ({ markets: [] })),
          fetch('/api/manifold').then(r => (r.ok ? r.json() : { markets: [] })).catch(() => ({ markets: [] })),
        ]);
        const rows: Odd[] = [
          ...(pm.markets || []).map((m: any) => ({ question: m.question, yes_prob: m.yes_prob, volume: m.volume || 0, url: m.url, src: 'POLY' as const })),
          ...(mf.markets || []).map((m: any) => ({ question: m.question, yes_prob: m.yes_prob, volume: m.volume || 0, url: m.url, src: 'MANI' as const })),
        ].filter(o => o.question && typeof o.yes_prob === 'number');
        rows.sort((a, b) => b.volume - a.volume);
        if (!stop && rows.length) setOdds(rows.slice(0, 30));
      } catch { /* keep the last good list */ }
    };
    load();
    const iv = setInterval(load, 180000);
    return () => { stop = true; clearInterval(iv); };
  }, []);

  return (
    <div className="flex flex-col">
      {/* Space weather banner */}
      {spaceWeather && (
        <div className="mb-3 px-3 py-2.5 rounded-xl border flex items-center justify-between" style={{ borderColor: `${spaceWeather.storm_color}33`, background: `${spaceWeather.storm_color}08` }}>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" style={{ color: spaceWeather.storm_color }} />
            <span className="text-[12px] font-medium text-[var(--text-secondary)]">Space weather</span>
            {spaceWeather.solar_flares?.length > 0 && (
              <span className="text-[11px] text-[var(--text-muted)]">· latest flare {spaceWeather.solar_flares[0].class}</span>
            )}
          </div>
          <span className="text-[12px] font-mono font-semibold" style={{ color: spaceWeather.storm_color }}>
            Kp {spaceWeather.kp_index} — {spaceWeather.storm_level}
          </span>
        </div>
      )}

      {/* Section tabs — segmented control */}
      <div className="flex gap-1 mb-3 overflow-x-auto rounded-xl p-1" style={{ background: 'rgba(255,255,255,.03)', border: '1px solid var(--border-secondary)' }}>
        {SECTIONS.map(s => {
          const Icon = s.icon;
          const active = activeSection === s.key;
          return (
            <button key={s.key} onClick={() => setActiveSection(s.key)}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-colors flex-1"
              style={{
                background: active ? 'var(--hover-accent)' : 'transparent',
                color: active ? 'var(--gold-primary)' : 'var(--text-muted)',
                border: `1px solid ${active ? 'var(--border-active)' : 'transparent'}`,
              }}>
              <Icon className="w-3.5 h-3.5" />
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Supply-chain alerts */}
      {markets.scm_alerts && markets.scm_alerts.length > 0 && (
        <div className="mb-3 space-y-1.5">
          {markets.scm_alerts.map((alert: string, i: number) => (
            <div key={i} className="px-3 py-2 rounded-lg border text-[12px] leading-snug" style={{ borderColor: 'rgba(255,149,0,.4)', background: 'rgba(255,149,0,.08)', color: '#FFA63D' }}>
              {alert}
            </div>
          ))}
        </div>
      )}

      {/* Tickers / crowd odds / watch */}
      {activeSection === 'watch' ? (
        <WatchTab />
      ) : activeSection === 'odds' ? (
        <div className="flex flex-col gap-0.5">
          {odds.length
            ? odds.map((o, i) => <OddRow key={`${o.src}-${i}`} o={o} />)
            : <div className="text-center py-6 text-[12px] text-[var(--text-muted)]">Reading the betting markets…</div>}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-x-4 gap-y-0.5">
          {markets[activeSection] && Object.entries(markets[activeSection]).map(([name, d]) => (
            <Ticker key={name} name={name} data={d} />
          ))}
          {(!markets[activeSection] || Object.keys(markets[activeSection]).length === 0) && (
            <div className="col-span-2 text-center py-6 text-[12px] text-[var(--text-muted)]">Loading {activeSection}…</div>
          )}
        </div>
      )}
    </div>
  );
}
