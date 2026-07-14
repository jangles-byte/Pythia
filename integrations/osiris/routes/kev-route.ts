import { NextResponse } from 'next/server';

/**
 * OSIRIS — CISA Known Exploited Vulnerabilities (free, no key).
 * The KEV catalog is the "actively being exploited in the wild RIGHT NOW" list —
 * the highest-signal cyber feed there is. We surface the most recent additions.
 */
export const dynamic = 'force-dynamic';

const URL = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';

let cache: { ts: number; body: Record<string, unknown> } | null = null;
const TTL = 30 * 60_000;   // the catalog updates a few times a week

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) return NextResponse.json(cache.body);
  try {
    const res = await fetch(URL, { signal: AbortSignal.timeout(15000), cache: 'no-store' });
    if (!res.ok) throw new Error(`KEV ${res.status}`);
    const j = await res.json();
    const vulns = (j.vulnerabilities || [])
      .sort((a: any, b: any) => String(b.dateAdded).localeCompare(String(a.dateAdded)))
      .slice(0, 25)
      .map((v: any) => ({
        cve: v.cveID,
        vendor: v.vendorProject,
        product: v.product,
        name: v.vulnerabilityName,
        date_added: v.dateAdded,
        ransomware: v.knownRansomwareCampaignUse === 'Known',
        description: v.shortDescription,
        url: `https://nvd.nist.gov/vuln/detail/${v.cveID}`,
      }));
    const body = { count: j.count, vulns, updated: j.dateReleased };
    cache = { ts: Date.now(), body };
    return NextResponse.json(body);
  } catch (e) {
    if (cache) return NextResponse.json(cache.body);
    return NextResponse.json({ error: String(e), vulns: [] }, { status: 200 });
  }
}
