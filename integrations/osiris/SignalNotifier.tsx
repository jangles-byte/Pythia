'use client';

/** Always-mounted signal poller — turns fired alert rules (and Morning Briefs)
 *  into browser notifications, even when no panel is open. Renders nothing. */
import { useEffect, useRef } from 'react';

export default function SignalNotifier() {
  const lastTs = useRef<number>(0);

  useEffect(() => {
    // start from "now" so a page reload doesn't replay the whole feed
    lastTs.current = Date.now();
    try {
      const saved = Number(localStorage.getItem('pythia-signal-ts'));
      if (saved > 0) lastTs.current = saved;
    } catch { /* private mode */ }

    let stop = false;
    const poll = async () => {
      try {
        const r = await fetch(`/api/engine/alerts/feed?since=${lastTs.current}`);
        if (!r.ok) return;
        const j = await r.json();
        const items: { ts: number; title: string; body: string; rule_name: string }[] = j.alerts || [];
        if (!items.length || stop) return;
        lastTs.current = Math.max(...items.map((a) => a.ts));
        try { localStorage.setItem('pythia-signal-ts', String(lastTs.current)); } catch { /* ok */ }
        if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
          // newest few only — never spam a returning tab
          for (const a of items.slice(-3)) {
            new Notification(`PYTHIA · ${a.rule_name}`, { body: `${a.title}\n${a.body || ''}`.trim(), icon: '/favicon-32x32.png', tag: `pythia-${a.ts}` });
          }
        }
      } catch { /* engine offline — try again next tick */ }
    };
    poll();
    const iv = setInterval(poll, 45000);
    return () => { stop = true; clearInterval(iv); };
  }, []);

  return null;
}
