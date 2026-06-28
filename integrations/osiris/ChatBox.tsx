'use client';

/** Chat with the oracle. It sees every live source + current predictions (via /api/engine/chat). */
import { useEffect, useRef, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';

type Msg = { role: 'user' | 'assistant'; content: string };

export default function ChatBox() {
  const [msgs, setMsgs] = useState<Msg[]>([
    { role: 'assistant', content: "Ask me anything about what's happening — I'm watching every live feed (news, conflict, weather, seismic, cyber, market odds) and my own forecasts." },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [msgs, busy]);

  const send = async () => {
    const q = input.trim();
    if (!q || busy) return;
    setInput('');
    const history = msgs.slice(-6).map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: 'user', content: q }]);
    setBusy(true);
    try {
      const r = await fetch('/api/engine/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message: q, history }) });
      const j = await r.json();
      setMsgs((m) => [...m, { role: 'assistant', content: j.answer || j.error || 'no response' }]);
    } catch {
      setMsgs((m) => [...m, { role: 'assistant', content: '⚠ engine unreachable — is PYTHIA running?' }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[var(--bg-panel)]">
      <div className="flex-1 overflow-y-auto styled-scrollbar p-2.5 flex flex-col gap-2">
        {msgs.map((m, i) => (
          <div key={i} className={`text-[11px] leading-relaxed rounded-lg px-2.5 py-1.5 max-w-[90%] whitespace-pre-wrap ${m.role === 'user' ? 'self-end' : 'self-start'}`}
            style={{ background: m.role === 'user' ? 'rgba(154,123,255,.20)' : 'rgba(255,255,255,.04)', color: 'var(--text-primary)' }}>
            {m.content}
          </div>
        ))}
        {busy && <div className="self-start text-[10px] text-[var(--text-muted)] flex items-center gap-1.5 px-1"><Loader2 className="w-3 h-3 animate-spin" /> consulting the feeds…</div>}
        <div ref={endRef} />
      </div>
      <div className="flex items-center gap-1.5 p-2 border-t border-[var(--border-secondary)]">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') send(); }}
          placeholder="Ask the oracle…"
          className="flex-1 bg-[var(--hover-accent)] rounded-lg px-2.5 py-1.5 text-[11px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
        />
        <button onClick={send} disabled={busy} className="p-1.5 rounded-lg disabled:opacity-50" style={{ background: 'rgba(154,123,255,.22)', color: 'var(--gold-primary)' }}><Send className="w-3.5 h-3.5" /></button>
      </div>
    </div>
  );
}
