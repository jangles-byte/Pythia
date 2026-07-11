/** Share cards — render a forecast or the Morning Brief as a branded 1200×630 PNG
 *  and download it. Pure canvas, dark halftone brand, no dependencies. */

type CardOpts = {
  kicker: string;          // e.g. "PYTHIA FORECAST · NEXT 24 HOURS"
  headline: string;        // the statement / brief first line
  big?: string;            // e.g. "83%" — rendered huge on the right
  sub?: string;            // e.g. "council consensus · 4 voices · split"
  footer?: string;         // e.g. date / location
};

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = w; }
    else line = test;
  }
  if (line) lines.push(line);
  return lines.slice(0, 5);
}

export async function downloadShareCard(opts: CardOpts, filename = 'pythia-card.png'): Promise<void> {
  const W = 1200, H = 630;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d')!;
  try { await (document as any).fonts?.ready; } catch { /* best effort */ }

  // background + ambient halftone field (the brand)
  ctx.fillStyle = '#08060F';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(217,210,242,0.16)';
  const sp = 26;
  for (let y = sp / 2; y < H; y += sp) {
    for (let x = sp / 2; x < W; x += sp) {
      const r = 1.1 + 1.3 * Math.abs(Math.sin(x * 0.37 + y * 0.61));
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
  }
  // soft vignette so text pops
  const vg = ctx.createRadialGradient(W * 0.38, H * 0.42, 120, W * 0.38, H * 0.42, 720);
  vg.addColorStop(0, 'rgba(8,6,15,0.88)');
  vg.addColorStop(1, 'rgba(8,6,15,0.35)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);

  // kicker
  ctx.fillStyle = '#9A7BFF';
  ctx.font = '600 22px Inter, sans-serif';
  ctx.fillText(opts.kicker.toUpperCase(), 64, 96);

  // headline (wrapped)
  ctx.fillStyle = '#E7E3F4';
  ctx.font = '600 44px Inter, sans-serif';
  const maxW = opts.big ? 760 : 1060;
  const lines = wrap(ctx, opts.headline, maxW);
  lines.forEach((ln, i) => ctx.fillText(ln, 64, 172 + i * 58));

  // the big number
  if (opts.big) {
    ctx.fillStyle = '#9A7BFF';
    ctx.font = '700 150px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textAlign = 'right';
    ctx.fillText(opts.big, W - 64, 250);
    ctx.textAlign = 'left';
  }

  // sub + footer
  if (opts.sub) {
    ctx.fillStyle = '#A39BC2';
    ctx.font = '400 26px Inter, sans-serif';
    ctx.fillText(opts.sub, 64, 172 + lines.length * 58 + 26);
  }
  ctx.fillStyle = '#6A6388';
  ctx.font = '400 22px Inter, sans-serif';
  if (opts.footer) ctx.fillText(opts.footer, 64, H - 64);

  // brand
  ctx.fillStyle = '#9A7BFF';
  ctx.font = '700 28px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('◉ PYTHIA', W - 64, H - 64);
  ctx.textAlign = 'left';

  await new Promise<void>((resolve) => {
    c.toBlob((blob) => {
      if (!blob) return resolve();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      resolve();
    }, 'image/png');
  });
}
