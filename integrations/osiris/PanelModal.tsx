'use client';

/**
 * PanelModal — the one big, centered popup shell every dashboard panel opens in.
 * Replaces the old edge slideouts (which hung half off-screen with no close button).
 * Backdrop click, the × button, and Esc all close it.
 */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export default function PanelModal({ open, onClose, title, subtitle, icon, width = 880, children }: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  /** max content width in px — the modal is min(width, 94vw) */
  width?: number;
  children: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.16 }}
          onClick={onClose}
          className="fixed inset-0 z-[560] flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-[6px] pointer-events-auto"
        >
          <motion.div
            initial={{ scale: 0.97, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.97, y: 10 }}
            transition={{ type: 'spring', damping: 30, stiffness: 360 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-panel flex flex-col overflow-hidden"
            style={{ width: `min(${width}px, 94vw)`, maxHeight: 'min(880px, 90vh)', borderRadius: 16 }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-[var(--border-secondary)] shrink-0">
              {icon && <span className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0" style={{ background: 'var(--hover-accent)', color: 'var(--gold-primary)' }}>{icon}</span>}
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-semibold text-[var(--text-primary)] leading-tight truncate">{title}</div>
                {subtitle && <div className="text-[11px] text-[var(--text-muted)] leading-tight mt-0.5 truncate">{subtitle}</div>}
              </div>
              <button
                onClick={onClose} title="Close (Esc)"
                className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--hover-accent)]"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            {/* Body */}
            <div className="flex-1 min-h-0 overflow-y-auto styled-scrollbar px-5 py-4">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
