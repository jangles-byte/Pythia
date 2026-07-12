'use client';

/** Live satellite — NOAA GOES imagery (public domain, ~5-min refresh).
 *  GOES-East (Americas/Atlantic) and GOES-West (Pacific), full disk / CONUS /
 *  the roaming mesoscale sectors NOAA re-points at active hurricanes & fires.
 *  Renders inside FloatingWindow. */
import { useEffect, useState } from 'react';

const CDN = 'https://cdn.star.nesdis.noaa.gov';
const VIEWS = [
  // ── GOES-East (Americas / Atlantic) ──
  { key: 'east-conus', label: 'East · US', url: `${CDN}/GOES19/ABI/CONUS/GEOCOLOR/1250x750.jpg` },
  { key: 'east-ne', label: 'Northeast', url: `${CDN}/GOES19/ABI/SECTOR/ne/GEOCOLOR/1200x1200.jpg` },
  { key: 'east-se', label: 'Southeast', url: `${CDN}/GOES19/ABI/SECTOR/se/GEOCOLOR/1200x1200.jpg` },
  { key: 'east-trop', label: 'Tropical Atl.', url: `${CDN}/GOES19/ABI/SECTOR/taw/GEOCOLOR/900x540.jpg` },
  { key: 'east-fd', label: 'East · Full disk', url: `${CDN}/GOES19/ABI/FD/GEOCOLOR/1808x1808.jpg` },
  // ── GOES-West (Pacific) ──
  { key: 'west-conus', label: 'West · US', url: `${CDN}/GOES18/ABI/CONUS/GEOCOLOR/1250x750.jpg` },
  { key: 'west-psw', label: 'US West', url: `${CDN}/GOES18/ABI/SECTOR/psw/GEOCOLOR/1200x1200.jpg` },
  { key: 'west-hi', label: 'Hawaii', url: `${CDN}/GOES18/ABI/SECTOR/hi/GEOCOLOR/1200x1200.jpg` },
  { key: 'west-fd', label: 'West · Full disk', url: `${CDN}/GOES18/ABI/FD/GEOCOLOR/1808x1808.jpg` },
  // ── Roaming mesoscale sectors (NOAA points these at active storms/fires) ──
  { key: 'meso1', label: 'Mesoscale-1', url: `${CDN}/GOES19/ABI/MESO/M1/GEOCOLOR/1000x1000.jpg` },
  { key: 'meso2', label: 'Mesoscale-2', url: `${CDN}/GOES19/ABI/MESO/M2/GEOCOLOR/1000x1000.jpg` },
  // ── Alternate bands (read storms differently; IR works at night) ──
  { key: 'east-ir', label: 'Infrared', url: `${CDN}/GOES19/ABI/CONUS/13/1250x750.jpg` },
  { key: 'east-air', label: 'AirMass', url: `${CDN}/GOES19/ABI/CONUS/AirMass/1250x750.jpg` },
  { key: 'east-sand', label: 'Sandwich', url: `${CDN}/GOES19/ABI/CONUS/Sandwich/1250x750.jpg` },
];

export default function SatelliteView() {
  const [view, setView] = useState(VIEWS[0]);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setTick((t) => t + 1), 120000);   // fresh frame every 2 min
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)]">
      <div className="flex flex-wrap gap-1 p-2 border-b border-[var(--border-secondary)]">
        {VIEWS.map((v) => {
          const active = v.key === view.key;
          return (
            <button key={v.key} onClick={() => setView(v)}
              className="text-[11px] font-medium px-2 py-1 rounded-lg transition-colors"
              style={{ background: active ? 'var(--hover-accent)' : 'transparent', color: active ? 'var(--gold-primary)' : 'var(--text-muted)', border: `1px solid ${active ? 'var(--border-active)' : 'transparent'}` }}>
              {v.label}
            </button>
          );
        })}
      </div>
      <div className="flex-1 min-h-0 flex items-center justify-center bg-black overflow-hidden">
        <img src={`${view.url}?_t=${tick}`} alt={`GOES ${view.label}`} className="max-w-full max-h-full object-contain" />
      </div>
      <div className="text-[10px] text-[var(--text-muted)] px-2 py-1 text-center">NOAA GOES · GeoColor · public domain · ~5-min cadence</div>
    </div>
  );
}
