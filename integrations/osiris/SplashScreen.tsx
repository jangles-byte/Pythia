'use client';

/** PYTHIA loading screen — a school of fish circling the eye (a nod to MiroFish). */
import { motion } from 'framer-motion';

type F = { r: number; dur: number; rev?: boolean; size: number; delay: number; color: string };

// radius, orbit duration (s), size, start delay, color — varied for a living school
const FISH: F[] = [
  { r: 86, dur: 8, size: 26, delay: 0, color: 'var(--cyan-primary)' },
  { r: 118, dur: 13, size: 20, delay: 1.2, color: 'var(--gold-primary)', rev: true },
  { r: 150, dur: 17, size: 30, delay: 0.4, color: 'var(--gold-light)' },
  { r: 104, dur: 10, size: 18, delay: 2.1, color: 'var(--cyan-primary)', rev: true },
  { r: 176, dur: 21, size: 22, delay: 0.8, color: 'var(--cyan-primary)' },
  { r: 202, dur: 27, size: 16, delay: 1.6, color: 'var(--gold-primary)', rev: true },
  { r: 134, dur: 15, size: 24, delay: 3.0, color: 'var(--gold-light)' },
  { r: 160, dur: 19, size: 18, delay: 4.2, color: 'var(--cyan-primary)', rev: true },
];

function Fish({ size, color }: { size: number; color: string }) {
  // a fish facing +x; placed at the top of a rotating arm so it always swims tangentially
  return (
    <svg width={size} height={size * 0.56} viewBox="0 0 44 22" style={{ overflow: 'visible', filter: `drop-shadow(0 0 5px ${color})` }}>
      <g className="pythia-fish-bob" style={{ transformOrigin: 'center' }}>
        <path d="M2 11 L14 3 L14 19 Z" fill={color} opacity="0.85" />
        <ellipse cx="26" cy="11" rx="14" ry="7.5" fill={color} />
        <circle cx="33" cy="9" r="1.5" fill="#070611" />
      </g>
    </svg>
  );
}

export default function SplashScreen() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.7 } }}
      transition={{ duration: 0.5 }}
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'radial-gradient(circle at 50% 44%, #120c26 0%, #070611 72%)' }}
    >
      <div className="relative flex items-center justify-center" style={{ width: 460, height: 460 }}>
        {/* faint orbit rings */}
        {[118, 176, 202].map((r) => (
          <div key={r} className="absolute rounded-full border" style={{ width: r * 2, height: r * 2, borderColor: 'rgba(154,123,255,0.06)' }} />
        ))}
        {/* circling fish */}
        {FISH.map((f, i) => (
          <div key={i} className="absolute" style={{ animation: `pythia-orbit ${f.dur}s linear infinite ${f.rev ? 'reverse' : 'normal'}`, animationDelay: `-${f.delay}s` }}>
            <div style={{ transform: `translateY(-${f.r}px)` }}>
              <Fish size={f.size} color={f.color} />
            </div>
          </div>
        ))}
        {/* the eye */}
        <motion.img
          src="/pythia-logo.png"
          alt=""
          width={124}
          height={124}
          initial={{ scale: 0.82, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          className="pythia-eye-pulse"
          style={{ borderRadius: 18 }}
          draggable={false}
        />
      </div>

      <motion.h1
        initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ delay: 0.5, duration: 0.7 }}
        className="pythia-wordmark text-3xl md:text-4xl font-bold tracking-[0.45em] mt-1"
      >
        PYTHIA
      </motion.h1>
    </motion.div>
  );
}
