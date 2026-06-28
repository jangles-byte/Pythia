'use client';

/** Compact live status — Osiris (the eyes) + the Oracle (the brain) + model picker. */
import { useEffect, useState } from 'react';
import { Loader2, ChevronDown } from 'lucide-react';

type Links = {
  engine?: boolean; osiris?: boolean; oracle?: boolean; model?: string;
  generating?: boolean; loop?: boolean; prediction_count?: number;
};

function Dot({ on, label }: { on?: boolean; label: string }) {
  return (
    <span className="flex items-center gap-1" title={`${label}: ${on ? 'online' : 'offline'}`}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? 'var(--cyan-primary)' : 'var(--alert-red)', boxShadow: on ? '0 0 6px var(--cyan-primary)' : 'none' }} />
      <span className="text-[8px] font-mono tracking-widest" style={{ color: on ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{label}</span>
    </span>
  );
}

export default function PythiaStatus({ compact = false }: { compact?: boolean }) {
  const [s, setS] = useState<Links>({});
  const [models, setModels] = useState<string[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try { const r = await fetch('/api/engine/links'); const j = await r.json(); if (!stop) setS(j); }
      catch { if (!stop) setS({}); }
    };
    const loadModels = async () => {
      try { const r = await fetch('/api/engine/models'); const j = await r.json(); if (!stop) setModels(j.models || []); }
      catch { /* offline */ }
    };
    tick(); loadModels();
    const iv = setInterval(tick, 5000);
    const iv2 = setInterval(loadModels, 30000);
    return () => { stop = true; clearInterval(iv); clearInterval(iv2); };
  }, []);

  const pick = async (m: string) => {
    setOpen(false);
    setS((p) => ({ ...p, model: m }));
    await fetch('/api/engine/model', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model: m }) });
  };

  return (
    <div className={`glass-panel pointer-events-auto flex items-center gap-2.5 ${compact ? 'px-2 py-1' : 'px-3 py-1.5'}`}>
      {s.generating
        ? <span className="flex items-center gap-1 text-[8px] font-mono font-bold tracking-widest text-[var(--gold-primary)]"><Loader2 className="w-2.5 h-2.5 animate-spin" /> FORECASTING</span>
        : <span className="text-[8px] font-mono font-bold tracking-widest text-[var(--cyan-primary)]">ORACLE</span>}

      {!compact && (
        <div className="relative">
          <button onClick={() => setOpen((o) => !o)} title="Choose the oracle model" className="flex items-center gap-1 text-[9px] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] max-w-[130px]">
            <span className="truncate">{s.model || '—'}</span>
            <ChevronDown className="w-2.5 h-2.5 shrink-0" />
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-[400]" onClick={() => setOpen(false)} />
              <div className="absolute right-0 mt-1 z-[401] glass-panel p-1 min-w-[150px] max-h-[240px] overflow-y-auto">
                {models.length === 0 && <div className="text-[8px] font-mono text-[var(--text-muted)] px-2 py-1">no models found</div>}
                {models.map((m) => (
                  <button key={m} onClick={() => pick(m)} className="w-full text-left text-[9px] font-mono px-2 py-1 rounded hover:bg-[var(--hover-accent)] truncate"
                    style={{ color: m === s.model ? 'var(--gold-primary)' : 'var(--text-secondary)' }}>
                    {m === s.model ? '● ' : ''}{m}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <span className="flex items-center gap-2 border-l border-[var(--border-primary)] pl-2.5">
        <Dot on={s.osiris} label="OSIRIS" />
        <Dot on={s.oracle} label="ORACLE" />
      </span>
    </div>
  );
}
