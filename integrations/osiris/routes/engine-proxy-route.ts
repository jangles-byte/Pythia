import { NextRequest } from 'next/server';

/**
 * OSIRIS → PYTHIA engine proxy.
 * Same-origin passthrough so the browser avoids CORS and SSE works cleanly.
 * /api/engine/<path>  ->  ${PYTHIA_ENGINE_URL}/<path>
 */
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ENGINE = (process.env.PYTHIA_ENGINE_URL || 'http://localhost:8088').replace(/\/$/, '');

// The engine has no auth and trusts this proxy (server-side requests carry no Origin), so
// the proxy must refuse what a hostile web page could send. Hosts it answers to: localhost
// names, plus any in PYTHIA_DEV_ORIGINS (comma-separated; run-all.sh puts the Tailscale IP there).
const ALLOWED_HOSTS = new Set([
  'localhost', '127.0.0.1', '[::1]',
  ...(process.env.PYTHIA_DEV_ORIGINS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
]);

function hostnameOf(hostport: string): string {
  try { return new URL('http://' + hostport).hostname.toLowerCase(); } catch { return ''; }
}

function refuse(req: NextRequest): Response | null {
  const host = (req.headers.get('host') || '').toLowerCase();
  const deny = (why: string) => new Response(JSON.stringify({ error: why }), {
    status: 403, headers: { 'Content-Type': 'application/json' },
  });
  // DNS rebinding: a page on evil.example resolving to 127.0.0.1 arrives with that Host.
  if (!ALLOWED_HOSTS.has(hostnameOf(host))) return deny('host not allowed');
  // Cross-origin requests from other pages (including other localhost ports).
  const origin = req.headers.get('origin');
  if (origin) {
    let originHost = '';
    try { originHost = new URL(origin).host.toLowerCase(); } catch { /* "null" etc. */ }
    if (originHost !== host) return deny('origin not allowed');
  }
  const site = req.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return deny('cross-site request');
  return null;
}

async function proxy(req: NextRequest, path: string[]): Promise<Response> {
  const sub = '/' + (path || []).join('/');
  const url = ENGINE + sub + (req.nextUrl.search || '');
  const isSSE = sub.endsWith('/stream');

  const init: RequestInit = {
    method: req.method,
    headers: { 'Content-Type': req.headers.get('content-type') || 'application/json' },
    // @ts-expect-error - duplex required by undici for streaming request bodies
    duplex: 'half',
  };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = await req.text();
  }

  try {
    const upstream = await fetch(url, init);
    if (isSSE) {
      // Explicitly pump chunks so the dev server doesn't buffer the stream.
      const stream = new ReadableStream({
        async start(controller) {
          const reader = upstream.body!.getReader();
          try {
            for (;;) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } catch { /* upstream closed */ } finally {
            try { controller.close(); } catch { /* already closed */ }
          }
        },
        cancel() { try { upstream.body?.cancel(); } catch { /* noop */ } },
      });
      return new Response(stream, {
        status: upstream.status,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }
    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'PYTHIA engine unreachable', detail: String(e), engine: ENGINE }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return refuse(req) ?? proxy(req, (await ctx.params).path);
}
export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return refuse(req) ?? proxy(req, (await ctx.params).path);
}
