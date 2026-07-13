import { NextResponse } from 'next/server';

/**
 * OSIRIS — Federal money tape (free, no key):
 *   • AWARDED — recent federal contract awards (USASpending.gov) with recipient,
 *     amount, agency, and a link to the award page.
 *   • OPEN — current open funding opportunities you can still go after
 *     (Grants.gov), with agency, close date, and a link to apply.
 * A defense/infra/pharma contract award is a hard, dated signal about a company
 * and a sector. GET /api/usaspending
 */
export const dynamic = 'force-dynamic';

type Award = { recipient: string; amount: number; agency: string; description: string; date: string; url: string };
type Opp = { title: string; agency: string; number: string; posted: string; close: string; url: string };

// No artificial caps — pull the full award page and every posted opportunity.
const AWARD_LIMIT = 100;   // USASpending's max page size (top-by-$ covers all the big ones)
const OPP_ROWS = 3000;     // grants.gov: request more than the ~1.3k typically posted

let cache: { ts: number; body: any } | null = null;
const TTL = 30 * 60_000; // 30 min — federal filings move slowly

const iso = (d: Date) => d.toISOString().slice(0, 10);

async function awarded(): Promise<Award[]> {
  const end = new Date();
  const start = new Date(Date.now() - 45 * 86_400_000);
  const r = await fetch('https://api.usaspending.gov/api/v2/search/spending_by_award/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      filters: {
        award_type_codes: ['A', 'B', 'C', 'D'],   // definitive contracts + IDVs
        time_period: [{ start_date: iso(start), end_date: iso(end) }],
      },
      fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Awarding Agency', 'Description',
               'Start Date', 'generated_internal_id'],
      sort: 'Award Amount', order: 'desc', limit: AWARD_LIMIT,
    }),
    signal: AbortSignal.timeout(15000), cache: 'no-store',
  });
  if (!r.ok) return [];
  const d = await r.json();
  return (d.results || []).map((x: any): Award => ({
    recipient: x['Recipient Name'] || '—',
    amount: Number(x['Award Amount'] || 0),
    agency: x['Awarding Agency'] || '',
    description: (x['Description'] || '').slice(0, 240),
    date: x['Start Date'] || '',
    url: x['generated_internal_id'] ? `https://www.usaspending.gov/award/${x['generated_internal_id']}` : 'https://www.usaspending.gov',
  }));
}

async function open(): Promise<Opp[]> {
  // Grants.gov public search — keyless. Open = currently "posted" (accepting applications).
  const r = await fetch('https://api.grants.gov/v1/api/search2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rows: OPP_ROWS, keyword: '', oppStatuses: 'posted' }),
    signal: AbortSignal.timeout(20000), cache: 'no-store',
  });
  if (!r.ok) return [];
  const d = await r.json();
  const hits = d?.data?.oppHits || [];
  const fmt = (s: string) => (s && s.length === 8 ? `${s.slice(4)}-${s.slice(0, 2)}-${s.slice(2, 4)}` : s || ''); // MMDDYYYY→ISO-ish
  return hits.map((o: any): Opp => ({
    title: (o.title || '').slice(0, 240),
    agency: o.agencyName || o.agencyCode || '',
    number: o.number || '',
    posted: fmt(o.openDate),
    close: fmt(o.closeDate),
    url: o.id ? `https://www.grants.gov/search-results-detail/${o.id}` : 'https://www.grants.gov',
  }));
}

async function build() {
  const [a, o] = await Promise.allSettled([awarded(), open()]);
  return {
    awarded: a.status === 'fulfilled' ? a.value : [],
    open: o.status === 'fulfilled' ? o.value : [],
    ts: Date.now(),
  };
}

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) return NextResponse.json(cache.body);
  try {
    const body = await build();
    cache = { ts: Date.now(), body };
    return NextResponse.json(body);
  } catch (e) {
    if (cache) return NextResponse.json(cache.body);
    return NextResponse.json({ error: String(e), awarded: [], open: [] }, { status: 502 });
  }
}
