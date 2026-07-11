'use client';

/** Opening screen — a full-screen halftone dot grid. The dots never move; they
 *  only grow and shrink, and out of them a shaded human eye forms with a slowly
 *  turning globe for an iris. Classic halftone: a hidden low-res scene is drawn
 *  every frame (eye, globe, pupil, glint, blink) and each grid dot's radius
 *  tracks the brightness of its pixel. Pure canvas — no deps, no network. */
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

// rough continent blobs (lat°, lon°, radius°) — at halftone resolution this
// reads as a living planet; precision would be invisible anyway
const LAND: [number, number, number][] = [
  [62, -95, 18], [50, -100, 22], [38, -102, 13], [15, -90, 7],           // North America
  [72, -40, 8],                                                          // Greenland
  [5, -65, 12], [-10, -58, 15], [-25, -63, 10], [-40, -68, 6],           // South America
  [8, 15, 16], [22, 8, 14], [-8, 22, 14], [-24, 25, 9],                  // Africa
  [50, 15, 10], [58, 38, 9],                                             // Europe
  [55, 75, 20], [35, 95, 15], [62, 105, 17], [22, 78, 9], [12, 103, 7],  // Asia
  [-25, 134, 11],                                                        // Australia
];

export default function SplashScreen() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const vw = window.innerWidth, vh = window.innerHeight;
    canvas.width = Math.floor(vw * dpr);
    canvas.height = Math.floor(vh * dpr);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';

    // ── the fixed dot grid ──
    const spacing = Math.max(9, Math.min(13, vw / 90)) * dpr;   // ~90 columns
    const cols = Math.ceil(canvas.width / spacing);
    const rows = Math.ceil(canvas.height / spacing);
    const maxR = spacing * 0.47;                                 // dots almost kiss, like a print
    const radii = new Float32Array(cols * rows);                 // current radius (eased)

    // ── hidden low-res scene: one pixel per dot ──
    const src = document.createElement('canvas');
    src.width = cols; src.height = rows;
    const sctx = src.getContext('2d', { willReadFrequently: true })!;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    // eye geometry in grid space
    const ecx = cols / 2, ecy = rows / 2;
    const eyeW = cols * 0.36;                 // half-width of the almond
    const eyeH = Math.min(rows * 0.30, eyeW * 0.52);
    const irisR = eyeH * 0.88;
    const TILT = -0.35;                       // globe axis tilt for the 3D read

    const easeOut = (t: number) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);

    const drawScene = (t: number) => {
      // t = seconds since start
      const reveal = reduced ? 1 : easeOut((t - 0.5) / 2.0);            // the eye forms 0.5s → 2.5s
      const spin = (reduced ? 0.6 : t * 0.28) % (Math.PI * 2);           // globe rotation
      // blink: quick lid close/open around 4.2s, then ~ every 5s
      let lid = 1;
      if (!reduced && t > 2.6) {
        const cycle = (t - 4.2) % 5.0;
        if (cycle > 0 && cycle < 0.36) lid = Math.abs(Math.cos((cycle / 0.36) * Math.PI));
      }
      const open = eyeH * reveal * lid;

      sctx.fillStyle = '#000';
      sctx.fillRect(0, 0, cols, rows);
      if (reveal <= 0) return;

      // ── almond sclera (two quadratic lids), soft-shaded ──
      sctx.save();
      sctx.beginPath();
      sctx.moveTo(ecx - eyeW, ecy);
      sctx.quadraticCurveTo(ecx, ecy - open * 2, ecx + eyeW, ecy);
      sctx.quadraticCurveTo(ecx, ecy + open * 2, ecx - eyeW, ecy);
      sctx.closePath();
      const sclera = sctx.createRadialGradient(ecx, ecy, irisR * 0.8, ecx, ecy, eyeW);
      sclera.addColorStop(0, `rgba(190,190,190,${0.9 * reveal})`);
      sclera.addColorStop(0.55, `rgba(140,140,140,${0.85 * reveal})`);
      sclera.addColorStop(1, `rgba(30,30,30,${0.8 * reveal})`);
      sctx.fillStyle = sclera;
      sctx.fill();
      sctx.clip();                                              // everything below lives inside the lids

      // ── the iris is a globe ──
      const gx = ecx, gy = ecy;
      // ocean disc, sphere-shaded (bright at upper-left, like a lit ball)
      const ocean = sctx.createRadialGradient(gx - irisR * 0.35, gy - irisR * 0.35, irisR * 0.1, gx, gy, irisR);
      ocean.addColorStop(0, `rgba(155,155,155,${reveal})`);
      ocean.addColorStop(0.7, `rgba(85,85,85,${reveal})`);
      ocean.addColorStop(1, `rgba(38,38,38,${reveal})`);
      sctx.beginPath();
      sctx.arc(gx, gy, irisR, 0, Math.PI * 2);
      sctx.fillStyle = ocean;
      sctx.fill();

      // continents — orthographic projection of the rotating sphere
      const cosT = Math.cos(TILT), sinT = Math.sin(TILT);
      for (const [lat, lon, rad] of LAND) {
        const la = (lat * Math.PI) / 180, lo = (lon * Math.PI) / 180 + spin;
        let x = Math.cos(la) * Math.sin(lo);
        let y = -Math.sin(la);
        let z = Math.cos(la) * Math.cos(lo);
        const y2 = y * cosT - z * sinT, z2 = y * sinT + z * cosT;   // tilt the axis
        if (z2 <= 0.05) continue;                                    // back of the planet
        const px = gx + x * irisR, py = gy + y2 * irisR;
        const pr = Math.max(0.6, (rad / 90) * irisR * 1.15) * (0.5 + z2 * 0.5);
        sctx.beginPath();
        sctx.arc(px, py, pr, 0, Math.PI * 2);
        sctx.fillStyle = `rgba(235,235,235,${0.95 * reveal * (0.45 + 0.55 * z2)})`;
        sctx.fill();
      }

      // limb darkening ring so the globe reads as a sphere, then the pupil
      sctx.beginPath();
      sctx.arc(gx, gy, irisR, 0, Math.PI * 2);
      sctx.strokeStyle = `rgba(0,0,0,${0.5 * reveal})`;
      sctx.lineWidth = Math.max(1, irisR * 0.12);
      sctx.stroke();
      const pupil = sctx.createRadialGradient(gx, gy, 0, gx, gy, irisR * 0.34);
      pupil.addColorStop(0, 'rgba(0,0,0,1)');
      pupil.addColorStop(0.85, 'rgba(0,0,0,0.95)');
      pupil.addColorStop(1, 'rgba(0,0,0,0)');
      sctx.beginPath();
      sctx.arc(gx, gy, irisR * 0.34, 0, Math.PI * 2);
      sctx.fillStyle = pupil;
      sctx.fill();

      // specular glint — the wet-eye highlight that sells the 3D
      sctx.beginPath();
      sctx.arc(gx - irisR * 0.38, gy - irisR * 0.42, Math.max(1, irisR * 0.11), 0, Math.PI * 2);
      sctx.fillStyle = `rgba(255,255,255,${reveal})`;
      sctx.fill();

      // inner lid shadow at the top, for depth
      const shade = sctx.createLinearGradient(0, ecy - open * 1.1, 0, ecy - open * 0.2);
      shade.addColorStop(0, `rgba(0,0,0,${0.75 * reveal})`);
      shade.addColorStop(1, 'rgba(0,0,0,0)');
      sctx.fillStyle = shade;
      sctx.fillRect(0, ecy - open * 1.2, cols, open);
      sctx.restore();
    };

    // ── halftone render: dots stay put, radii chase the scene's brightness ──
    let raf = 0;
    const t0 = performance.now();
    const render = () => {
      const t = (performance.now() - t0) / 1000;
      drawScene(t);
      const px = sctx.getImageData(0, 0, cols, rows).data;

      ctx.fillStyle = '#08060F';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#D9D2F2';
      ctx.beginPath();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const lum = Math.pow(px[i * 4] / 255, 0.62);                   // grayscale scene, gamma-lifted
          // ambient dot field — the whole screen is a living halftone, like a print
          const ambient = 0.11 + 0.05 * Math.sin(t * 1.8 + (i % 97) * 0.7 + (i % 13) * 1.3);
          const materialize = Math.min(1, t / 0.8);                      // the grid itself fades in
          const target = maxR * Math.min(1, Math.max(ambient, lum)) * materialize;
          radii[i] += (target - radii[i]) * 0.16;                        // ease — dots visibly grow
          const rad = radii[i];
          if (rad < 0.3) continue;
          const x = c * spacing + spacing / 2, y = r * spacing + spacing / 2;
          ctx.moveTo(x + rad, y);
          ctx.arc(x, y, rad, 0, Math.PI * 2);
        }
      }
      ctx.fill();
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.6 }}
      className="fixed inset-0 z-[9999] overflow-hidden"
      style={{ background: '#08060F' }}
    >
      <canvas ref={ref} className="absolute inset-0" />
      <div className="absolute inset-x-0 bottom-[12vh] flex flex-col items-center pointer-events-none">
        <motion.h1
          initial={{ opacity: 0, letterSpacing: '0.6em' }}
          animate={{ opacity: 1, letterSpacing: '0.32em' }}
          transition={{ duration: 1.4, delay: 2.2, ease: [0.16, 1, 0.3, 1] }}
          style={{
            fontFamily: 'var(--font-display)', fontWeight: 400,
            fontSize: 'clamp(28px, 6vw, 64px)', paddingLeft: '0.32em',
            color: 'var(--gold-primary)', textShadow: '0 0 28px rgba(154,123,255,0.5)',
          }}
        >
          PYTHIA
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 0.7 }} transition={{ duration: 1, delay: 3 }}
          className="text-[12px] tracking-[0.3em] text-[var(--text-muted)] mt-2"
        >
          THE ORACLE OPENS ITS EYE
        </motion.p>
      </div>
    </motion.div>
  );
}
