import { NextRequest, NextResponse } from 'next/server';

/**
 * OSIRIS — arbitrary symbol quotes (Yahoo Finance chart API, free, no key).
 * GET /api/quotes?symbols=AAPL,CL=F,BTC-USD
 * Returns price, day change % and an intraday sparkline per symbol — feeds the
 * rolling market ticker and the Watch tab. Anything Yahoo prices works:
 * stocks, futures (CL=F), crypto (BTC-USD), FX (EURUSD=X), indices (^VIX).
 */
export const dynamic = 'force-dynamic';

type Quote = { symbol: string; price: number; change_percent: number; spark: number[]; currency?: string };

// NOTE: no User-Agent header on purpose — Yahoo 429s "browser" UAs that arrive
// without cookies (bot heuristic), while a plain server-side fetch passes.
async function quote(symbol: string): Promise<Quote | null> {
  for (const host of ['query1', 'query2']) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=5m&range=1d`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000), cache: 'no-store' });
      if (!res.ok) continue;
      const r = (await res.json())?.chart?.result?.[0];
      const meta = r?.meta;
      const price = meta?.regularMarketPrice;
      if (!price) continue;
      const prev = meta?.chartPreviousClose || meta?.previousClose;
      const closes: number[] = (r?.indicators?.quote?.[0]?.close || []).filter((v: unknown) => typeof v === 'number');
      // downsample the intraday series to ~30 points for a tiny sparkline
      const step = Math.max(1, Math.floor(closes.length / 30));
      const spark = closes.filter((_, i) => i % step === 0).slice(-30);
      return {
        symbol,
        price: Math.round(price * 10000) / 10000,
        change_percent: prev ? Math.round(((price - prev) / prev) * 10000) / 100 : 0,
        spark,
        currency: meta?.currency,
      };
    } catch { /* try the other host */ }
  }
  return null;
}

// Yahoo throttles bursts — cache each symbol for 60s so the ticker + watch tab
// can poll freely without tripping 429s.
const cache = new Map<string, { ts: number; q: Quote | null }>();
const TTL = 60_000;

export async function GET(req: NextRequest) {
  const raw = (req.nextUrl.searchParams.get('symbols') || '').split(',')
    .map((s) => s.trim().toUpperCase()).filter(Boolean).slice(0, 48);
  if (!raw.length) return NextResponse.json({ error: 'pass ?symbols=AAPL,CL=F,BTC-USD' }, { status: 400 });

  const now = Date.now();
  const out: Record<string, Quote | null> = {};
  const misses = raw.filter((s) => {
    const hit = cache.get(s);
    if (hit && now - hit.ts < TTL) { out[s] = hit.q; return false; }
    return true;
  });
  // fetch misses in small batches to stay under Yahoo's burst radar
  for (let i = 0; i < misses.length; i += 8) {
    const batch = misses.slice(i, i + 8);
    const results = await Promise.all(batch.map(quote));
    batch.forEach((s, j) => { out[s] = results[j]; cache.set(s, { ts: now, q: results[j] }); });
  }
  return NextResponse.json({ quotes: out, ts: now });
}
