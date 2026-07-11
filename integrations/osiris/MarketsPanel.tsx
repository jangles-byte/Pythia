'use client';

/** Markets & intel — live tickers, futures, crowd odds and space weather.
 *  Renders inside PanelModal (desktop) or the mobile sheet — the container
 *  provides the chrome, so this is just the content. */
import { useState, useEffect } from 'react';
import {
  TrendingUp, TrendingDown, Zap, Shield, Droplets, Gem, Bitcoin, LineChart, Percent,
} from 'lucide-react';

interface MarketsPanelProps { data: any; spaceWeather?: any; }

const SECTIONS = [
  { key: 'indices', label: 'Indices', icon: LineChart },
  { key: 'stocks', label: 'Defense', icon: Shield },
  { key: 'oil', label: 'Energy', icon: Droplets },
  { key: 'commodities', label: 'Commodities', icon: Gem },
  { key: 'crypto', label: 'Crypto', icon: Bitcoin },
  { key: 'odds', label: 'Odds', icon: Percent },
];

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
  const [activeSection, setActiveSection] = useState('stocks');
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

      {/* Tickers / crowd odds */}
      {activeSection === 'odds' ? (
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
