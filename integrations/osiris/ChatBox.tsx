'use client';

/** Chat with the oracle — or put one council specialist on the line.
 *  The dropdown picks who answers: PYTHIA itself (default) or a persona, in its
 *  own voice, via its own configured model. Everyone sees every live source +
 *  current predictions (via /api/engine/chat). */
import { useEffect, useRef, useState } from 'react';
import { Send, Loader2, Hexagon, Eye, ChevronDown } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string; by?: string };
type Persona = { name: string; lens: string };

const PERSONA_COLOR: Record<string, string> = {
  Strategist: 'var(--alert-red)', Economist: 'var(--gold-primary)',
  Naturalist: 'var(--cyan-primary)', Skeptic: 'var(--horizon-year)',
};

export default function ChatBox() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'assistant', content: "Ask me anything about what's happening — I'm watching every live feed (news, conflict, weather, seismic, cyber, market odds) and my own forecasts. Or put one of my council specialists on the line with the dropdown below." },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [roster, setRoster] = useState<Persona[]>([]);
  const [speaker, setSpeaker] = useState<string>('');   // '' = the oracle itself
  const [pickerOpen, setPickerOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const r = await fetch('/api/engine/personas');
        if (!r.ok) return;
        const j = await r.json();
        if (!stop) setRoster(j.personas || []);
      } catch { /* engine offline — oracle-only chat still works */ }
    })();
    return () => { stop = true; };
  }, []);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    const history = msgs.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: 'user', content: q }]);
    setBusy(true);
    try {
      // counterfactual mode: "/whatif the Strait of Hormuz closes tonight"
      const scenario = q.toLowerCase().startsWith('/whatif') ? q.slice(7).trim() : null;
      if (scenario) {
        const r = await fetch('/api/engine/whatif', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ scenario }) });
        const j = await r.json();
        const preds = (j.predictions || [])
          .map((p: any) => `• [${p.horizon}] ${Math.round(p.probability * 100)}% — ${p.statement}${p.location ? ` (${p.location})` : ''}`)
          .join('\n');
        setMsgs((m) => [...m, { role: 'assistant', content: `🔮 WHAT IF: ${j.scenario}\n\n${j.narrative || ''}${preds ? `\n\n${preds}` : ''}`.trim() || j.error || 'no response' }]);
      } else {
        const r = await fetch('/api/engine/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: q, history, ...(speaker ? { persona: speaker } : {}) }),
        });
        const j = await r.json();
        setMsgs((m) => [...m, { role: 'assistant', content: j.answer || j.error || 'no response', by: j.persona || undefined }]);
      }
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: '⚠ engine unreachable — is PYTHIA running?' }]);
    } finally {
      setBusy(false);
    }
  };

  const speakerColor = speaker ? PERSONA_COLOR[speaker] || 'var(--text-secondary)' : 'var(--gold-primary)';
  const speakerLens = roster.find((p) => p.name === speaker)?.lens;

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)]">
      <div className="flex-1 overflow-y-auto styled-scrollbar p-3 flex flex-col gap-2.5">
        {msgs.map((m, i) => (
          <div key={i} className={`max-w-[88%] ${m.role === 'user' ? 'self-end' : 'self-start'}`}>
            {m.role === 'assistant' && m.by && (
              <div className="flex items-center gap-1 mb-0.5 px-1">
                <Hexagon className="w-3 h-3" style={{ color: PERSONA_COLOR[m.by] || 'var(--text-muted)' }} />
                <span className="text-[10px] font-semibold" style={{ color: PERSONA_COLOR[m.by] || 'var(--text-muted)' }}>{m.by}</span>
              </div>
            )}
            <div className={`text-[13px] leading-relaxed px-3.5 py-2.5 whitespace-pre-wrap ${m.role === 'user' ? 'rounded-2xl rounded-br-md' : 'rounded-2xl rounded-bl-md'}`}
              style={{ background: m.role === 'user' ? 'var(--hover-accent)' : 'rgba(255,255,255,.04)', color: 'var(--text-primary)', border: '1px solid var(--border-secondary)' }}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && (
          <div className="self-start text-[12px] text-[var(--text-muted)] flex items-center gap-2 px-1">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> {speaker ? `the ${speaker} is thinking…` : 'consulting the feeds…'}
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="p-3 border-t border-[var(--border-secondary)]">
        {/* Who answers */}
        <div className="relative mb-2">
          <button onClick={() => setPickerOpen((o) => !o)} title={speakerLens ? `lens: ${speakerLens}` : 'PYTHIA — the oracle itself'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors border"
            style={{ borderColor: 'var(--border-secondary)', background: 'rgba(255,255,255,.03)', color: speakerColor }}>
            {speaker ? <Hexagon className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {speaker || 'Oracle'}
            <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
          </button>
          {pickerOpen && (
            <>
              <div className="fixed inset-0 z-[500]" onClick={() => setPickerOpen(false)} />
              <div className="absolute bottom-full left-0 mb-1 z-[501] glass-panel p-1.5 min-w-[230px]" style={{ borderRadius: 12 }}>
                <button onClick={() => { setSpeaker(''); setPickerOpen(false); }}
                  className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--hover-accent)] flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5" style={{ color: 'var(--gold-primary)' }} />
                  <span>
                    <span className="block text-[12px] font-semibold" style={{ color: speaker === '' ? 'var(--gold-primary)' : 'var(--text-primary)' }}>Oracle</span>
                    <span className="block text-[10px] text-[var(--text-muted)]">PYTHIA itself — the full picture</span>
                  </span>
                </button>
                {roster.map((p) => (
                  <button key={p.name} onClick={() => { setSpeaker(p.name); setPickerOpen(false); }}
                    className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-[var(--hover-accent)] flex items-center gap-2">
                    <Hexagon className="w-3.5 h-3.5" style={{ color: PERSONA_COLOR[p.name] || 'var(--text-muted)' }} />
                    <span>
                      <span className="block text-[12px] font-semibold" style={{ color: speaker === p.name ? PERSONA_COLOR[p.name] : 'var(--text-primary)' }}>{p.name}</span>
                      <span className="block text-[10px] text-[var(--text-muted)]">{p.lens}</span>
                    </span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
            placeholder={speaker ? `Ask the ${speaker}…` : 'Ask the oracle… (or: /whatif the Strait of Hormuz closes)'}
            className="flex-1 bg-[var(--hover-accent)] rounded-xl px-3.5 py-2.5 text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
          />
          <button onClick={send} disabled={busy || !input.trim()} title="Send"
            className="flex items-center justify-center w-10 h-10 rounded-xl disabled:opacity-40 transition-colors"
            style={{ background: 'var(--gold-primary)', color: '#0E0A1E' }}>
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
