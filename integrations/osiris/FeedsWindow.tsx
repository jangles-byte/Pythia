'use client';

/** Floating "Signals" window — every non-geographic feed that can't live on the globe
 *  (regulated odds, energy grid, wastewater, climate dials, sanctions, tech pulse, space
 *  weather, aviation, attention), each with its latest value + source link. So nothing
 *  lives only in the oracle brief / Display Mode. Placeable anywhere like chat/filings. */
import { useEffect, useState, useCallback } from 'react';
import { ExternalLink } from 'lucide-react';

type Row = { key: string; label: string; color: string; link: string; value: string; sub: string };

// each feed: where to fetch, how to one-line it, and the source to open
const FEEDS: { key: string; label: string; color: string; path: string; link: string; sum: (d: any) => { value: string; sub: string } }[] = [
  { key: 'kalshi', label: 'KALSHI ODDS', color: 'var(--gold-primary)', path: '/api/kalshi', link: 'https://kalshi.com',
    sum: d => { const m = d.markets?.[0]; return { value: m ? `${Math.round(m.prob * 100)}% · ${m.question}` : '—', sub: `${d.markets?.length || 0} regulated markets` }; } },
  { key: 'ofac', label: 'OFAC SANCTIONS', color: '#E040FB', path: '/api/ofac', link: 'https://ofac.treasury.gov/recent-actions',
    sum: d => { const a = d.actions?.[0]; return { value: a?.title || '—', sub: a ? `${a.date} · ${a.kind}` : '' }; } },
  { key: 'grid', label: 'POWER GRID', color: '#4FC3F7', path: '/api/grid', link: 'https://www.caiso.com/todays-outlook',
    sum: d => ({ value: (d.grids || []).map((g: any) => `${g.region.split(' ')[0]} ${g.cleanPct}% clean`).join(' · ') || '—', sub: (d.grids || []).map((g: any) => g.intensity ? `${g.intensity} gCO₂` : `${g.fossilPct}% fossil`).join(' · ') }) },
  { key: 'wastewater', label: 'WASTEWATER', color: '#AEEA00', path: '/api/wastewater', link: 'https://www.cdc.gov/nwss/rv/COVID19-nationaltrend.html',
    sum: d => ({ value: d.national ? `${d.national.percentile} pctile · ${d.national.risingPct}% of sites rising` : '—', sub: d.asOf ? `CDC NWSS · as of ${d.asOf}` : '' }) },
  { key: 'climate', label: 'CLIMATE', color: '#66BB6A', path: '/api/climate', link: 'https://www.cpc.ncep.noaa.gov',
    sum: d => ({ value: d.enso ? `${d.enso.phase} (ONI ${d.enso.oni >= 0 ? '+' : ''}${d.enso.oni})` : '—', sub: d.drought ? `US drought ${d.drought.anyDrought}% (D0+), ${d.drought.severePlus}% severe+` : '' }) },
  { key: 'space', label: 'SPACE WEATHER', color: '#7E57C2', path: '/api/space-weather', link: 'https://www.swpc.noaa.gov',
    sum: d => ({ value: `Kp ${d.kp_index} · ${d.storm_level}`, sub: d.solar_flares?.length ? `${d.solar_flares.length} solar flares (24h)` : 'no flares' }) },
  { key: 'faa', label: 'US AIRSPACE', color: '#FF9500', path: '/api/faa-status', link: 'https://nasstatus.faa.gov',
    sum: d => { const e = d.events?.[0]; return { value: d.events?.length ? `${d.events.length} ground stops / delays` : 'airspace clear', sub: e ? `worst: ${e.airport} ${e.type}` : '' }; } },
  { key: 'hn', label: 'TECH PULSE', color: '#FF9800', path: '/api/hackernews', link: 'https://news.ycombinator.com',
    sum: d => { const s = d.stories?.[0]; return { value: s ? `${s.points}▲ ${s.title}` : '—', sub: 'Hacker News front page' }; } },
  { key: 'wiki', label: 'ATTENTION', color: '#EC407A', path: '/api/wiki-attention', link: 'https://en.wikipedia.org',
    sum: d => { const i = d.items?.[0]; return { value: i?.title || i?.article || (d.items?.length ? 'trending' : 'quiet'), sub: 'Wikipedia attention spikes' }; } },
];

export default function FeedsWindow() {
  const [rows, setRows] = useState<Row[]>([]);
  const [ts, setTs] = useState(0);

  const load = useCallback(async () => {
    const out = await Promise.all(FEEDS.map(async f => {
      let value = '—', sub = '';
      try { const d = await fetch(f.path).then(r => (r.ok ? r.json() : null)); if (d) ({ value, sub } = f.sum(d)); } catch { /* keep dash */ }
      return { key: f.key, label: f.label, color: f.color, link: f.link, value, sub };
    }));
    setRows(out);
    setTs(Date.now());
  }, []);

  useEffect(() => { load(); const iv = setInterval(load, 120_000); return () => clearInterval(iv); }, [load]);

  return (
    <div className="flex flex-col h-full text-[var(--text-primary)]">
      <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-[var(--border-subtle)]">
        <span className="text-[10px] font-mono tracking-[0.15em] text-[var(--text-secondary)]">NON-MAP SIGNALS</span>
        <span className="ml-auto text-[9px] font-mono text-[var(--text-muted)]">{ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {!rows.length && <div className="p-4 text-center text-[10px] font-mono text-[var(--text-muted)]">reading the signals…</div>}
        {rows.map(r => (
          <a key={r.key} href={r.link} target="_blank" rel="noopener noreferrer" title={r.link}
            onMouseDown={e => e.stopPropagation()}
            className="group flex items-start gap-2.5 px-2.5 py-2 border-b border-[var(--border-subtle)]/50 hover:bg-[var(--hover-accent)] cursor-pointer">
            <span className="mt-0.5 w-[92px] shrink-0 text-[9px] font-mono font-semibold tracking-wide" style={{ color: r.color }}>{r.label}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-[var(--text-primary)] leading-snug line-clamp-2">{r.value}</div>
              {r.sub && <div className="text-[9px] text-[var(--text-muted)] font-mono truncate">{r.sub}</div>}
            </div>
            <ExternalLink className="w-3 h-3 mt-0.5 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 shrink-0" />
          </a>
        ))}
      </div>
      <div className="px-2.5 py-1 border-t border-[var(--border-subtle)] text-[8px] font-mono text-[var(--text-muted)] leading-tight">
        Feeds with no location — they also drive the oracle & Display Mode · all keyless
      </div>
    </div>
  );
}
