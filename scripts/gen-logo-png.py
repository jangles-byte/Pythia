"""Rasterize the PYTHIA halftone-eye logo to PNG — pure Python, no deps.
2x supersampled then box-downsampled for clean dot edges."""
import math, struct, zlib

OUT = 1024
SS = 2                    # supersample factor
S = OUT * SS
N = 48
sp = S / N
maxr = sp * 0.48

LAND = [
    (62,-95,18),(50,-100,22),(38,-102,13),(15,-90,7),(72,-40,8),
    (5,-65,12),(-10,-58,15),(-25,-63,10),(-40,-68,6),
    (8,15,16),(22,8,14),(-8,22,14),(-24,25,9),(50,15,10),(58,38,9),
    (55,75,20),(35,95,15),(62,105,17),(22,78,9),(12,103,7),(-25,134,11),
]
SPIN = math.radians(78); TILT = -0.35
cx = cy = N / 2
W = N * 0.40; H = W * 0.55; IR = H * 0.80; PUP = 0.30

def smooth(a, b, x):
    t = max(0.0, min(1.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)

def lum_at(gx, gy):
    dx, dy = gx - cx, gy - cy
    t = (dx + W) / (2 * W)
    if not (0 <= t <= 1): return 0.07
    lid_h = 4 * H * t * (1 - t)
    if abs(dy) > lid_h: return 0.07
    r = math.hypot(dx, dy)
    if r <= IR:
        if math.hypot(dx + IR*0.40, dy + IR*0.44) <= 0.14*IR: return 1.0
        if r <= PUP*IR: return 0.03
        hx, hy = dx + IR*0.35, dy + IR*0.35
        lum = 0.40 - 0.22 * smooth(0.1*IR, IR, math.hypot(hx, hy))
        cosT, sinT = math.cos(TILT), math.sin(TILT)
        for lat, lon, rad in LAND:
            la, lo = math.radians(lat), math.radians(lon) + SPIN
            x3 = math.cos(la)*math.sin(lo); y3 = -math.sin(la); z3 = math.cos(la)*math.cos(lo)
            y2, z2 = y3*cosT - z3*sinT, y3*sinT + z3*cosT
            if z2 <= 0.05: continue
            px, py = x3*IR, y2*IR
            pr = max(0.5, (rad/90)*IR*1.1) * (0.5 + z2*0.5)
            if math.hypot(dx-px, dy-py) <= pr:
                lum = max(lum, 0.95*(0.5 + 0.5*z2))
        lum *= 1 - 0.62 * smooth(0.80*IR, IR, r)
        return lum
    lum = 0.88 - 0.18 * smooth(IR, W, r)
    edge = abs(dy) / max(lid_h, 1e-6)
    lum *= 1 - 0.75 * smooth(0.78, 1.0, edge)
    lum *= 1 - 0.25 * smooth(0.80, 1.0, t)
    lum *= 1 - 0.25 * smooth(0.20, 0.0, t)
    return max(lum, 0.07)

BG = (8, 6, 15); DOT = (217, 210, 242)
buf = bytearray(S * S * 3)
for i in range(0, len(buf), 3):
    buf[i], buf[i+1], buf[i+2] = BG

# rounded-rect mask params
RX = S * 0.18

def in_tile(x, y):
    if RX <= x <= S-RX or RX <= y <= S-RX: return True
    ccx = RX if x < RX else S-RX
    ccy = RX if y < RX else S-RX
    return (x-ccx)**2 + (y-ccy)**2 <= RX*RX

for row in range(N):
    for col in range(N):
        lum = lum_at(col + 0.5, row + 0.5)
        rad = maxr * min(1.0, max(0.10, lum ** 0.65))
        if rad < 1: continue
        x0, y0 = (col + 0.5) * sp, (row + 0.5) * sp
        r2 = rad * rad
        for py in range(max(0, int(y0-rad)), min(S, int(y0+rad)+2)):
            dy2 = (py + 0.5 - y0) ** 2
            for px in range(max(0, int(x0-rad)), min(S, int(x0+rad)+2)):
                if (px + 0.5 - x0)**2 + dy2 <= r2 and in_tile(px, py):
                    j = (py * S + px) * 3
                    buf[j], buf[j+1], buf[j+2] = DOT

# transparent outside the tile? keep opaque tile w/ alpha outside → RGBA
# downsample SS x SS box → OUT
out = bytearray(OUT * OUT * 4)
for oy in range(OUT):
    for ox in range(OUT):
        rs = gs = bs = a = 0
        for sy in range(SS):
            for sx in range(SS):
                x, y = ox*SS+sx, oy*SS+sy
                j = (y * S + x) * 3
                if in_tile(x, y):
                    rs += buf[j]; gs += buf[j+1]; bs += buf[j+2]; a += 255
                else:
                    rs += 0; gs += 0; bs += 0
        k = (oy * OUT + ox) * 4
        n = SS*SS
        out[k], out[k+1], out[k+2], out[k+3] = rs//n, gs//n, bs//n, a//n

# minimal PNG encoder (RGBA8)
def chunk(tag, data):
    c = struct.pack(">I", len(data)) + tag + data
    return c + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)
raw = b"".join(b"\x00" + bytes(out[y*OUT*4:(y+1)*OUT*4]) for y in range(OUT))
png = (b"\x89PNG\r\n\x1a\n"
       + chunk(b"IHDR", struct.pack(">IIBBBBB", OUT, OUT, 8, 6, 0, 0, 0))
       + chunk(b"IDAT", zlib.compress(raw, 9))
       + chunk(b"IEND", b""))
open("logo.png", "wb").write(png)
print(f"logo.png written · {len(png)//1024} KB · {OUT}x{OUT} RGBA")
