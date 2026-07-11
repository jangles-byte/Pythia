'use client';

/** Signal radar — the weirdest things happening right now.
 *  The single highest-salience live event from each domain, as glanceable chips;
 *  click to fly there. Always on in the deck — the ambient "anything weird?" tile. */
import { useEffect, useState } from 'react';
import { RadarIcon } from 'lucide-react';

type Ev = { title: string; category: string; source: string; salience: number; lat?: number | null; lng?: number | null };

const DOMAIN_COLOR: Record<string, string> = {
  conflict: 'var(--alert-red)', seismic: '#FFA63D', weather: 'var(--accent-weather, #E879F9)',
  disaster: '#FFA63D', markets: 'var(--gold-primary)', futures: 'var(--gold-primary)',
  odds: 'var(--gold-primary)', cyber: 'var(--cyan-primary)', outage: 'var(--cyan-primary)',
  health: '#7DF9A8', attention: '#E879F9', space: 'var(--horizon-year)',
};
const color = (cat: string) => {
  const k = Object.keys(DOMAIN_COLOR).find((d) => cat.toLowerCase().includes(d));
  return k ? DOMAIN_COLOR[k] : 'var(--text-secondary)';
};

export default function RadarStrip({ onLocate }: { onLocate?: (lat: number, lng: number) => void }) {
  const [evs, setEvs] = useState<Ev[]>([]);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch('/api/engine/agent/events?min_salience=0.7&limit=60');
        if (!r.ok) return;
        const j = await r.json();
        const all: Ev[] = j.events || [];
        // one chip per domain — the strangest thing in each corner of the world
        const byDomain = new Map<string, Ev>();
        for (const e of all) {
          const prev = byDomain.get(e.category);
          if (!prev || e.salience > prev.salience) byDomain.set(e.category, e);
        }
        const top = [...byDomain.values()].sort((a, b) => b.salience - a.salience).slice(0, 6);
        if (!stop) setEvs(top);
      } catch { /* engine offline — strip hides */ }
    };
    load();
    const iv = setInterval(load, 60000);
    return () => { stop = true; clearInterval(iv); };
  }, []);

  if (!evs.length) return null;
  return (
    <div className="flex items-center gap-2 mb-3 overflow-x-auto styled-scrollbar pb-0.5">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--text-secondary)] shrink-0">
        <RadarIcon className="w-3.5 h-3.5" style={{ color: 'var(--cyan-primary)' }} /> Radar
      </span>
      {evs.map((e, i) => (
        <button key={i}
          onClick={() => { if (e.lat != null && e.lng != null) onLocate?.(e.lat, e.lng); }}
          title={`${e.category} · ${e.source} · salience ${e.salience.toFixed(2)}${e.lat != null ? ' — fly to' : ''}`}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] whitespace-nowrap transition-colors hover:border-[var(--border-active)] shrink-0"
          style={{ borderColor: 'var(--border-secondary)', background: 'rgba(255,255,255,.02)', cursor: e.lat != null ? 'pointer' : 'default' }}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color(e.category) }} />
          <span className="text-[var(--text-secondary)] max-w-[260px] truncate">{e.title}</span>
        </button>
      ))}
    </div>
  );
}
