import { NextResponse } from 'next/server';

/**
 * OSIRIS — Hacker News tech pulse (free, no key; Algolia HN Search API).
 * What the tech/builder world is fixated on right now — an early signal for
 * AI/chip/startup/crypto narratives, complementing the Wikipedia attention feed.
 * GET /api/hackernews
 */
export const dynamic = 'force-dynamic';

type Story = { title: string; url: string; points: number; comments: number; author: string; ts: number };

let cache: { ts: number; body: any } | null = null;
const TTL = 5 * 60_000;

export async function GET() {
  if (cache && Date.now() - cache.ts < TTL) return NextResponse.json(cache.body);
  try {
    const d = await fetch('https://hn.algolia.com/api/v1/search?tags=front_page&hitsPerPage=30',
      { signal: AbortSignal.timeout(12000), cache: 'no-store' }).then(r => r.json());
    const stories: Story[] = (d.hits || [])
      .filter((h: any) => h.title)
      .map((h: any) => ({
        title: h.title,
        url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
        points: h.points || 0,
        comments: h.num_comments || 0,
        author: h.author || '',
        ts: (h.created_at_i || 0) * 1000,
      }))
      .sort((a: Story, b: Story) => b.points - a.points);
    const body = { stories, ts: Date.now() };
    cache = { ts: Date.now(), body };
    return NextResponse.json(body);
  } catch (e) {
    if (cache) return NextResponse.json(cache.body);
    return NextResponse.json({ error: String(e), stories: [] }, { status: 502 });
  }
}
