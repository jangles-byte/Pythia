'use client';

/** PYTHIA status — one brand header + three unnamed health dots (engine · Osiris · Ollama)
 *  so you can glance and see everything's up. Plus the oracle model picker. */
import { useEffect, useState } from 'react';
import { Loader2, ChevronDown } from 'lucide-react';

type Links = {
  engine?: boolean; osiris?: boolean; oracle?: boolean; model?: string;
  generating?: boolean; loop?: boolean; prediction_count?: number;
};

function StatusDot({ on, label }: { on?: boolean; label: string }) {
  return (
    <span
      title={`${label}: ${on ? 'connected' : 'offline'}`}
      className="w-2 h-2 rounded-full transition-colors"
      style={{ background: on ? 'var(--cyan-primary)' : 'var(--alert-red)', boxShadow: on ? '0 0 6px var(--cyan-primary)' : 'none' }}
    />
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
    <div className={`glass-panel pointer-events-auto flex flex-col gap-1 ${compact ? 'px-2.5 py-1' : 'px-3 py-1.5'}`}>
      {/* Brand + forecasting state */}
      <div className="flex items-center justify-between gap-3">
        <span className="pythia-display text-[12px] font-bold tracking-[0.22em] text-[var(--gold-primary)]">PYTHIA</span>
        {s.generating && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-[var(--gold-primary)]">
            <Loader2 className="w-3 h-3 animate-spin" /> forecasting…
          </span>
        )}
      </div>

      {/* Three health dots (engine · Osiris · Ollama) + model picker */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <StatusDot on={s.engine} label="Engine" />
          <StatusDot on={s.osiris} label="Osiris" />
          <StatusDot on={s.oracle} label="Ollama" />
        </div>

        {!compact && (
          <div className="relative">
            <button onClick={() => setOpen((o) => !o)} title="Choose the oracle model" className="flex items-center gap-1 text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-secondary)] max-w-[140px]">
              <span className="truncate">{s.model || '—'}</span>
              <ChevronDown className="w-3 h-3 shrink-0" />
            </button>
            {open && (
              <>
                <div className="fixed inset-0 z-[400]" onClick={() => setOpen(false)} />
                <div className="absolute right-0 mt-1 z-[401] glass-panel p-1.5 min-w-[180px] max-h-[260px] overflow-y-auto" style={{ borderRadius: 12 }}>
                  {models.length === 0 && <div className="text-[11px] text-[var(--text-muted)] px-2 py-1.5">no models found</div>}
                  {models.map((m) => (
                    <button key={m} onClick={() => pick(m)} className="w-full text-left text-[11px] font-mono px-2.5 py-1.5 rounded-lg hover:bg-[var(--hover-accent)] truncate"
                      style={{ color: m === s.model ? 'var(--gold-primary)' : 'var(--text-secondary)' }}>
                      {m === s.model ? '● ' : ''}{m}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
