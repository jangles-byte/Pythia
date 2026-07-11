"""PYTHIA favicon set — flat simplified halftone-eye (dots can't resolve at 16px,
so small sizes get clean shapes in the same geometry: tile, almond, globe-iris,
glint; larger sizes regain the ambient dot texture). Pure Python, no deps.
Writes every icon the app references into $OSIRIS_DIR/public (default ~/osiris)."""
import math, os, struct, zlib

M = 1024                                    # master render size
TILE = (8, 6, 15); SCLERA = (217, 210, 242); IRIS = (26, 20, 48); GLINT = (255, 255, 255)

cx = cy = M / 2
W = M * 0.44                                # almond half-width
H = W * 0.62
IR = H * 0.80
RX = M * 0.22

def in_tile(x, y):
    if RX <= x <= M - RX or RX <= y <= M - RX: return True
    ccx = RX if x < RX else M - RX
    ccy = RX if y < RX else M - RX
    return (x - ccx) ** 2 + (y - ccy) ** 2 <= RX * RX

def px_color(x, y, with_dots):
    if not in_tile(x, y): return None       # transparent
    dx, dy = x - cx, y - cy
    t = (dx + W) / (2 * W)
    if 0 <= t <= 1 and abs(dy) <= 4 * H * t * (1 - t):
        r = math.hypot(dx, dy)
        if r <= IR:
            if math.hypot(dx + IR * 0.40, dy + IR * 0.44) <= 0.16 * IR: return GLINT
            return IRIS
        return SCLERA
    if with_dots:                            # ambient halftone field in the tile
        sp = M / 24
        gx, gy = (x % sp) - sp / 2, (y % sp) - sp / 2
        if gx * gx + gy * gy <= (sp * 0.10) ** 2: return (90, 82, 128)
    return TILE

def render(size, with_dots):
    ss = 4 if size <= 64 else 2
    S = size * ss
    out = bytearray(size * size * 4)
    scale = M / S
    for oy in range(size):
        for ox in range(size):
            rs = gs = bs = a = 0
            for sy in range(ss):
                for sx in range(ss):
                    c = px_color((ox * ss + sx + 0.5) * scale, (oy * ss + sy + 0.5) * scale, with_dots)
                    if c: rs += c[0]; gs += c[1]; bs += c[2]; a += 255
            k = (oy * size + ox) * 4; n = ss * ss
            out[k], out[k+1], out[k+2], out[k+3] = rs // n, gs // n, bs // n, a // n
    return out

def png(size, rgba):
    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)
    raw = b"".join(b"\x00" + bytes(rgba[y*size*4:(y+1)*size*4]) for y in range(size))
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b""))

pub = os.path.join(os.environ.get("OSIRIS_DIR", os.path.expanduser("~/osiris")), "public")
targets = [("favicon-16x16.png", 16, False), ("favicon-32x32.png", 32, False),
           ("apple-touch-icon.png", 180, True), ("android-chrome-192x192.png", 192, True),
           ("android-chrome-512x512.png", 512, True)]
pngs = {}
for name, size, dots in targets:
    data = png(size, render(size, dots))
    pngs[size] = data
    open(os.path.join(pub, name), "wb").write(data)
    print(f"{name} · {len(data)//1024 or 1} KB")

# favicon.ico with embedded PNGs (16 + 32)
entries, blobs, offset = [], [], 6 + 16 * 2
for size in (16, 32):
    d = pngs[size]
    entries.append(struct.pack("<BBBBHHII", size % 256, size % 256, 0, 0, 1, 32, len(d), offset))
    blobs.append(d); offset += len(d)
ico = struct.pack("<HHH", 0, 1, 2) + b"".join(entries) + b"".join(blobs)
open(os.path.join(pub, "favicon.ico"), "wb").write(ico)
print(f"favicon.ico · {len(ico)//1024 or 1} KB")
