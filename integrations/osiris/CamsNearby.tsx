'use client';

/** Cams near this — the view nobody else has.
 *  Given any event/forecast location, pull the nearest public cameras and show
 *  them as a live still grid; click one to enlarge. Auto-refreshes the stills.
 *  Opens as a portal modal from any alert, forecast, or map event. */
import { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Video, MapPin, RefreshCw, ExternalLink } from 'lucide-react';

type Cam = { id: string; name: string; place?: string; lat: number; lng: number; img?: string; video?: string; src: string; distance_km: number };

export default function CamsNearby({ lat, lng, label, onClose }: {
  lat: number; lng: number; label?: string; onClose: () => void;
}) {
  const [cams, setCams] = useState<Cam[] | null>(null);
  const [radius, setRadius] = useState(120);
  const [tick, setTick] = useState(0);        // bumps the still cache-buster
  const [big, setBig] = useState<Cam | null>(null);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/cams?near=${lat},${lng}&radius_km=${radius}&limit=18`);
      const j = await r.json();
      setCams(j.cams || []);
    } catch { setCams([]); }
  }, [lat, lng, radius]);

  useEffect(() => { setCams(null); load(); }, [load]);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 20000);   // refresh stills every 20s
    return () => clearInterval(iv);
  }, []);

  const bust = (url?: string) => url ? `${url}${url.includes('?') ? '&' : '?'}_t=${tick}` : url;

  if (!mounted) return null;
  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[650] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm pointer-events-auto">
      <motion.div initial={{ scale: 0.96, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: 10 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel w-[min(1000px,96vw)] max-h-[92vh] overflow-hidden flex flex-col p-4" style={{ borderRadius: 16 }}>
        {/* header */}
        <div className="flex items-center gap-3 mb-3">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg" style={{ background: 'var(--hover-accent)', color: 'var(--gold-primary)' }}><Video className="w-4 h-4" /></span>
          <div className="min-w-0">
            <div className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight">Cameras near {label || 'this location'}</div>
            <div className="text-[11px] text-[var(--text-muted)] leading-tight flex items-center gap-1"><MapPin className="w-3 h-3" /> {lat.toFixed(3)}, {lng.toFixed(3)} · {cams?.length ?? '…'} cams within {radius}km</div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <select value={radius} onChange={(e) => setRadius(Number(e.target.value))}
              className="text-[12px] rounded-lg px-2 py-1.5 outline-none cursor-pointer" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }}>
              {[40, 80, 120, 250, 500].map((r) => <option key={r} value={r}>{r} km</option>)}
            </select>
            <button onClick={load} title="Refresh" className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-accent)]"><RefreshCw className="w-4 h-4" /></button>
            <button onClick={onClose} title="Close" className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-accent)]"><X className="w-4 h-4" /></button>
          </div>
        </div>

        {/* grid */}
        <div className="flex-1 min-h-0 overflow-y-auto styled-scrollbar">
          {cams === null && <div className="text-center py-10 text-[13px] text-[var(--text-muted)]">Finding cameras…</div>}
          {cams?.length === 0 && (
            <div className="text-center py-10 text-[13px] text-[var(--text-muted)]">
              No public cameras within {radius}km — widen the radius, or this area isn&apos;t covered by an open network yet.
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
            {(cams || []).map((c) => (
              <button key={c.id} onClick={() => setBig(c)}
                className="text-left rounded-xl border border-[var(--border-secondary)] overflow-hidden hover:border-[var(--border-active)] transition-colors group"
                style={{ background: 'rgba(255,255,255,.02)' }}>
                <div className="relative aspect-video bg-black/40 overflow-hidden">
                  {c.img
                    ? <img src={bust(c.img)} alt={c.name} className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.15'; }} />
                    : <div className="w-full h-full flex items-center justify-center text-[11px] text-[var(--text-muted)]"><Video className="w-5 h-5 mr-1.5" /> live stream</div>}
                  <span className="absolute top-1.5 left-1.5 text-[9px] font-mono px-1.5 py-[1px] rounded" style={{ background: 'rgba(0,0,0,.6)', color: 'var(--cyan-primary)' }}>{c.src}</span>
                  <span className="absolute bottom-1.5 right-1.5 text-[9px] font-mono px-1.5 py-[1px] rounded" style={{ background: 'rgba(0,0,0,.6)', color: 'var(--text-secondary)' }}>{c.distance_km}km</span>
                </div>
                <div className="px-2 py-1.5 text-[11px] text-[var(--text-secondary)] leading-snug truncate">{c.name}</div>
              </button>
            ))}
          </div>
        </div>
      </motion.div>

      {/* enlarge one */}
      <AnimatePresence>
        {big && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={(e) => { e.stopPropagation(); setBig(null); }}
            className="fixed inset-0 z-[660] flex items-center justify-center p-6 bg-black/85">
            <div className="w-[min(1100px,94vw)]" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[13px] text-[var(--text-primary)] font-medium">{big.name}</span>
                <span className="text-[11px] text-[var(--text-muted)]">· {big.src} · {big.place}</span>
                {big.video && <a href={big.video} target="_blank" rel="noreferrer" className="ml-auto text-[11px] flex items-center gap-1 text-[var(--cyan-primary)] hover:underline">open stream <ExternalLink className="w-3 h-3" /></a>}
                <button onClick={() => setBig(null)} className="ml-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"><X className="w-5 h-5" /></button>
              </div>
              {big.img
                ? <img src={bust(big.img)} alt={big.name} className="w-full rounded-xl border border-[var(--border-secondary)]" />
                : <div className="aspect-video rounded-xl border border-[var(--border-secondary)] flex items-center justify-center text-[13px] text-[var(--text-muted)]">This camera is a live video stream — “open stream” to view it.</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>,
    document.body,
  );
}
