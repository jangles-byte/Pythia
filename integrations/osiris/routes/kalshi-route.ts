import { NextResponse } from 'next/server';

/**
 * OSIRIS — Kalshi regulated event-contract odds (free public read; no key).
 * The third crowd-forecast anchor alongside Polymarket + Manifold, and often the
 * most liquid on US macro/politics/weather because it trades real money under CFTC
 * regulation. We pull OPEN events, keep the signal categories (drop sports/
 * entertainment noise), and return each event's headline market probability.
 * GET /api/kalshi
 */
export const dynamic = 'force-dynamic';

const BASE = 'https://api.elections.kalshi.com/trade-api/v2';
// keep the categories a world oracle cares about; sports/entertainment are noise here
const KEEP = new Set(['Politics', 'Economics', 'Financials', 'World', 'Science and Technology',
                      'Climate and Weather', 'Health', 'Crypto', 'Companies']);

type Mkt = { question: string; prob: number; category: string; volume: number; liquidity: number; close: string; url: string };

let cache: { ts: number; body: any } | null = null;
const TTL = 120_000;

// Kalshi's nested-market schema uses *_dollars (a contract settles at $1, so the yes
// price in dollars already IS the crowd probability) and *_fp fixed-point counts.
const activity = (m: any) => Number(m.volume_24h_fp || m.volume_fp || m.open_interest_fp || 0);
const probOf = (m: any) => {
  const lp = parseFloat(m.last_price_dollars);
  if (lp > 0) return lp;
  const bid = parseFloat(m.yes_bid_dollars || '0'), ask = parseFloat(m.yes_ask_dollars || '0');
  return bid && ask ? (bid + ask) / 2 : (bid || ask || 0);
};

async function build() {
  const r = await fetch(`${BASE}/events?status=open&with_nested_markets=true&limit=200`,
    { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(14000), cache: 'no-store' });
  if (!r.ok) throw new Error('kalshi ' + r.status);
  const d = await r.json();
  const out: Mkt[] = [];
  for (const ev of (d.events || [])) {
    if (ev.category && !KEEP.has(ev.category)) continue;
    const mkts = ev.markets || [];
    if (!mkts.length) continue;
    // headline = the most-traded market in the event; its yes price ≈ crowd probability
    const m = mkts.reduce((a: any, b: any) => activity(b) > activity(a) ? b : a, mkts[0]);
    const label = (mkts.length > 1 && m.yes_sub_title) ? `${ev.title} — ${m.yes_sub_title}` : (ev.title || m.title || '');
    out.push({
      question: String(label).slice(0, 200),
      prob: Math.round(probOf(m) * 100) / 100,
      category: ev.category || '',
      volume: activity(m),
      liquidity: Math.round(parseFloat(m.liquidity_dollars || '0')),
      close: (m.close_time || '').slice(0, 10),
      url: `https://kalshi.com/markets/${(ev.event_ticker || '').toLowerCase()}`,
    });
  }
  // liquid, actually-traded markets first (drops the dead long-shot speculation to the bottom)
  out.sort((a, b) => (b.volume - a.volume) || (b.liquidity - a.liquidity));
  return { markets: out.slice(0, 50), ts: Date.now() };
}

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) return NextResponse.json(cache.body);
  try {
    const body = await build();
    cache = { ts: Date.now(), body };
    return NextResponse.json(body);
  } catch (e) {
    if (cache) return NextResponse.json(cache.body);
    return NextResponse.json({ error: String(e), markets: [] }, { status: 502 });
  }
}
