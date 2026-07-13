import { NextResponse } from 'next/server';

/**
 * OSIRIS — OFAC sanctions actions (US Treasury, free, no key).
 * New designations, de-listings, and general licenses from OFAC's Recent Actions —
 * a fresh designation is a hard, dated geopolitical/markets signal (it names the
 * countries, entities, and sectors the US just moved against). GET /api/ofac
 */
export const dynamic = 'force-dynamic';

const UA = 'Mozilla/5.0 (PYTHIA-oracle research; pythia@localhost)';

type Action = { title: string; date: string; kind: string; url: string };

let cache: { ts: number; body: any } | null = null;
const TTL = 60 * 60_000; // hourly — OFAC posts a few times a week

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&#039;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/&[a-z]+;/g, ' ').trim();

function classify(t: string): string {
  const l = t.toLowerCase();
  if (l.includes('removal') || l.includes('delisting')) return 'REMOVAL';
  if (l.includes('designation')) return 'DESIGNATION';
  if (l.includes('general license')) return 'LICENSE';
  if (l.includes('faq') || l.includes('frequently asked')) return 'GUIDANCE';
  return 'ACTION';
}

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) return NextResponse.json(cache.body);
  try {
    const html = await fetch('https://ofac.treasury.gov/recent-actions',
      { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(14000), cache: 'no-store' }).then(r => r.text());
    const actions: Action[] = [];
    const seen = new Set<string>();
    for (const m of html.matchAll(/href="(\/recent-actions\/(\d{8}))"[^>]*>\s*([^<]{6,200})/g)) {
      const [, path, ymd, raw] = m;
      const title = decode(raw);
      if (!title || seen.has(path)) continue;
      seen.add(path);
      actions.push({
        title,
        date: `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`,
        kind: classify(title),
        url: `https://ofac.treasury.gov${path}`,
      });
      if (actions.length >= 25) break;
    }
    const body = { actions, ts: Date.now() };
    if (actions.length) cache = { ts: Date.now(), body };
    return NextResponse.json(body);
  } catch (e) {
    if (cache) return NextResponse.json(cache.body);
    return NextResponse.json({ error: String(e), actions: [] }, { status: 502 });
  }
}
