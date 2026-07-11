'use client';

/** My Patch — pin the part of the world you actually work.
 *  Set a center + radius; this panel filters live events and forecasts to it.
 *  Stored in localStorage (pythia-patch). Click anything to fly there. */
import { useEffect, useState, useCallback } from 'react';
import { MapPinned, Save } from 'lucide-react';

type Ev = { title: string; category: string; source: string; salience: number; lat?: number | null; lng?: number | null };
type Pred = { id: string; statement: string; horizon: string; probability: number; lat?: number | null; lng?: number | null; location?: string };
type Patch = { name: string; lat: number; lng: number; radius_km: number };

const HZC: Record<string, string> = { '24h': 'var(--alert-red)', week: 'var(--gold-primary)', month: 'var(--cyan-primary)', year: 'var(--horizon-year)' };

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371, d = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * d) / 2) ** 2
    + Math.cos(lat1 * d) * Math.cos(lat2 * d) * Math.sin(((lng2 - lng1) * d) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export default function PatchPanel({ onLocate }: { onLocate?: (lat: number, lng: number) => void }) {
  const [patch, setPatch] = useState<Patch | null>(null);
  const [form, setForm] = useState({ name: '', lat: '', lng: '', radius: '250' });
  const [evs, setEvs] = useState<Ev[]>([]);
  const [preds, setPreds] = useState<Pred[]>([]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('pythia-patch') || 'null');
      if (saved?.lat != null) {
        setPatch(saved);
        setForm({ name: saved.name, lat: String(saved.lat), lng: String(saved.lng), radius: String(saved.radius_km) });
      }
    } catch { /* fresh start */ }
  }, []);

  const load = useCallback(async (p: Patch) => {
    try {
      const e = await fetch('/api/engine/agent/events?limit=0').then((r) => (r.ok ? r.json() : null));
      if (e) {
        setEvs((e.events || []).filter((ev: Ev) => ev.lat != null && ev.lng != null
          && haversine(p.lat, p.lng, ev.lat!, ev.lng!) <= p.radius_km).slice(0, 30));
      }
      const s = await fetch('/api/engine/state').then((r) => (r.ok ? r.json() : null));
      if (s) {
        setPreds((s.predictions || []).filter((pr: Pred) => pr.lat != null && pr.lng != null
          && haversine(p.lat, p.lng, pr.lat!, pr.lng!) <= p.radius_km));
      }
    } catch { /* engine offline */ }
  }, []);

  useEffect(() => {
    if (!patch) return;
    load(patch);
    const iv = setInterval(() => load(patch), 60000);
    return () => clearInterval(iv);
  }, [patch, load]);

  const save = () => {
    const lat = parseFloat(form.lat), lng = parseFloat(form.lng), radius = parseFloat(form.radius);
    if (isNaN(lat) || isNaN(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return;
    const p: Patch = { name: form.name.trim() || 'My patch', lat, lng, radius_km: isNaN(radius) ? 250 : Math.max(10, radius) };
    setPatch(p);
    try { localStorage.setItem('pythia-patch', JSON.stringify(p)); } catch { /* ok */ }
  };

  return (
    <div className="flex flex-col gap-3">
      {/* definition */}
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-[var(--border-secondary)] p-3" style={{ background: 'rgba(255,255,255,.02)' }}>
        {([['name', 'Name', 'Gulf Coast ops', 150], ['lat', 'Lat', '29.76', 80], ['lng', 'Lng', '-95.36', 80], ['radius', 'Radius km', '250', 80]] as const).map(([k, label, ph, w]) => (
          <label key={k} className="flex flex-col gap-1 text-[10px] text-[var(--text-muted)]">
            {label}
            <input value={form[k]} placeholder={ph} style={{ width: w }}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              className="text-[12px] font-mono rounded-lg px-2 py-1.5 outline-none bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] placeholder:text-[var(--text-muted)]" />
          </label>
        ))}
        <button onClick={save} className="flex items-center gap-1.5 text-[12px] font-semibold px-3 py-2 rounded-lg" style={{ background: 'var(--gold-primary)', color: '#0E0A1E' }}>
          <Save className="w-3.5 h-3.5" /> Set patch
        </button>
        {patch && (
          <button onClick={() => onLocate?.(patch.lat, patch.lng)} className="text-[11px] px-2.5 py-2 rounded-lg" style={{ background: 'var(--hover-accent)', color: 'var(--gold-primary)', border: '1px solid var(--border-secondary)' }}>
            Fly to {patch.name} →
          </button>
        )}
      </div>

      {!patch && (
        <div className="text-[12px] text-[var(--text-muted)] px-1">
          Pin your beat — a port, a border, a market region — and this panel shows only the events,
          forecasts and signals inside it.
        </div>
      )}

      {patch && (
        <>
          <div className="text-[11px] font-semibold text-[var(--text-secondary)] px-1">
            Forecasts in {patch.name} <span className="text-[var(--text-muted)] font-normal">· {preds.length}</span>
          </div>
          {preds.map((p) => (
            <button key={p.id} onClick={() => onLocate?.(p.lat!, p.lng!)}
              className="flex items-center justify-between gap-3 text-left px-3 py-2 rounded-lg hover:bg-[var(--hover-accent)] transition-colors border border-[var(--border-secondary)]"
              style={{ background: 'rgba(255,255,255,.02)' }}>
              <span className="text-[12px] text-[var(--text-primary)] leading-snug">
                <span className="font-medium" style={{ color: HZC[p.horizon] }}>[{p.horizon}]</span> {p.statement}
              </span>
              <span className="text-[13px] font-mono font-semibold shrink-0" style={{ color: HZC[p.horizon] }}>{Math.round(p.probability * 100)}%</span>
            </button>
          ))}
          {!preds.length && <div className="text-[11px] text-[var(--text-muted)] px-1">No located forecasts inside the patch right now.</div>}

          <div className="text-[11px] font-semibold text-[var(--text-secondary)] px-1 mt-1">
            Live events in {patch.name} <span className="text-[var(--text-muted)] font-normal">· {evs.length}</span>
          </div>
          {evs.map((e, i) => (
            <button key={i} onClick={() => onLocate?.(e.lat!, e.lng!)}
              className="flex items-center gap-3 text-left px-3 py-2 rounded-lg hover:bg-[var(--hover-accent)] transition-colors border border-[var(--border-secondary)]"
              style={{ background: 'rgba(255,255,255,.02)' }}>
              <span className="text-[10px] font-mono uppercase tracking-wider shrink-0 text-[var(--cyan-primary)] w-[80px] truncate">{e.category}</span>
              <span className="text-[12px] text-[var(--text-primary)] truncate">{e.title}</span>
              <span className="ml-auto text-[10px] font-mono text-[var(--text-muted)] shrink-0">{Math.round(haversine(patch.lat, patch.lng, e.lat!, e.lng!))} km</span>
            </button>
          ))}
          {!evs.length && <div className="text-[11px] text-[var(--text-muted)] px-1">Quiet inside the patch — nothing located here right now.</div>}
        </>
      )}
    </div>
  );
}
