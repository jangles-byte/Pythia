'use client';

/** MiroFish swarm config — pick which installed model each persona uses when it deliberates.
 *  Blank = the main oracle model. Choices come from your Ollama install. */
import { useEffect, useState } from 'react';
import { Hexagon } from 'lucide-react';

type Data = { personas: string[]; overrides: Record<string, string>; default_model: string; available: string[] };

const COLOR: Record<string, string> = {
  Strategist: 'var(--alert-red)', Economist: 'var(--gold-primary)',
  Naturalist: 'var(--cyan-primary)', Skeptic: 'var(--text-secondary)',
};
const LENS: Record<string, string> = {
  Strategist: 'geopolitics', Economist: 'markets', Naturalist: 'disasters', Skeptic: 'base rates',
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
    <div className="mt-2 mb-1 rounded-lg border border-[var(--border-secondary)] p-2.5" style={{ background: 'rgba(255,255,255,.02)' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <Hexagon className="w-3 h-3" style={{ color: 'var(--gold-primary)' }} />
        <span className="text-[9px] font-mono tracking-widest text-[var(--text-secondary)]">SWARM MODELS</span>
        <span className="text-[8px] font-mono text-[var(--text-muted)] ml-auto truncate max-w-[120px]" title={`main model: ${d.default_model}`}>default · {d.default_model}</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {d.personas.map((p) => (
          <div key={p} className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: COLOR[p] || 'var(--text-muted)' }} />
            <span className="text-[9px] font-mono w-[62px] shrink-0" style={{ color: COLOR[p] || 'var(--text-secondary)' }} title={LENS[p]}>{p}</span>
            <select
              value={d.overrides[p] || ''}
              onChange={(e) => pick(p, e.target.value)}
              className="flex-1 min-w-0 text-[9px] font-mono rounded px-1.5 py-1 outline-none cursor-pointer"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }}
            >
              <option value="">Main model (default)</option>
              {d.available.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        ))}
      </div>
      {d.available.length === 0 && (
        <div className="text-[8px] font-mono text-[var(--text-muted)] mt-1.5">no models found — is Ollama running?</div>
      )}
    </div>
  );
}
