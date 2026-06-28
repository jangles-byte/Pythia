'use client';

/** Tucked-away credits — gives the upstream repos their due, off the main dashboard. */
import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Crosshair } from 'lucide-react';

const CREDITS = [
  { name: 'Osiris', role: 'Live world feeds & interface', url: 'https://github.com/simplifaisoul/osiris', by: 'simplifaisoul' },
  { name: 'MiroFish', role: 'Prediction-engine concept & model', url: 'https://github.com/666ghj/MiroFish', by: '666ghj' },
  { name: 'Ollama', role: 'Local LLM runtime (the oracle)', url: 'https://ollama.com', by: 'Ollama' },
];

export default function CreditsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
          style={{ background: 'rgba(4,4,12,0.7)', backdropFilter: 'blur(6px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.94, y: 12, opacity: 0 }} animate={{ scale: 1, y: 0, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="glass-panel p-5 w-full max-w-md pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-[var(--gold-primary)]" />
                <span className="pythia-display text-base font-bold tracking-[0.2em] text-[var(--text-heading)]">PYTHIA</span>
              </div>
              <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"><X className="w-4 h-4" /></button>
            </div>

            <p className="text-[11px] leading-relaxed text-[var(--text-secondary)] mb-4">
              A world-watching prediction oracle — Osiris's live feeds become forecasts
              of what happens next, via a local AI model. Built on these projects:
            </p>

            <div className="flex flex-col gap-2">
              {CREDITS.map((c) => (
                <a key={c.name} href={c.url} target="_blank" rel="noopener noreferrer"
                  className="group flex items-center justify-between rounded-xl border border-[var(--border-secondary)] hover:border-[var(--border-active)] px-3 py-2 transition-colors"
                  style={{ background: 'rgba(255,255,255,.02)' }}>
                  <div className="flex flex-col">
                    <span className="text-[12px] font-semibold text-[var(--text-primary)]">{c.name} <span className="text-[9px] font-mono text-[var(--text-muted)]">· {c.by}</span></span>
                    <span className="text-[9px] font-mono text-[var(--text-muted)]">{c.role}</span>
                  </div>
                  <ExternalLink className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--gold-primary)]" />
                </a>
              ))}
            </div>

            <p className="text-[8px] font-mono tracking-widest text-[var(--text-muted)] text-center mt-4 opacity-60">
              CREATED USING MIROFISH × OSIRIS · LOCAL ORACLE
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
