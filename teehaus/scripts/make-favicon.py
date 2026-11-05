#!/usr/bin/env python3
"""Erzeugt public/favicon.svg: rotes Siegel mit dem Schriftzeichen 茶 (als Pfad, ohne Schriftabhängigkeit).
Quelle der Glyphe: Ma Shan Zheng (SIL OFL 1.1) aus node_modules/@fontsource/ma-shan-zheng."""
import glob, os
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
CHAR = "茶"
glyph_path = None
for path in sorted(glob.glob(os.path.join(ROOT, "node_modules/@fontsource/ma-shan-zheng/files/ma-shan-zheng-*-400-normal.woff2"))):
    font = TTFont(path)
    cmap = font.getBestCmap()
    if ord(CHAR) in cmap:
        gs = font.getGlyphSet()
        name = cmap[ord(CHAR)]
        upm = font["head"].unitsPerEm
        # Glyphe in ein 64×64-Quadrat einpassen (Y-Achse spiegeln)
        scale = 46 / upm
        pen = SVGPathPen(gs)
        tp = TransformPen(pen, (scale, 0, 0, -scale, 9, 52))
        gs[name].draw(tp)
        glyph_path = pen.getCommands()
        break
if not glyph_path:
    raise SystemExit("Glyphe nicht gefunden")

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="12" fill="#b3261a"/>
  <rect x="3" y="3" width="58" height="58" rx="9" fill="none" stroke="#d9a94a" stroke-width="2"/>
  <path d="{glyph_path}" fill="#f3e7cc"/>
</svg>
'''
os.makedirs(os.path.join(ROOT, "public"), exist_ok=True)
with open(os.path.join(ROOT, "public/favicon.svg"), "w", encoding="utf-8") as f:
    f.write(svg)
print("public/favicon.svg geschrieben")
