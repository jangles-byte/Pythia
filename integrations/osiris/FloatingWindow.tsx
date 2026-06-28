'use client';

/** A borderless, draggable, resizable floating window. Open several; keep using the app. */
import { useEffect, useRef, useState } from 'react';
import { X, Minus } from 'lucide-react';

type Props = {
  title: string;
  icon?: React.ReactNode;
  initial: { x: number; y: number; w: number; h: number };
  z: number;
  onClose: () => void;
  onFocus: () => void;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
};

export default function FloatingWindow({ title, icon, initial, z, onClose, onFocus, headerRight, children }: Props) {
  const [pos, setPos] = useState({ x: initial.x, y: initial.y });
  const [size, setSize] = useState({ w: initial.w, h: initial.h });
  const [min, setMin] = useState(false);
  const drag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const rez = useRef<{ sx: number; sy: number; pw: number; ph: number } | null>(null);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (drag.current) {
        const d = drag.current;
        setPos({ x: Math.max(0, d.px + e.clientX - d.sx), y: Math.max(0, d.py + e.clientY - d.sy) });
      } else if (rez.current) {
        const r = rez.current;
        setSize({ w: Math.max(260, r.pw + e.clientX - r.sx), h: Math.max(160, r.ph + e.clientY - r.sy) });
      }
    };
    const up = () => { drag.current = null; rez.current = null; document.body.style.userSelect = ''; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, []);

  const startDrag = (e: React.MouseEvent) => { onFocus(); drag.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y }; document.body.style.userSelect = 'none'; };
  const startResize = (e: React.MouseEvent) => { e.stopPropagation(); onFocus(); rez.current = { sx: e.clientX, sy: e.clientY, pw: size.w, ph: size.h }; document.body.style.userSelect = 'none'; };

  return (
    <div
      className="fixed glass-panel pointer-events-auto flex flex-col overflow-hidden"
      style={{ left: pos.x, top: pos.y, width: size.w, height: min ? undefined : size.h, zIndex: z, boxShadow: '0 12px 48px rgba(0,0,0,0.6)' }}
      onMouseDown={onFocus}
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 cursor-move select-none border-b border-[var(--border-secondary)]" style={{ background: 'rgba(255,255,255,0.03)' }} onMouseDown={startDrag}>
        <div className="flex items-center gap-1.5 min-w-0">
          {icon}
          <span className="text-[10px] font-mono tracking-wider text-[var(--text-primary)] truncate">{title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0 pl-2">
          {headerRight}
          <button onClick={(e) => { e.stopPropagation(); setMin((m) => !m); }} title="Minimize" className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"><Minus className="w-3 h-3" /></button>
          <button onClick={(e) => { e.stopPropagation(); onClose(); }} title="Close" className="text-[var(--text-muted)] hover:text-[var(--alert-red)]"><X className="w-3 h-3" /></button>
        </div>
      </div>
      {!min && <div className="flex-1 overflow-hidden relative">{children}</div>}
      {!min && (
        <div onMouseDown={startResize} title="Resize" className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize z-10" style={{ background: 'linear-gradient(135deg, transparent 45%, var(--gold-primary) 45%, var(--gold-primary) 55%, transparent 55%)', opacity: 0.6 }} />
      )}
    </div>
  );
}
