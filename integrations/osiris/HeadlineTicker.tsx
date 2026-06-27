'use client';

/** Big world-headline surfacer — scrolls top breaking headlines along the bottom. */
import { useEffect, useState } from 'react';

type News = { id?: string; title: string; source?: string; risk_score?: number; link?: string };

export default function HeadlineTicker() {
  const [news, setNews] = useState<News[]>([]);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const r = await fetch('/api/news');
        const j = await r.json();
        const items: News[] = (j.news || [])
          .filter((n: News) => n.title)
          .sort((a: News, b: News) => (b.risk_score || 0) - (a.risk_score || 0))
          .slice(0, 20);
        if (!stop) setNews(items);
      } catch { /* offline */ }
    };
    load();
    const iv = setInterval(load, 120000); // refresh headlines every 2 min
    return () => { stop = true; clearInterval(iv); };
  }, []);

  if (!news.length) return null;

  const dot = (r?: number) => ((r || 0) >= 70 ? 'var(--alert-red)' : (r || 0) >= 40 ? 'var(--gold-primary)' : 'var(--cyan-primary)');
  const content = (
    <>
      {news.map((n, i) => (
        <span key={(n.id || '') + i} className="inline-flex items-center gap-2 mx-6">
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: dot(n.risk_score) }} />
          <span className="text-[var(--text-primary)] font-semibold">{n.title}</span>
          {n.source && <span className="text-[var(--text-muted)] text-[9px] uppercase tracking-wider">· {n.source}</span>}
        </span>
      ))}
    </>
  );

  return (
    <div className="hidden md:block absolute bottom-0 left-0 right-0 z-[199] pointer-events-none">
      <div className="h-[30px] overflow-hidden bg-black/90 border-t border-[var(--gold-primary)]/45 flex items-center text-[12px] backdrop-blur-md" style={{ boxShadow: '0 -6px 24px rgba(154,123,255,0.14)' }}>
        <div className="flex-shrink-0 px-3 h-full flex items-center gap-1.5 border-r border-[var(--gold-primary)]/40 bg-black relative z-10 shadow-[4px_0_10px_rgba(0,0,0,0.5)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--alert-red)] animate-pulse" />
          <span className="pythia-display text-[10px] font-bold tracking-[0.25em] text-[var(--gold-primary)]">WORLD</span>
        </div>
        <div className="flex-1 overflow-hidden relative" style={{ maskImage: 'linear-gradient(to right, transparent, black 2%, black 98%, transparent)' }}>
          <div className="flex items-center whitespace-nowrap animate-ticker" style={{ animationDuration: '140s' }}>
            {content}{content}
          </div>
        </div>
      </div>
    </div>
  );
}
