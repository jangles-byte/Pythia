import { NextResponse } from 'next/server';

/**
 * OSIRIS — SEC EDGAR live filings firehose (free, no key; UA required).
 * The regulatory tape nobody fuses into a world oracle:
 *   • Insider transactions (Form 4) — enriched with issuer, ticker, buy/sell/grant, $ value
 *   • Material events (8-K) — company + link
 * Across ALL public companies, not a watchlist. GET /api/edgar
 */
export const dynamic = 'force-dynamic';

// SEC fair-access policy REQUIRES a contact email in the User-Agent or it 403s.
// Do NOT set Accept-Encoding manually — that disables undici's auto-decompress
// and r.text() would return gzipped bytes that every regex misses.
const UA = 'PYTHIA-oracle research pythia-oracle@localhost';
const H = { 'User-Agent': UA, 'Accept': 'application/atom+xml,application/json,text/html' };

type Insider = { owner: string; company: string; ticker: string; action: 'BUY' | 'SELL' | 'GRANT' | 'EXERCISE' | 'OTHER'; shares: number; value: number; filed: string; url: string };
type Event = { company: string; cik: string; filed: string; url: string };

let cache: { ts: number; body: any } | null = null;
const TTL = 150_000;

async function atom(type: string, count: number): Promise<{ title: string; href: string; updated: string }[]> {
  const url = `https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type=${type}&company=&dateb=&owner=include&count=${count}&output=atom`;
  const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(12000), cache: 'no-store' });
  if (!r.ok) return [];
  const xml = await r.text();
  const out: { title: string; href: string; updated: string }[] = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const e = m[1];
    const title = (e.match(/<title>([\s\S]*?)<\/title>/)?.[1] || '').trim();
    const href = e.match(/<link[^>]*href="([^"]+)"/)?.[1] || '';
    const updated = e.match(/<updated>([^<]+)<\/updated>/)?.[1] || '';
    if (title && href) out.push({ title, href, updated });
  }
  return out;
}

const val1 = (block: string, tag: string): number =>
  parseFloat(block.match(new RegExp(`<${tag}>\\s*<value>([\\d.]+)`))?.[1] || '0') || 0;

const CODE_ACTION: Record<string, Insider['action']> = { P: 'BUY', S: 'SELL', A: 'GRANT', M: 'EXERCISE', F: 'OTHER', G: 'OTHER' };

async function enrichForm4(href: string, updated: string): Promise<Insider | null> {
  try {
    const folder = href.replace(/[^/]+$/, '');            // .../<accn>/  (drop the -index.htm)
    const idx = await fetch(`${folder}index.json`, { headers: H, signal: AbortSignal.timeout(9000), cache: 'no-store' });
    if (!idx.ok) return null;
    const items: any[] = (await idx.json())?.directory?.item || [];
    const xmlName = (items.find(i => i.name === 'form4.xml')
      || items.find(i => i.name === 'primary_doc.xml')
      || items.find(i => /\.xml$/.test(i.name) && /form4|ownership|doc4|wf-form4/i.test(i.name))
      || items.find(i => /\.xml$/.test(i.name)))?.name;
    if (!xmlName) return null;
    const dr = await fetch(`${folder}${xmlName}`, { headers: H, signal: AbortSignal.timeout(9000), cache: 'no-store' });
    if (!dr.ok) return null;
    const xml = await dr.text();
    const company = (xml.match(/<issuerName>([^<]+)/)?.[1] || '').trim();
    const ticker = (xml.match(/<issuerTradingSymbol>([^<]+)/)?.[1] || '').trim();
    const owner = (xml.match(/<rptOwnerName>([^<]+)/)?.[1] || '').trim();
    if (!company) return null;
    // Walk each transaction block: sum shares and value (shares×price) correctly,
    // and collect codes so we can classify by the strongest one present.
    const codes: string[] = [];
    let shares = 0, value = 0;
    for (const b of xml.matchAll(/<(?:nonDerivative|derivative)Transaction>([\s\S]*?)<\/(?:nonDerivative|derivative)Transaction>/g)) {
      const block = b[1];
      const c = block.match(/<transactionCode>([A-Z])<\/transactionCode>/)?.[1];
      if (c) codes.push(c);
      const s = val1(block, 'transactionShares');
      const p = val1(block, 'transactionPricePerShare');
      shares += s;
      value += s * p;
    }
    const code = ['P', 'S', 'A', 'M', 'F', 'G'].find(c => codes.includes(c)) || codes[0] || '';
    return {
      owner: owner.replace(/\s+/g, ' '), company, ticker,
      action: CODE_ACTION[code] || 'OTHER',
      shares: Math.round(shares),
      value: Math.round(value),
      filed: updated.slice(0, 10), url: href,
    };
  } catch { return null; }
}

// getcurrent lists each filing twice — once under the filer CIK, once under the
// subject/issuer CIK — with different hrefs but the SAME 18-digit accession folder.
// Dedupe on that. Prefer the issuer-titled copy for Form 4 so titles read as the company.
const accn = (href: string) => href.match(/\/(\d{18})\//)?.[1] || href;
const dedupe = (a: { title: string; href: string; updated: string }[]) => {
  const seen = new Set<string>();
  return a.filter(x => (seen.has(accn(x.href)) ? false : seen.add(accn(x.href))));
};

async function build() {
  const [form4raw, eightKraw] = await Promise.all([atom('4', 100), atom('8-K', 60)]);
  // getcurrent lists each filing twice — dedupe by accession before doing any work
  const form4 = dedupe(form4raw);
  const eightK = dedupe(eightKraw);

  // enrich the most recent Form 4s (bounded — respects SEC's 10 req/s)
  const toEnrich = form4.slice(0, 22);
  const insider: Insider[] = [];
  for (let i = 0; i < toEnrich.length; i += 5) {
    const batch = await Promise.all(toEnrich.slice(i, i + 5).map(f => enrichForm4(f.href, f.updated)));
    for (const x of batch) if (x) insider.push(x);
  }

  const events: Event[] = eightK.slice(0, 30).map(e => {
    const m = e.title.match(/^8-K\s*-\s*(.+?)\s*\((\d+)\)/);
    return { company: (m?.[1] || e.title).trim(), cik: m?.[2] || '', filed: e.updated.slice(0, 10), url: e.href };
  });

  return { insider, events, ts: Date.now() };
}

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) return NextResponse.json(cache.body);
  try {
    const body = await build();
    cache = { ts: Date.now(), body };
    return NextResponse.json(body);
  } catch (e) {
    if (cache) return NextResponse.json(cache.body);
    return NextResponse.json({ error: String(e), insider: [], events: [] }, { status: 502 });
  }
}
