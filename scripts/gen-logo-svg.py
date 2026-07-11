"""PYTHIA logo — halftone dot-grid eye with a globe iris, as scalable SVG. v2"""
import math

S = 1024
N = 48
sp = S / N
maxr = sp * 0.48

LAND = [
    (62,-95,18),(50,-100,22),(38,-102,13),(15,-90,7),(72,-40,8),
    (5,-65,12),(-10,-58,15),(-25,-63,10),(-40,-68,6),
    (8,15,16),(22,8,14),(-8,22,14),(-24,25,9),(50,15,10),(58,38,9),
    (55,75,20),(35,95,15),(62,105,17),(22,78,9),(12,103,7),(-25,134,11),
]
SPIN = math.radians(78)
TILT = -0.35

cx = cy = N / 2
W  = N * 0.40            # almond half-width — breathing room in the tile
H  = W * 0.55
IR = H * 0.80            # globe a touch smaller so sclera frames it
PUP = 0.30               # pupil fraction of IR

def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

def lum_at(gx, gy):
    dx, dy = gx - cx, gy - cy
    t = (dx + W) / (2 * W)
    if not (0 <= t <= 1):
        return 0.07
    lid_h = 4 * H * t * (1 - t)
    if abs(dy) > lid_h:
        return 0.07                          # outside the eye: faint field
    r = math.hypot(dx, dy)
    # ── the globe iris ──
    if r <= IR:
        # glint first — it must never be swallowed by a continent
        if math.hypot(dx + IR * 0.40, dy + IR * 0.44) <= 0.14 * IR:
            return 1.0
        if r <= PUP * IR:
            return 0.03                      # pupil void
        hx, hy = dx + IR * 0.35, dy + IR * 0.35
        lum = 0.40 - 0.22 * smooth(0.1 * IR, IR, math.hypot(hx, hy))   # ocean — dark so land pops
        cosT, sinT = math.cos(TILT), math.sin(TILT)
        for lat, lon, rad in LAND:
            la, lo = math.radians(lat), math.radians(lon) + SPIN
            x3 = math.cos(la) * math.sin(lo); y3 = -math.sin(la); z3 = math.cos(la) * math.cos(lo)
            y2, z2 = y3 * cosT - z3 * sinT, y3 * sinT + z3 * cosT
            if z2 <= 0.05: continue
            px, py = x3 * IR, y2 * IR
            pr = max(0.5, (rad / 90) * IR * 1.1) * (0.5 + z2 * 0.5)
            if math.hypot(dx - px, dy - py) <= pr:
                lum = max(lum, 0.95 * (0.5 + 0.5 * z2))
        lum *= 1 - 0.62 * smooth(0.80 * IR, IR, r)   # limb darkening — ring seats the globe
        return lum
    # ── sclera: bright, with a crisp fade only at the very lid edge ──
    lum = 0.88 - 0.18 * smooth(IR, W, r)             # stays bright across the white
    edge = abs(dy) / max(lid_h, 1e-6)                # 0 center → 1 at lid
    lum *= 1 - 0.75 * smooth(0.78, 1.0, edge)        # crisp lid cutoff
    lum *= 1 - 0.25 * smooth(0.80, 1.0, t)           # soften outer corners
    lum *= 1 - 0.25 * smooth(0.20, 0.0, t)
    return max(lum, 0.07)

dots = []
for row in range(N):
    for col in range(N):
        lum = lum_at(col + 0.5, row + 0.5)
        rad = maxr * min(1.0, max(0.10, lum ** 0.65))
        x, y = (col + 0.5) * sp, (row + 0.5) * sp
        dots.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rad:.2f}"/>')

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {S} {S}">
  <defs><clipPath id="tile"><rect width="{S}" height="{S}" rx="{S*0.18:.0f}"/></clipPath></defs>
  <rect width="{S}" height="{S}" rx="{S*0.18:.0f}" fill="#08060F"/>
  <g fill="#D9D2F2" clip-path="url(#tile)">
    {chr(10).join(dots)}
  </g>
</svg>'''
open("logo.svg", "w").write(svg)
print(f"logo.svg v2 · {len(dots)} dots")
