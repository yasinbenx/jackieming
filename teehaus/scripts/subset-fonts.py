#!/usr/bin/env python3
"""Erzeugt kleine, selbst gehostete Schriftdateien (woff2) nur mit den Zeichen, die das Spiel verwendet.

Quelle: @fontsource/noto-serif-sc und @fontsource/ma-shan-zheng (beide SIL Open Font License 1.1).
Benötigt:  pip install fonttools brotli   und   npm install
Aufruf:    python3 scripts/subset-fonts.py
Schreibt:  src/assets/fonts/*.woff2
"""
import glob
import os
import re
import sys
import tempfile

from fontTools import subset
from fontTools.merge import Merger
from fontTools.ttLib import TTFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
CJK = re.compile(r"[ -⁯　-〿㐀-鿿＀-￯]")

# 1) Alle verwendeten chinesischen Zeichen einsammeln
chars = set()
for pattern in ("src/**/*.ts", "src/**/*.css", "index.html", "api/**/*.ts"):
    for path in glob.glob(os.path.join(ROOT, pattern), recursive=True):
        with open(path, encoding="utf-8") as f:
            chars.update(CJK.findall(f.read()))
# Zeichen, die später per KI-Chat auftauchen können (häufige Wörter), plus Satzzeichen
chars.update("，。！？、：；（）“”‘’…—·")
print(f"{len(chars)} Zeichen gefunden")

JOBS = [
    ("noto-serif-sc", "noto-serif-sc", 400),
    ("noto-serif-sc", "noto-serif-sc", 700),
    ("ma-shan-zheng", "ma-shan-zheng", 400),
]

for pkg, base, weight in JOBS:
    files = sorted(glob.glob(os.path.join(ROOT, "node_modules/@fontsource", pkg, "files", f"{base}-*-{weight}-normal.woff2")))
    if not files:
        sys.exit(f"Keine Dateien für {pkg} {weight} (npm install?)")
    parts = []
    covered = set()
    tmp = tempfile.mkdtemp()
    for i, path in enumerate(files):
        font = TTFont(path)
        cmap = font.getBestCmap()
        want = {c for c in chars if ord(c) in cmap} - covered
        if not want:
            font.close()
            continue
        opts = subset.Options()
        opts.layout_features = ["*"]
        opts.name_IDs = [0, 1, 2, 3, 4, 6, 13, 14]
        opts.notdef_outline = True
        opts.glyph_names = False
        sub = subset.Subsetter(opts)
        sub.populate(text="".join(want))
        sub.subset(font)
        out = os.path.join(tmp, f"part{i}.ttf")
        font.flavor = None
        font.save(out)
        parts.append(out)
        covered |= want
        font.close()
    missing = chars - covered
    merged = Merger().merge(parts) if len(parts) > 1 else TTFont(parts[0])
    merged.flavor = "woff2"
    target = os.path.join(ROOT, "src/assets/fonts", f"{base}-{weight}.woff2")
    merged.save(target)
    print(f"{os.path.basename(target)}: {os.path.getsize(target) / 1024:.1f} KB, {len(covered)} Zeichen, ohne Glyph: {''.join(sorted(missing))[:40]}")
