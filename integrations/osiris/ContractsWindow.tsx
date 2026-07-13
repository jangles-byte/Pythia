'use client';

/** Floating federal-money tape — AWARDED federal contracts (USASpending) and OPEN
 *  funding opportunities (Grants.gov), all keyless, all companies/agencies. Placeable
 *  anywhere like chat/ticker/filings; left up 24/7. */
import { useEffect, useState, useCallback } from 'react';
import { ExternalLink, Landmark, FileClock } from 'lucide-react';

type Award = { recipient: string; amount: number; agency: string; description: string; date: string; url: string };
type Opp = { title: string; agency: string; number: string; posted: string; close: string; url: string };

const money = (v: number): string =>
  v >= 1e9 ? '$' + (v / 1e9).toFixed(2) + 'B'
    : v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M'
    : v >= 1e3 ? '$' + (v / 1e3).toFixed(0) + 'K'
    : '$' + v;

export default function ContractsWindow() {
  const [tab, setTab] = useState<'awarded' | 'open'>('awarded');
  const [awarded, setAwarded] = useState<Award[]>([]);
  const [open, setOpen] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);
  const [ts, setTs] = useState(0);

  const load = useCallback(async () => {
    try {
      const d = await fetch('/api/usaspending').then(r => r.json());
      setAwarded(d.awarded || []);
      setOpen(d.open || []);
      setTs(d.ts || Date.now());
    } catch { /* keep last */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 30 * 60_000); // route caches 30 min
    return () => clearInterval(iv);
  }, [load]);

  const Pill = ({ id, icon: Icon, children }: { id: typeof tab; icon: typeof Landmark; children: React.ReactNode }) => (
    <button onClick={() => setTab(id)}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono tracking-wide transition-colors ${
        tab === id ? 'bg-[var(--gold-primary)]/20 text-[var(--gold-primary)]' : 'text-[var(--text-muted)] hover:bg-[var(--hover-accent)]'}`}>
      <Icon className="w-3 h-3" />{children}
    </button>
  );

  return (
    <div className="flex flex-col h-full text-[var(--text-primary)]">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-[var(--border-subtle)]">
        <Pill id="awarded" icon={Landmark}>AWARDED · {awarded.length}</Pill>
        <Pill id="open" icon={FileClock}>OPEN · {open.length}</Pill>
        <span className="ml-auto text-[9px] font-mono text-[var(--text-muted)] pr-1">
          {ts ? new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <div className="p-4 text-center text-[10px] font-mono text-[var(--text-muted)]">pulling the federal tape…</div>}

        {tab === 'awarded' && awarded.map((x, i) => (
          <a key={i} href={x.url} target="_blank" rel="noreferrer"
            className="group flex items-center gap-2 px-2.5 py-1.5 border-b border-[var(--border-subtle)]/50 hover:bg-[var(--hover-accent)]">
            <span className="w-16 text-[11px] font-mono font-bold shrink-0 text-[var(--alert-green)]">{money(x.amount)}</span>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] truncate leading-tight">{x.recipient}</div>
              <div className="text-[9px] text-[var(--text-muted)] truncate leading-tight">{x.agency}{x.date ? ' · ' + x.date : ''}</div>
            </div>
            <ExternalLink className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 shrink-0" />
          </a>
        ))}

        {tab === 'open' && open.map((x, i) => (
          <a key={i} href={x.url} target="_blank" rel="noreferrer"
            className="group flex items-center gap-2 px-2.5 py-1.5 border-b border-[var(--border-subtle)]/50 hover:bg-[var(--hover-accent)]">
            <div className="flex-1 min-w-0">
              <div className="text-[11px] truncate leading-tight">{x.title}</div>
              <div className="text-[9px] text-[var(--text-muted)] truncate leading-tight">{x.agency}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[9px] font-mono text-[var(--text-muted)]">closes</div>
              <div className="text-[10px] font-mono text-[var(--gold-primary)]">{x.close || 'rolling'}</div>
            </div>
            <ExternalLink className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 shrink-0" />
          </a>
        ))}
      </div>

      <div className="px-2.5 py-1 border-t border-[var(--border-subtle)] text-[8px] font-mono text-[var(--text-muted)] leading-tight">
        Awarded: USASpending.gov · Open: Grants.gov · keyless · not investment advice
      </div>
    </div>
  );
}
