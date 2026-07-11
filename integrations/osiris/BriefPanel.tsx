'use client';

/** The Morning Brief — PYTHIA's daily digest, in the deck.
 *  Latest brief text, generate-now, and the daily schedule (time + on/off).
 *  Data: GET /api/engine/brief, POST /api/engine/brief/run, POST /api/engine/brief/config. */
import { useEffect, useState, useCallback } from 'react';
import { Sunrise, Loader2, RefreshCw } from 'lucide-react';

type BriefData = { config: { time: string; enabled: boolean }; latest: { date: string; text: string } | null; history: string[] };

export default function BriefPanel() {
  const [d, setD] = useState<BriefData | null>(null);
  const [busy, setBusy] = useState(false);
  const [engineUp, setEngineUp] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/engine/brief');
      if (!r.ok) throw new Error();
      setD(await r.json());
      setEngineUp(true);
    } catch { setEngineUp(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const run = async () => {
    setBusy(true);
    try { await fetch('/api/engine/brief/run', { method: 'POST' }); await load(); }
    catch { /* engine offline */ }
    finally { setBusy(false); }
  };

  const setConfig = async (patch: { time?: string; enabled?: boolean }) => {
    try {
      await fetch('/api/engine/brief/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      load();
    } catch { /* offline */ }
  };

  return (
    <div className="mb-3 rounded-xl border border-[var(--border-secondary)] p-4" style={{ background: 'rgba(255,255,255,.02)' }}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <Sunrise className="w-4 h-4" style={{ color: 'var(--gold-primary)' }} />
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">Morning Brief</span>
        {d?.latest && <span className="text-[11px] text-[var(--text-muted)]">· {d.latest.date}</span>}
        <div className="ml-auto flex items-center gap-2">
          {d && (
            <>
              <label className="flex items-center gap-1.5 text-[11px] text-[var(--text-muted)]">
                daily at
                <input type="time" value={d.config.time}
                  onChange={(e) => setConfig({ time: e.target.value })}
                  className="text-[11px] font-mono rounded-lg px-1.5 py-1 outline-none bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)]" />
              </label>
              <button onClick={() => setConfig({ enabled: !d.config.enabled })}
                className="text-[11px] font-medium px-2 py-1 rounded-lg transition-colors"
                style={{ background: 'var(--hover-accent)', color: d.config.enabled ? 'var(--alert-green)' : 'var(--text-muted)', border: '1px solid var(--border-secondary)' }}>
                {d.config.enabled ? 'On' : 'Off'}
              </button>
            </>
          )}
          <button onClick={run} disabled={busy}
            className="flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-lg disabled:opacity-50"
            style={{ background: 'var(--gold-primary)', color: '#0E0A1E' }}>
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Write it now
          </button>
        </div>
      </div>

      {!engineUp && <div className="text-[12px] text-[var(--text-muted)]">engine offline — the brief loads when it returns.</div>}
      {engineUp && !d?.latest && !busy && (
        <div className="text-[12px] text-[var(--text-muted)] leading-relaxed">
          No brief yet today. It writes itself every morning at the set time — overnight developments,
          what resolves today, watchlist moves, and what to watch. Or hit <span className="text-[var(--gold-primary)] font-semibold">Write it now</span>.
        </div>
      )}
      {busy && !d?.latest && <div className="text-[12px] text-[var(--text-muted)] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> the oracle is writing…</div>}
      {d?.latest && (
        <pre className="text-[12.5px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap font-[inherit] max-h-[340px] overflow-y-auto styled-scrollbar rounded-lg p-3" style={{ background: 'rgba(255,255,255,.02)' }}>
          {d.latest.text}
        </pre>
      )}
    </div>
  );
}
