import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Global forced displacement — UNHCR Refugee Data Finder (free, NO API key).
 * Per country of origin: refugees, asylum-seekers, IDPs. Plotted at country
 * centroids (embedded table — no geocoding key needed) and summarized for the oracle.
 */

// ISO3 -> [lng, lat] centroid, covering the countries that actually carry displacement.
const C: Record<string, [number, number]> = {
  AFG: [66, 33], SYR: [38, 35], UKR: [31, 49], SSD: [31, 7], SDN: [30, 15], MMR: [96, 21],
  COD: [23, -2], SOM: [46, 5], CAF: [21, 7], ERI: [39, 15], NGA: [8, 9], IRQ: [44, 33],
  MLI: [-4, 17], BDI: [30, -3], ETH: [40, 9], VEN: [-66, 7], COL: [-74, 4], HND: [-86, 15],
  GTM: [-90, 15], SLV: [-89, 13], MEX: [-102, 23], CMR: [12, 6], TCD: [19, 15], NER: [8, 17],
  BFA: [-2, 12], YEM: [48, 15], PSE: [35, 32], LBY: [17, 27], PAK: [70, 30], IRN: [53, 32],
  TUR: [35, 39], BGD: [90, 24], IND: [79, 22], LKA: [81, 7], CHN: [104, 35], PRK: [127, 40],
  RWA: [30, -2], UGA: [32, 1], KEN: [38, 0], TZA: [35, -6], EGY: [30, 27], JOR: [36, 31],
  LBN: [36, 34], DEU: [10, 51], FRA: [2, 46], POL: [19, 52], GRC: [22, 39], ITA: [12, 42],
  ESP: [-4, 40], GBR: [-2, 54], USA: [-98, 39], CAN: [-106, 56], BRA: [-53, -10], PER: [-75, -10],
  ECU: [-78, -1], CHL: [-71, -30], ZAF: [25, -29], AGO: [18, -12], MOZ: [35, -18], ZWE: [29, -19],
  NPL: [84, 28], THA: [101, 15], MYS: [102, 4], IDN: [113, -2], PHL: [122, 12], HTI: [-72, 19],
  NIC: [-85, 13], CUB: [-79, 22], RUS: [100, 60], BLR: [28, 53], MDA: [29, 47], GEO: [43, 42],
  ARM: [45, 40], AZE: [48, 40], GIN: [-10, 11], CIV: [-5, 8], LBR: [-9, 6], SLE: [-12, 9],
  TGO: [1, 8], GHA: [-1, 8], SEN: [-14, 14], MRT: [-10, 20], DZA: [3, 28], TUN: [9, 34],
};

async function unhcr(year: number): Promise<any[]> {
  const url = `https://api.unhcr.org/population/v1/population/?yearFrom=${year}&yearTo=${year}&coo_all=true&limit=1000`;
  const r = await fetch(url, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!r.ok) return [];
  const j = await r.json();
  return j?.items || [];
}

export async function GET() {
  try {
    const thisYear = new Date().getFullYear();
    let items: any[] = [];
    for (const y of [thisYear - 1, thisYear - 2, thisYear - 3]) {   // newest available wins
      items = await unhcr(y);
      if (items.length) break;
    }
    const num = (v: any) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
    const rows = items
      .map((it) => ({
        iso: it.coo_iso, name: it.coo_name,
        refugees: num(it.refugees), asylum: num(it.asylum_seekers), idps: num(it.idps),
      }))
      .map((r) => ({ ...r, total: r.refugees + r.asylum + r.idps }))
      .filter((r) => r.total > 0 && C[r.iso])
      .sort((a, b) => b.total - a.total)
      .slice(0, 60);

    const features = rows.map((r) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: C[r.iso] },
      properties: {
        country: r.name, total: r.total, refugees: r.refugees, asylum: r.asylum, idps: r.idps,
        label: `${r.name}: ${(r.total / 1e6).toFixed(r.total >= 1e6 ? 1 : 2)}M displaced`,
      },
    }));
    const summary = rows.slice(0, 10).map((r) => `${r.name} ${(r.total / 1e6).toFixed(1)}M`).join(', ');

    return NextResponse.json(
      { type: 'FeatureCollection', features, summary, count: features.length },
      { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=43200' } },
    );
  } catch {
    return NextResponse.json({ type: 'FeatureCollection', features: [], error: 'UNHCR unavailable' });
  }
}
