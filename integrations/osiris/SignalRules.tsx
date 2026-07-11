'use client';

/** Signal rules — "tap me on the shoulder when…"
 *  Create alert rules over everything PYTHIA watches; the engine evaluates them
 *  every minute and fires into the signals feed (+ browser notifications + webhooks).
 *  Renders at the top of the Live Alerts panel. */
import { useEffect, useState, useCallback } from 'react';
import { BellRing, Plus, Trash2, Power } from 'lucide-react';

type Rule = { id: string; name: string; kind: string; params: Record<string, any>; enabled: boolean };

const PRESETS: { key: string; label: string; kind: string; fields: { name: string; label: string; def: string; width?: number }[] }[] = [
  { key: 'quake', label: 'Earthquake ≥ magnitude', kind: 'quake', fields: [{ name: 'min_magnitude', label: 'M', def: '6.0', width: 64 }] },
  { key: 'market', label: 'Market move', kind: 'market', fields: [{ name: 'symbol', label: 'symbol', def: 'CL=F', width: 90 }, { name: 'move_percent', label: '±%', def: '3', width: 56 }] },
  { key: 'vix', label: 'VIX above', kind: 'vix', fields: [{ name: 'level', label: 'level', def: '25', width: 64 }] },
  { key: 'forecast', label: 'Forecast ≥ probability', kind: 'forecast', fields: [{ name: 'min_probability', label: '0–1', def: '0.85', width: 64 }, { name: 'keywords', label: 'keywords (optional)', def: '', width: 150 }] },
  { key: 'event', label: 'Keyword event', kind: 'event', fields: [{ name: 'keywords', label: 'keywords, comma-sep', def: '', width: 170 }, { name: 'min_salience', label: 'salience 0–1', def: '0.6', width: 70 }] },
  { key: 'odds_swing', label: 'Crowd-odds swing ≥', kind: 'odds_swing', fields: [{ name: 'min_move', label: '0–1 (0.1 = 10pts)', def: '0.1', width: 110 }] },
];

const KIND_LABEL: Record<string, string> = { quake: 'quake', market: 'market', vix: 'VIX', forecast: 'forecast', event: 'event', odds_swing: 'odds' };

export default function SignalRules() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [engineUp, setEngineUp] = useState(true);
  const [adding, setAdding] = useState(false);
  const [preset, setPreset] = useState(PRESETS[0]);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [notifs, setNotifs] = useState<NotificationPermission>('default');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/engine/alerts');
      if (!r.ok) throw new Error();
      const j = await r.json();
      setRules(j.rules || []);
      setEngineUp(true);
    } catch { setEngineUp(false); }
  }, []);

  useEffect(() => {
    load();
    if (typeof Notification !== 'undefined') setNotifs(Notification.permission);
  }, [load]);

  const enableNotifs = async () => {
    if (typeof Notification === 'undefined') return;
    setNotifs(await Notification.requestPermission());
  };

  const save = async () => {
    const params: Record<string, any> = {};
    for (const f of preset.fields) {
      const raw = (vals[f.name] ?? f.def).trim();
      params[f.name] = isNaN(Number(raw)) || raw === '' ? raw : Number(raw);
    }
    const label = preset.fields.map((f) => `${vals[f.name] ?? f.def}`).filter(Boolean).join(' ');
    try {
      await fetch('/api/engine/alerts', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: preset.kind, name: `${preset.label} ${label}`.trim(), params }),
      });
      setAdding(false); setVals({});
      load();
      if (notifs === 'default') enableNotifs();
    } catch { /* engine offline */ }
  };

  const toggle = async (r: Rule) => {
    await fetch('/api/engine/alerts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...r, enabled: !r.enabled }) });
    load();
  };
  const del = async (id: string) => {
    await fetch(`/api/engine/alerts/${id}`, { method: 'DELETE' });
    load();
  };

  return (
    <div className="mb-3 rounded-xl border border-[var(--border-secondary)] p-3" style={{ background: 'rgba(255,255,255,.02)' }}>
      <div className="flex items-center gap-2 mb-2">
        <BellRing className="w-4 h-4" style={{ color: 'var(--gold-primary)' }} />
        <span className="text-[13px] font-semibold text-[var(--text-primary)]">Signal rules</span>
        <span className="text-[11px] text-[var(--text-muted)]">· tap me on the shoulder when…</span>
        <div className="ml-auto flex items-center gap-2">
          {notifs !== 'granted' && (
            <button onClick={enableNotifs} className="text-[11px] font-medium px-2 py-1 rounded-lg transition-colors"
              style={{ background: 'var(--hover-accent)', color: 'var(--cyan-primary)', border: '1px solid var(--border-secondary)' }}>
              Enable notifications
            </button>
          )}
          <button onClick={() => setAdding((a) => !a)} title="New rule"
            className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg transition-colors"
            style={{ background: 'var(--hover-accent)', color: 'var(--gold-primary)', border: '1px solid var(--border-secondary)' }}>
            <Plus className="w-3.5 h-3.5" /> Rule
          </button>
        </div>
      </div>

      {!engineUp && <div className="text-[11px] text-[var(--text-muted)] pb-1">engine offline — rules load when it returns</div>}

      {adding && (
        <div className="flex flex-wrap items-center gap-2 mb-2 p-2.5 rounded-lg" style={{ background: 'var(--hover-accent)' }}>
          <select value={preset.key} onChange={(e) => { setPreset(PRESETS.find((p) => p.key === e.target.value)!); setVals({}); }}
            className="text-[12px] rounded-lg px-2 py-1.5 outline-none cursor-pointer"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-primary)' }}>
            {PRESETS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
          </select>
          {preset.fields.map((f) => (
            <input key={f.name} value={vals[f.name] ?? ''} placeholder={f.def || f.label}
              onChange={(e) => setVals((v) => ({ ...v, [f.name]: e.target.value }))}
              title={f.label} style={{ width: f.width }}
              className="text-[12px] font-mono rounded-lg px-2 py-1.5 outline-none bg-[var(--bg-tertiary)] text-[var(--text-primary)] border border-[var(--border-primary)] placeholder:text-[var(--text-muted)]" />
          ))}
          <button onClick={save} className="text-[12px] font-semibold px-3 py-1.5 rounded-lg" style={{ background: 'var(--gold-primary)', color: '#0E0A1E' }}>Save</button>
        </div>
      )}

      {rules.length === 0 && engineUp && !adding && (
        <div className="text-[11px] text-[var(--text-muted)]">No rules yet — try “Earthquake ≥ M6” or “VIX above 25”. Alerts land in the Signals tab, your browser notifications, and any webhooks.</div>
      )}
      <div className="flex flex-col gap-1">
        {rules.map((r) => (
          <div key={r.id} className="flex items-center gap-2 text-[12px] px-2 py-1.5 rounded-lg hover:bg-[var(--hover-accent)] transition-colors group">
            <span className="text-[10px] font-mono px-1.5 py-[1px] rounded-full shrink-0" style={{ background: 'var(--hover-accent)', color: 'var(--cyan-primary)', border: '1px solid var(--border-secondary)' }}>{KIND_LABEL[r.kind] || r.kind}</span>
            <span className={r.enabled ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] line-through'}>{r.name}</span>
            <span className="ml-auto flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button onClick={() => toggle(r)} title={r.enabled ? 'Disable' : 'Enable'} className="p-1 rounded hover:bg-[var(--hover-accent)]">
                <Power className="w-3.5 h-3.5" style={{ color: r.enabled ? 'var(--alert-green)' : 'var(--text-muted)' }} />
              </button>
              <button onClick={() => del(r.id)} title="Delete" className="p-1 rounded hover:bg-[var(--hover-accent)]">
                <Trash2 className="w-3.5 h-3.5 text-[var(--text-muted)] hover:text-[var(--alert-red)]" />
              </button>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
