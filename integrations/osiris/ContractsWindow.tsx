'use client';

/** Floating federal-money tape — AWARDED federal contracts (USASpending) and OPEN
 *  funding opportunities (Grants.gov), all keyless. Search + collapsible agency
 *  sections keep the full (uncapped) pool navigable. Placeable anywhere like
 *  chat/ticker/filings; left up 24/7. */
import { useEffect, useMemo, useState, useCallback } from 'react';
import { ExternalLink, Landmark, FileClock, Search, ChevronRight, ChevronDown } from 'lucide-react';

type Award = { recipient: string; amount: number; agency: string; description: string; date: string; url: string };
type Opp = { title: string; agency: string; number: string; posted: string; close: string; url: string };

const money = (v: number): string =>
  v >= 1e9 ? '$' + (v / 1e9).toFixed(2) + 'B'
    : v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M'
    : v >= 1e3 ? '$' + (v / 1e3).toFixed(0) + 'K'
    : '$' + v;

type Section<T> = { agency: string; items: T[]; total: number };
function sections<T>(items: T[], agencyOf: (t: T) => string, weightOf: (t: T) => number): Section<T>[] {
  const m = new Map<string, T[]>();
  for (const it of items) {
    const a = (agencyOf(it) || '—').trim() || '—';
    (m.get(a) ?? m.set(a, []).get(a)!).push(it);
  }
  return [...m.entries()]
    .map(([agency, list]) => ({ agency, items: list, total: list.reduce((s, x) => s + weightOf(x), 0) }))
    .sort((a, b) => b.total - a.total);
}

export default function ContractsWindow() {
  const [tab, setTab] = useState<'awarded' | 'open'>('awarded');
  const [awarded, setAwarded] = useState<Award[]>([]);
  const [open, setOpen] = useState<Opp[]>([]);
  const [loading, setLoading] = useState(true);
  const [ts, setTs] = useState(0);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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

  // reset expansion + search when switching tabs
  useEffect(() => { setExpanded(new Set()); setQuery(''); }, [tab]);

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;

  const awardSecs = useMemo(() => {
    const rows = awarded.filter(x => !q || `${x.recipient} ${x.agency} ${x.description}`.toLowerCase().includes(q));
    return sections(rows, x => x.agency, x => x.amount);
  }, [awarded, q]);

  const oppSecs = useMemo(() => {
    const rows = open.filter(x => !q || `${x.title} ${x.agency} ${x.number}`.toLowerCase().includes(q));
    return sections(rows, x => x.agency, () => 1);
  }, [open, q]);

  const secs = tab === 'awarded' ? awardSecs : oppSecs;
  const shown = secs.reduce((s, g) => s + g.items.length, 0);
  const total = tab === 'awarded' ? awarded.length : open.length;
  const isOpen = (agency: string) => searching || expanded.has(agency);
  const toggle = (agency: string) => setExpanded(prev => {
    const n = new Set(prev); n.has(agency) ? n.delete(agency) : n.add(agency); return n;
  });
  const allExpanded = secs.length > 0 && secs.every(g => expanded.has(g.agency));
  const setAll = () => setExpanded(allExpanded ? new Set() : new Set(secs.map(g => g.agency)));

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

      {/* search + section controls */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[var(--border-subtle)]">
        <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
        <input
          value={query} onChange={e => setQuery(e.target.value)}
          placeholder={tab === 'awarded' ? 'Search recipient / agency…' : 'Search opportunity / agency…'}
          className="flex-1 min-w-0 bg-transparent outline-none text-[11px] font-mono placeholder:text-[var(--text-muted)]"
        />
        {query && <button onClick={() => setQuery('')} className="text-[9px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)]">clear</button>}
        {!searching && secs.length > 1 &&
          <button onClick={setAll} className="text-[9px] font-mono text-[var(--text-muted)] hover:text-[var(--gold-primary)] shrink-0">
            {allExpanded ? 'collapse all' : 'expand all'}
          </button>}
      </div>

      <div className="px-2.5 py-1 text-[9px] font-mono text-[var(--text-muted)] border-b border-[var(--border-subtle)]/40">
        {searching ? `${shown.toLocaleString()} of ${total.toLocaleString()} match` : `${total.toLocaleString()} across ${secs.length} agencies`}
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading && <div className="p-4 text-center text-[10px] font-mono text-[var(--text-muted)]">pulling the federal tape…</div>}
        {!loading && secs.length === 0 &&
          <div className="p-4 text-center text-[10px] font-mono text-[var(--text-muted)]">no matches</div>}

        {secs.map(g => (
          <div key={g.agency}>
            {/* agency section header */}
            <button onClick={() => toggle(g.agency)}
              className="w-full flex items-center gap-1.5 px-2 py-1.5 bg-[var(--hover-accent)]/40 hover:bg-[var(--hover-accent)] border-b border-[var(--border-subtle)]/60 sticky top-0 z-[1]">
              {isOpen(g.agency) ? <ChevronDown className="w-3 h-3 shrink-0 text-[var(--text-muted)]" /> : <ChevronRight className="w-3 h-3 shrink-0 text-[var(--text-muted)]" />}
              <span className="flex-1 min-w-0 truncate text-left text-[10px] font-mono font-semibold">{g.agency}</span>
              <span className="shrink-0 text-[9px] font-mono text-[var(--text-muted)]">
                {tab === 'awarded' ? money(g.total) : `${g.items.length}`}
              </span>
            </button>

            {isOpen(g.agency) && g.items.map((x, i) => tab === 'awarded' ? (
              <a key={i} href={(x as Award).url} target="_blank" rel="noopener noreferrer" title={(x as Award).url}
                onMouseDown={e => e.stopPropagation()}
                className="group flex items-center gap-2 pl-6 pr-2.5 py-1.5 border-b border-[var(--border-subtle)]/50 hover:bg-[var(--hover-accent)] cursor-pointer">
                <span className="w-16 text-[11px] font-mono font-bold shrink-0 text-[var(--alert-green)]">{money((x as Award).amount)}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] truncate leading-tight">{(x as Award).recipient}</div>
                  <div className="text-[9px] text-[var(--text-muted)] truncate leading-tight">{(x as Award).date}</div>
                </div>
                <ExternalLink className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 shrink-0" />
              </a>
            ) : (
              <a key={i} href={(x as Opp).url} target="_blank" rel="noopener noreferrer" title={(x as Opp).url}
                onMouseDown={e => e.stopPropagation()}
                className="group flex items-center gap-2 pl-6 pr-2.5 py-1.5 border-b border-[var(--border-subtle)]/50 hover:bg-[var(--hover-accent)] cursor-pointer">
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] truncate leading-tight">{(x as Opp).title}</div>
                  <div className="text-[9px] text-[var(--text-muted)] truncate leading-tight">{(x as Opp).number}</div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[9px] font-mono text-[var(--text-muted)]">closes</div>
                  <div className="text-[10px] font-mono text-[var(--gold-primary)]">{(x as Opp).close || 'rolling'}</div>
                </div>
                <ExternalLink className="w-3 h-3 text-[var(--text-muted)] opacity-0 group-hover:opacity-100 shrink-0" />
              </a>
            ))}
          </div>
        ))}
      </div>

      <div className="px-2.5 py-1 border-t border-[var(--border-subtle)] text-[8px] font-mono text-[var(--text-muted)] leading-tight">
        Awarded: USASpending.gov · Open: Grants.gov · keyless · not investment advice
      </div>
    </div>
  );
}
