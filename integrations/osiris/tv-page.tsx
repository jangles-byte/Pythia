'use client';

/**
 *  PYTHIA — Display Mode (/tv)
 *  A slow, equatorial spinning globe hanging in space, with live intel from every
 *  feed fading in and out at random — street cams, GOES weather, headlines, markets,
 *  storms, quakes, live TV news, and the oracle's own forecasts. No priority, no
 *  boards: an ambient window on the whole program. Leave it up on a wall.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import OsirisMap from '@/components/OsirisMap';

// ── static GOES views (NOAA, public domain) ───────────────────────────────
const GOES = [
  { label: 'GOES-East · US', url: 'https://cdn.star.nesdis.noaa.gov/GOES19/ABI/CONUS/GEOCOLOR/1250x750.jpg' },
  { label: 'GOES-East · Full Disk', url: 'https://cdn.star.nesdis.noaa.gov/GOES19/ABI/FD/GEOCOLOR/1808x1808.jpg' },
  { label: 'Tropical Atlantic', url: 'https://cdn.star.nesdis.noaa.gov/GOES19/ABI/SECTOR/taw/GEOCOLOR/900x540.jpg' },
  { label: 'GOES-West · US', url: 'https://cdn.star.nesdis.noaa.gov/GOES18/ABI/CONUS/GEOCOLOR/1250x750.jpg' },
  { label: 'US West', url: 'https://cdn.star.nesdis.noaa.gov/GOES18/ABI/SECTOR/psw/GEOCOLOR/1200x1200.jpg' },
  { label: 'Hawaii', url: 'https://cdn.star.nesdis.noaa.gov/GOES18/ABI/SECTOR/hi/GEOCOLOR/1200x1200.jpg' },
];
const TICKERS = ['SPY', 'QQQ', '^VIX', 'BTC-USD', 'ETH-USD', 'CL=F', 'GC=F', 'NG=F', 'NVDA', 'AAPL', 'TSLA', 'EURUSD=X'];

// OsirisMap reads many data.* fields — a safe empty shape keeps the backdrop clean & error-free.
const EMPTY_DATA: any = {};
for (const k of ['commercial_flights', 'private_flights', 'private_jets', 'military_flights',
                 'satellites', 'earthquakes', 'gdelt', 'fires', 'weather_events']) EMPTY_DATA[k] = [];
for (const k of ['nws_alerts', 'frontlines', 'displacement', 'economy', 'censorship', 'health',
                 'unrest', 'food', 'unemployment', 'gdp', 'poverty', 'hurricanes', 'flood']) EMPTY_DATA[k] = { features: [] };

type Card = { id: number; slot: string; kind: string; life: number; node: React.ReactNode };
type Pools = { cams: any[]; news: any[]; quotes: any[]; alerts: any[]; quakes: any[]; live: any[]; preds: any[]; hn: any[]; volcanoes: any[]; sanctions: any[] };

const CORNERS = ['tl', 'tr', 'bl', 'br'];
const BANNERS = ['top', 'bottom'];
const SLOT_POS: Record<string, string> = {
  tl: 'top-5 left-5', tr: 'top-5 right-5', bl: 'bottom-14 left-5', br: 'bottom-14 right-5',
  top: 'top-5 left-1/2 -translate-x-1/2', bottom: 'bottom-6 left-1/2 -translate-x-1/2',
};
const pick = <T,>(a: T[]): T | undefined => (a.length ? a[Math.floor(Math.random() * a.length)] : undefined);
const bust = (u: string) => u + (u.includes('?') ? '&' : '?') + '_t=' + Math.floor(Date.now() / 60000);

// ── card chrome ────────────────────────────────────────────────────────────
function Frame({ children, w }: { children: React.ReactNode; w: number }) {
  return (
    <div style={{ width: w }}
      className="rounded-xl overflow-hidden border border-white/12 bg-black/55 backdrop-blur-md shadow-[0_10px_40px_rgba(0,0,0,0.6)]">
      {children}
    </div>
  );
}
function Tag({ children, color = 'var(--cyan-primary)' }: { children: React.ReactNode; color?: string }) {
  return <span className="text-[9px] font-mono tracking-[0.15em] uppercase" style={{ color }}>{children}</span>;
}
function Media({ src, tag, tagColor, title, sub }: { src: string; tag: string; tagColor?: string; title: string; sub?: string }) {
  return (
    <div className="relative">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={title} className="w-full h-[170px] object-cover bg-black/40" />
      <div className="absolute top-1.5 left-2 flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: tagColor || 'var(--alert-green)' }} />
        <Tag color={tagColor}>{tag}</Tag>
      </div>
      <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/85 to-transparent">
        <div className="text-[11px] text-white font-medium truncate leading-tight">{title}</div>
        {sub && <div className="text-[9px] text-white/55 font-mono truncate">{sub}</div>}
      </div>
    </div>
  );
}

export default function TVPage() {
  const [cards, setCards] = useState<Card[]>([]);
  const [now, setNow] = useState('');
  const [fly, setFly] = useState<{ lat: number; lng: number; zoom: number; ts: number } | null>(null);
  const pools = useRef<Pools>({ cams: [], news: [], quotes: [], alerts: [], quakes: [], live: [], preds: [], hn: [], volcanoes: [], sanctions: [] });
  const idc = useRef(0);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })), 1000);
    return () => clearInterval(t);
  }, []);

  // frame the globe: equator-centered, zoomed just outside the satellites
  useEffect(() => { const t = setTimeout(() => setFly({ lat: 0, lng: 0, zoom: 1.5, ts: Date.now() }), 1400); return () => clearTimeout(t); }, []);

  // ── feed loaders ───────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    const j = (p: string) => fetch(p).then(r => (r.ok ? r.json() : null)).catch(() => null);
    const [cams, news, quotes, alerts, quakes, live, state, hn, geo, ofac] = await Promise.all([
      j('/api/cams'), j('/api/news'), j(`/api/quotes?symbols=${TICKERS.join(',')}`),
      j('/api/nws-alerts'), j('/api/earthquakes'), j('/api/live-news'), j('/api/engine/state'),
      j('/api/hackernews'), j('/api/geohazards'), j('/api/ofac'),
    ]);
    const P = pools.current;
    if (cams) P.cams = (cams.cams || (Array.isArray(cams) ? cams : [])).filter((c: any) => c.img);
    if (news?.news) P.news = news.news;
    if (quotes?.quotes) P.quotes = Object.values(quotes.quotes).filter(Boolean);
    if (alerts?.features) P.alerts = alerts.features.filter((f: any) => f.properties?.event);
    if (quakes) { const arr = quakes.earthquakes || quakes.features || quakes; if (Array.isArray(arr)) P.quakes = arr; }
    if (live?.feeds) P.live = live.feeds.filter((f: any) => f.embed_allowed);
    if (state?.predictions) P.preds = state.predictions;
    else if (Array.isArray(state?.forecasts)) P.preds = state.forecasts;
    if (hn?.stories) P.hn = hn.stories;
    if (geo?.volcanoes) P.volcanoes = geo.volcanoes;
    if (ofac?.actions) P.sanctions = ofac.actions;
  }, []);

  useEffect(() => { loadAll(); const iv = setInterval(loadAll, 90_000); return () => clearInterval(iv); }, [loadAll]);

  // ── card producers ─────────────────────────────────────────────────────
  const producers = useRef<{ kind: string; slot: 'corner' | 'banner'; life: number; make: () => React.ReactNode | null }[]>([]);
  producers.current = [
    { kind: 'cam', slot: 'corner', life: 11000, make: () => {
      const c = pick(pools.current.cams); if (!c) return null;
      return <Frame w={300}><Media src={bust(c.img)} tag={`LIVE CAM · ${c.src || ''}`} tagColor="var(--alert-green)" title={c.name} /></Frame>;
    } },
    { kind: 'goes', slot: 'corner', life: 12000, make: () => {
      const g = pick(GOES); if (!g) return null;
      return <Frame w={300}><Media src={bust(g.url)} tag="GOES · WEATHER" tagColor="#4FC3F7" title={g.label} sub="NOAA satellite" /></Frame>;
    } },
    { kind: 'video', slot: 'corner', life: 16000, make: () => {
      const f = pick(pools.current.live); if (!f) return null;
      return <Frame w={340}>
        <div className="relative">
          <iframe src={f.url} title={f.name} className="w-full h-[192px] border-0" allow="autoplay; encrypted-media" />
          <div className="absolute top-1.5 left-2 flex items-center gap-1.5 pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--alert-red)] animate-pulse" /><Tag color="var(--alert-red)">LIVE TV · {f.city}</Tag>
          </div>
        </div>
        <div className="px-2 py-1 text-[10px] text-white/80 font-mono">{f.name}</div>
      </Frame>;
    } },
    { kind: 'quake', slot: 'corner', life: 9000, make: () => {
      const q: any = pick(pools.current.quakes); if (!q) return null;
      const mag = q.magnitude ?? q.mag ?? q.properties?.mag;
      const place = q.place ?? q.properties?.place ?? q.location;
      if (mag == null) return null;
      return <Frame w={260}><div className="p-3">
        <Tag color="#F9A825">◉ SEISMIC</Tag>
        <div className="mt-1 text-2xl font-bold text-[#F9A825]">M{Number(mag).toFixed(1)}</div>
        <div className="text-[11px] text-white/80 truncate">{place || 'Earthquake'}</div>
      </div></Frame>;
    } },
    { kind: 'market', slot: 'corner', life: 10000, make: () => {
      const qs = pools.current.quotes; if (qs.length < 3) return null;
      const some = [...qs].sort(() => Math.random() - 0.5).slice(0, 4);
      return <Frame w={250}><div className="p-3 space-y-1.5">
        <Tag color="var(--gold-primary)">◉ MARKETS</Tag>
        {some.map((q: any, i) => { const up = (q.change_percent ?? 0) >= 0; return (
          <div key={i} className="flex items-center justify-between text-[12px]">
            <span className="font-mono text-white/85">{q.symbol}</span>
            <span className="font-mono" style={{ color: up ? 'var(--alert-green)' : 'var(--alert-red)' }}>
              {up ? '▲' : '▼'} {Math.abs(q.change_percent ?? 0).toFixed(2)}%
            </span>
          </div>); })}
      </div></Frame>;
    } },
    { kind: 'news', slot: 'banner', life: 12000, make: () => {
      const n: any = pick(pools.current.news); if (!n) return null;
      const src = (() => { try { return new URL(n.link).hostname.replace('www.', ''); } catch { return 'news'; } })();
      return <Frame w={540}><div className="px-4 py-3">
        <Tag color="var(--alert-red)">● HEADLINE · {src}</Tag>
        <div className="mt-1 text-[15px] text-white font-medium leading-snug line-clamp-2">{n.title}</div>
      </div></Frame>;
    } },
    { kind: 'alert', slot: 'banner', life: 11000, make: () => {
      const a: any = pick(pools.current.alerts); if (!a) return null;
      const p = a.properties || {};
      const sev = p.severity === 'Extreme' ? 'var(--alert-red)' : p.severity === 'Severe' ? '#FF6D00' : '#FFC400';
      return <Frame w={500}><div className="px-4 py-3">
        <Tag color={sev}>⚠ {p.severity || 'ALERT'} · STORM</Tag>
        <div className="mt-1 text-[14px] text-white font-medium leading-snug">{p.event}</div>
        <div className="text-[10px] text-white/55 font-mono truncate">{(p.areaDesc || '').split(';')[0]}</div>
      </div></Frame>;
    } },
    { kind: 'forecast', slot: 'banner', life: 13000, make: () => {
      const f: any = pick(pools.current.preds); if (!f) return null;
      const prob = Math.round((f.probability ?? f.prob ?? 0) * 100);
      const stmt = f.statement || f.text || f.claim; if (!stmt) return null;
      return <Frame w={520}><div className="px-4 py-3">
        <div className="flex items-center justify-between"><Tag color="var(--gold-primary)">◉ PYTHIA FORECAST</Tag>
          <span className="text-[15px] font-bold text-[var(--gold-primary)]">{prob}%</span></div>
        <div className="mt-1 text-[13px] text-white/90 leading-snug line-clamp-2">{stmt}</div>
      </div></Frame>;
    } },
    { kind: 'volcano', slot: 'corner', life: 10000, make: () => {
      const v: any = pick(pools.current.volcanoes); if (!v) return null;
      const col = v.color === 'RED' ? '#FF1744' : v.color === 'ORANGE' ? '#FF6D00' : '#FFC400';
      return <Frame w={260}><div className="p-3">
        <Tag color={col}>▲ VOLCANO · {v.color}</Tag>
        <div className="mt-1 text-[15px] text-white font-semibold truncate">{v.name}</div>
        <div className="text-[10px] text-white/60 font-mono">{v.level} · {v.observatory}</div>
      </div></Frame>;
    } },
    { kind: 'sanctions', slot: 'banner', life: 12000, make: () => {
      const a: any = pick(pools.current.sanctions); if (!a) return null;
      return <Frame w={500}><div className="px-4 py-3">
        <Tag color="#E040FB">§ OFAC · {a.kind} · {a.date}</Tag>
        <div className="mt-1 text-[13px] text-white/90 leading-snug line-clamp-2">{a.title}</div>
      </div></Frame>;
    } },
    { kind: 'tech', slot: 'banner', life: 11000, make: () => {
      const s: any = pick(pools.current.hn); if (!s) return null;
      return <Frame w={480}><div className="px-4 py-3">
        <Tag color="#FF9800">◈ HACKER NEWS · {s.points}▲</Tag>
        <div className="mt-1 text-[13px] text-white/90 leading-snug line-clamp-2">{s.title}</div>
      </div></Frame>;
    } },
  ];

  // ── scheduler: stagger random cards into free slots, fade in & out ───────
  useEffect(() => {
    const MAX = 5;
    const tick = () => {
      setCards(prev => {
        if (prev.length >= MAX || Math.random() > 0.7) return prev;
        const used = new Set(prev.map(c => c.slot));
        const hasVideo = prev.some(c => c.kind === 'video');
        const avail = producers.current.filter(p => !(p.kind === 'video' && hasVideo));
        for (let attempt = 0; attempt < 5; attempt++) {
          const prod = pick(avail); if (!prod) break;
          const node = prod.make(); if (!node) continue;
          const poolSlots = (prod.slot === 'banner' ? BANNERS : CORNERS).filter(s => !used.has(s));
          if (!poolSlots.length) continue;
          const slot = pick(poolSlots)!;
          const id = ++idc.current;
          setTimeout(() => setCards(c => c.filter(x => x.id !== id)), prod.life);
          return [...prev, { id, slot, kind: prod.kind, life: prod.life, node }];
        }
        return prev;
      });
    };
    const iv = setInterval(tick, 2200);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="fixed inset-0 bg-black overflow-hidden select-none">
      <style>{`
        @keyframes tvIn {
          0% { opacity: 0; transform: translateY(10px) scale(0.97); }
          9% { opacity: 1; transform: translateY(0) scale(1); }
          90% { opacity: 1; transform: translateY(0) scale(1); }
          100% { opacity: 0; transform: translateY(-8px) scale(0.98); }
        }
        .line-clamp-2 { display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
      `}</style>

      {/* spinning globe backdrop */}
      <div className="absolute inset-0 z-0">
        <OsirisMap data={EMPTY_DATA} activeLayers={{}} projection="globe"
          spin={{ mode: 'rotate', speed: 1.6 }} flyToLocation={fly} theme="core" />
      </div>
      {/* vignette so cards read against the globe */}
      <div className="absolute inset-0 z-[1] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.6) 100%)' }} />

      {/* wordmark + clock */}
      <div className="absolute bottom-5 left-6 z-[6] flex items-center gap-2 pointer-events-none">
        <span className="text-[13px] font-mono tracking-[0.3em] text-white/75">PYTHIA</span>
        <span className="w-1 h-1 rounded-full bg-[var(--gold-primary)] animate-pulse" />
        <span className="text-[11px] font-mono text-white/40">DISPLAY MODE</span>
      </div>
      <div className="absolute bottom-5 right-6 z-[6] text-[12px] font-mono text-white/45 pointer-events-none tabular-nums">{now}</div>

      {/* live cards */}
      {cards.map(c => (
        <div key={c.id} className={`absolute z-[10] ${SLOT_POS[c.slot]}`} style={{ animation: `tvIn ${c.life}ms ease-in-out forwards` }}>
          {c.node}
        </div>
      ))}
    </div>
  );
}
