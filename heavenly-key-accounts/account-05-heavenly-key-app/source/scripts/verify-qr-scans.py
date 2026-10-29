#!/usr/bin/env python3
"""Decode every active SVG QR and verify the actual scanner URL, not just the filename.

Requires the external, standard open-source zbarimg utility. This tool reads
the project's existing vector QR pixels and never fetches any user URL.
"""
import json
import re
import subprocess
import tempfile
from pathlib import Path
from xml.etree import ElementTree as ET

PUBLIC = Path(__file__).resolve().parent.parent / "public"
DESTINATIONS = json.loads((PUBLIC / "qr" / "destinations.json").read_text())
CATALOGUE = json.loads((PUBLIC / "app-downloads.json").read_text())
ORIGIN = "https://apps.heavenlykey.org"


def render_svg_to_pgm(svg_file: Path, output_file: Path) -> None:
    root = ET.parse(svg_file).getroot()
    viewbox = root.attrib.get("viewBox", "").split()
    if len(viewbox) != 4 or viewbox[:2] != ["0", "0"]:
        raise ValueError(f"Unsupported QR viewBox: {svg_file}")
    width, height = map(int, viewbox[2:])
    if width != height or not 20 <= width <= 90:
        raise ValueError(f"Unsupported QR grid size: {svg_file}")
    paths = [element.attrib.get("d", "") for element in root.iter()
             if element.tag.endswith("path") and element.attrib.get("fill") == "#111"]
    if not paths:
        raise ValueError(f"QR black modules missing: {svg_file}")
    commands = "".join(paths)
    modules = re.findall(r"M(\d+) (\d+)h1v1h-1z", commands)
    if len(modules) < 100 or len(modules) != commands.count("M"):
        raise ValueError(f"Unexpected vector QR syntax: {svg_file}")
    matrix = [[255] * width for _ in range(height)]
    for xs, ys in modules:
        x, y = int(xs), int(ys)
        if not (0 <= x < width and 0 <= y < height):
            raise ValueError(f"QR pixel out of bounds: {svg_file}")
        matrix[y][x] = 0
    scale = 10
    with output_file.open("wb") as f:
        f.write(f"P5\n{width * scale} {height * scale}\n255\n".encode())
        for row in matrix:
            line = bytes(value for pixel in row for value in [pixel] * scale)
            for _ in range(scale):
                f.write(line)


def main() -> None:
    ids = set()
    urls = set()
    for item in DESTINATIONS:
        identifier = item["id"]
        url = item["url"]
        if identifier in ids or url in urls:
            raise AssertionError(f"Duplicate QR destination: {identifier}")
        ids.add(identifier)
        urls.add(url)
        if item["kind"] == "app":
            assert identifier in CATALOGUE, identifier
            assert url == CATALOGUE[identifier]["url"], identifier
        elif item["kind"] == "app-device":
            assert item["app"] in CATALOGUE, identifier
            assert url == f"{ORIGIN}/download/{item['device']}/?app={item['app']}", identifier
        else:
            assert item["kind"] == "device", identifier
            assert url == f"{ORIGIN}/download/{identifier}/", identifier
        svg = PUBLIC / item["qr"].lstrip("/")
        with tempfile.TemporaryDirectory() as directory:
            pgm = Path(directory) / "scan.pgm"
            render_svg_to_pgm(svg, pgm)
            result = subprocess.run(
                ["zbarimg", "--quiet", "--raw", str(pgm)],
                capture_output=True, text=True, check=False, timeout=15
            )
            decoded = result.stdout.strip()
            if result.returncode != 0 or decoded != url:
                raise AssertionError(
                    f"QR scan mismatch {identifier}: expected {url!r}, "
                    f"decoded {decoded!r}, scanner error {result.stderr[:240]!r}"
                )
    print(f"PASS: scanned and matched all {len(DESTINATIONS)} active app/device QR codes")


if __name__ == "__main__":
    main()
