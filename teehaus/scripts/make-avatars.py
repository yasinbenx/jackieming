"""Erzeugt die Papierfiguren-Texturen aus den freigestellten Fotos.

Ablauf (einmalig, offline):
  1. Originale von Wikimedia Commons laden (siehe Credits in src/content/credits.ts).
  2. Hintergrund lokal entfernen, z. B. mit @imgly/background-removal-node (nur als Werkzeug, wird nicht ausgeliefert).
  3. python3 scripts/make-avatars.py <jackie_cut.png> <yao_cut.png>

Die Gesichter werden nicht verändert: nur Zuschnitt, Skalierung, gerissene Papierkante und heller Papierrand.
"""
import random
import sys

from PIL import Image, ImageFilter

PAPER = (244, 234, 214, 255)
OUT = 'public/avatars'


def torn_mask(w, h, margin, seed):
    """Alpha-Maske mit unregelmäßigen 'gerissenen' Rändern an allen vier Seiten."""
    rnd = random.Random(seed)
    mask = Image.new('L', (w, h), 255)
    px = mask.load()

    def edge(n):
        vals, v = [], 0.0
        for _ in range(n):
            v = v * 0.82 + rnd.uniform(-1, 1) * 0.9
            vals.append(margin + v * margin * 0.45 + rnd.uniform(0, margin * 0.15))
        return vals

    top, bottom, left, right = edge(w), edge(w), edge(h), edge(h)
    for y in range(h):
        for x in range(w):
            if y < top[x] or y > h - 1 - bottom[x] or x < left[y] or x > w - 1 - right[y]:
                px[x, y] = 0
    return mask


def process(src, name, crop, border, seed, height=1024):
    im = Image.open(src).convert('RGBA').crop(crop)
    w, h = im.size
    alpha = im.split()[3]
    # Kanten, an denen die Person vom Bildrand abgeschnitten wird, wirken als gerissenes Papier
    alpha = Image.composite(alpha, Image.new('L', (w, h), 0), torn_mask(w, h, max(6, w // 90), seed))
    im.putalpha(alpha)
    # heller Papierrand: Silhouette erweitern
    grow = alpha.filter(ImageFilter.MaxFilter(border * 2 + 1)).filter(ImageFilter.GaussianBlur(1.2))
    grow = grow.point(lambda a: 255 if a > 110 else 0).filter(ImageFilter.GaussianBlur(0.8))
    paper = Image.new('RGBA', (w, h), PAPER)
    paper.putalpha(grow)
    paper.alpha_composite(im)
    bbox = paper.split()[3].getbbox()
    paper = paper.crop(bbox)
    scale = height / paper.height
    paper = paper.resize((round(paper.width * scale), height), Image.LANCZOS)
    paper.save(f'{OUT}/{name}.webp', 'WEBP', quality=86, method=6)
    print(name, paper.size)
    return paper


def portrait(img, name, box):
    """Quadratischer Ausschnitt (Kopf) für den Dialog."""
    p = img.crop(box).resize((256, 256), Image.LANCZOS)
    p.save(f'{OUT}/{name}-portrait.webp', 'WEBP', quality=86, method=6)


if __name__ == '__main__':
    jackie_src, yao_src = sys.argv[1], sys.argv[2]
    # Jackie: rechts steckt ein Mikrofon im Bildrand, deshalb dort schmaler zuschneiden
    j = process(jackie_src, 'jackie', (40, 30, 900, 1200), border=9, seed=7)
    y = process(yao_src, 'yao', (0, 0, 1240, 1210), border=10, seed=11)
    portrait(j, 'jackie', (round(j.width * 0.14), 0, round(j.width * 0.14) + round(j.width * 0.72), round(j.width * 0.72)))
    portrait(y, 'yao', (round(y.width * 0.21), 0, round(y.width * 0.21) + round(y.width * 0.39), round(y.width * 0.39)))
