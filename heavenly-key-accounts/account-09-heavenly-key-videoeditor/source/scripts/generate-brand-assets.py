#!/usr/bin/env python3
"""Generate original-style branded PNG assets for Account 9 without external packages."""
from pathlib import Path
import math
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1]

def chunk(kind, data):
    return struct.pack('>I', len(data)) + kind + data + struct.pack('>I', zlib.crc32(kind + data) & 0xffffffff)

def png(width, height, rgba):
    header = b'\x89PNG\r\n\x1a\n'
    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    rows = bytearray()
    for y in range(height):
        rows.append(0)
        for x in range(width):
            rows.extend(rgba(x, y, width, height))
    return header + chunk(b'IHDR', ihdr) + chunk(b'IDAT', zlib.compress(bytes(rows), 9)) + chunk(b'IEND', b'')

def icon(x, y, w, h):
    nx = (x + .5) / w * 2 - 1
    ny = (y + .5) / h * 2 - 1
    r = math.hypot(nx, ny)
    if r > .93:
        return (0, 0, 0, 0)
    # Royal-blue disk, luminous cyan rim, and a centered white play triangle.
    edge = max(0, min(1, (.93 - r) * 65))
    if r > .78:
        return (51, 188, 241, int(255 * edge))
    if -.23 < nx < .48 and abs(ny) < .54 and nx > -.23 + abs(ny) * 1.15:
        return (255, 255, 255, 255)
    return (25 + int((ny + 1) * 13), 59 + int((nx + 1) * 17), 160 + int((1 - r) * 55), 255)

for name, size in [('favicon.png', 64), ('logo-256.png', 256), ('logo-512.png', 512)]:
    data = png(size, size, icon)
    for folder in ('assets', 'public/assets'):
        path = ROOT / folder / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        print(f'{path.relative_to(ROOT)}: {len(data)} bytes')
