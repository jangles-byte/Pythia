'use client';

/** Council setup — pick which installed model each persona uses when it deliberates.
 *  Blank = the main oracle model. Choices come from your Ollama install. */
import { useEffect, useState } from 'react';
import { Hexagon } from 'lucide-react';

type Data = { personas: string[]; overrides: Record<string, string>; default_model: string; available: string[] };

const COLOR: Record<string, string> = {
  Strategist: 'var(--alert-red)', Economist: 'var(--gold-primary)',
  Naturalist: 'var(--cyan-primary)', Skeptic: 'var(--horizon-year)',
};
const LENS: Record<string, string> = {
  Strategist: 'geopolitics & conflict', Economist: 'markets & economy',
  Naturalist: 'disasters & climate', Skeptic: 'base rates & doubt',
};

export default function SwarmConfig() {
  const [d, setD] = useState<Data | null>(null);

  const load = async () => {
    try { const r = await fetch('/api/engine/swarm/models'); if (r.ok) setD(await r.json()); } catch { /* offline */ }
  };
  useEffect(() => { load(); }, []);

  const pick = async (persona: string, model: string) => {
    setD((p) => {
      if (!p) return p;
      const overrides = { ...p.overrides };
      if (model) overrides[persona] = model; else delete overrides[persona];
      return { ...p, overrides };
    });
    await fetch('/api/engine/swarm/model', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona, model }),
    });
  };

  if (!d) return null;
  return (
    <div className="mb-3 rounded-xl border border-[var(--border-secondary)] p-4" style={{ background: 'rgba(255,255,255,.02)' }}>
      <div className="flex items-center gap-2 mb-3">
        <Hexagon className="w-4 h-4" style={{ color: 'var(--gold-primary)' }} />
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">Council models</span>
        <span className="text-[11px] text-[var(--text-muted)] ml-auto truncate max-w-[220px]" title={`main oracle model: ${d.default_model}`}>oracle default · <span className="font-mono">{d.default_model}</span></span>
      </div>
      <div className="grid md:grid-cols-2 gap-2">
        {d.personas.map((p) => (
          <div key={p} className="flex items-center gap-2.5 rounded-lg border border-[var(--border-secondary)] px-3 py-2" style={{ background: 'rgba(255,255,255,.02)' }}>
            <Hexagon className="w-3.5 h-3.5 shrink-0" style={{ color: COLOR[p] || 'var(--text-muted)' }} />
            <div className="min-w-0 w-[110px] shrink-0">
              <div className="text-[12px] font-semibold leading-tight" style={{ color: COLOR[p] || 'var(--text-secondary)' }}>{p}</div>
              <div className="text-[10px] text-[var(--text-muted)] leading-tight truncate">{LENS[p]}</div>
            </div>
            <select
              value={d.overrides[p] || ''}
              onChange={(e) => pick(p, e.target.value)}
              className="flex-1 min-w-0 text-[12px] font-mono rounded-lg px-2 py-1.5 outline-none cursor-pointer"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }}
            >
              <option value="">Main model (default)</option>
              {d.available.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        ))}
      </div>
      {d.available.length === 0 && (
        <div className="text-[12px] text-[var(--text-muted)] mt-2">No models found — is Ollama running?</div>
      )}
    </div>
  );
}
