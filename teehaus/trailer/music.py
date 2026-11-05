#!/usr/bin/env python3
"""Trailer-Musik und Atmosphäre, komplett selbst erzeugt (numpy, keine fremden Dateien).

Pentatonik in D (D E F# A B), Guzheng-artige Zupftöne (Karplus-Strong), sanfte Flöte mit Vibrato und Atem,
Wind, Vögel, Teeplätschern, Glöckchen an den Schnitten, leise Trommel im Dorf. Ausgabe: WAV 48 kHz Stereo.
Aufruf: python3 trailer/music.py <ausgabe.wav> [länge_s]
"""
import sys
import wave

import numpy as np

SR = 48000
OUT = sys.argv[1] if len(sys.argv) > 1 else "trailer/work/musik.wav"
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 56.0
N = int(SR * DUR)
rng = np.random.default_rng(20261105)
L = np.zeros(N)
R = np.zeros(N)

# Schnitte (s): Titel → Anflug → Innen → Dorf → Spiele → Schluss
CUTS = [4.7, 13.6, 25.0, 36.4, 46.3]


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


PENTA = [50, 52, 54, 57, 59, 62, 64, 66, 69, 71, 74, 76, 78, 81]  # D-Pentatonik über zwei Oktaven


def add(sig, t, pan=0.0, gain=1.0):
    i = int(t * SR)
    if i >= N:
        return
    sig = sig[: N - i] * gain
    lg = np.cos((pan + 1) * np.pi / 4)
    rg = np.sin((pan + 1) * np.pi / 4)
    L[i : i + len(sig)] += sig * lg
    R[i : i + len(sig)] += sig * rg


def pluck(m, dur=2.6, bright=0.5):
    """Karplus-Strong: gezupfte Saite (Guzheng-artig), dazu ein leichter Anschlag."""
    f = midi(m)
    n = int(SR * dur)
    period = int(SR / f)
    buf = rng.uniform(-1, 1, period) * 0.6
    # weicher Anschlag: Tiefpass auf das Startrauschen
    for _ in range(int(3 - bright * 2)):
        buf = 0.5 * (buf + np.roll(buf, 1))
    out = np.zeros(n)
    decay = 0.996 + 0.003 * bright
    for i in range(n):
        j = i % period
        out[i] = buf[j]
        buf[j] = decay * 0.5 * (buf[j] + buf[(j + 1) % period])
    env = np.minimum(1, np.arange(n) / (0.002 * SR))
    # Guzheng-Biegung am Ende (leichtes Vibrato über Resampling)
    return out * env


def flute(m, dur, vib=5.2):
    t = np.arange(int(SR * dur)) / SR
    f = midi(m) * (1 + 0.006 * np.sin(2 * np.pi * vib * t) * np.minimum(1, t / 0.6))
    ph = 2 * np.pi * np.cumsum(f) / SR
    sig = np.sin(ph) + 0.18 * np.sin(2 * ph) + 0.06 * np.sin(3 * ph)
    breath = rng.normal(0, 1, len(t))
    breath = np.convolve(breath, np.ones(30) / 30, mode="same") * 0.25
    env = np.minimum(1, t / 0.25) * np.minimum(1, (dur - t) / 0.4)
    return (sig + breath) * env * 0.5


def bell(m, dur=3.5):
    t = np.arange(int(SR * dur)) / SR
    f = midi(m)
    sig = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t * d) for a, r, d in
              [(1, 1, 1.2), (0.5, 2.76, 2.5), (0.3, 5.4, 4), (0.2, 8.93, 6)])
    return sig * np.minimum(1, t / 0.003) * 0.4


def drum(dur=0.6):
    t = np.arange(int(SR * dur)) / SR
    f = 95 * np.exp(-t * 6) + 55
    ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t * 7) + rng.normal(0, 1, len(t)) * np.exp(-t * 40) * 0.15) * 0.8


def noise_band(dur, lo, hi):
    """Bandbegrenztes Rauschen über FFT (Wind, Wasser)."""
    n = int(SR * dur)
    spec = np.fft.rfft(rng.normal(0, 1, n))
    fr = np.fft.rfftfreq(n, 1 / SR)
    spec[(fr < lo) | (fr > hi)] = 0
    sig = np.fft.irfft(spec, n)
    return sig / (np.abs(sig).max() + 1e-9)


def chirp(t0):
    for k in range(rng.integers(2, 4)):
        d = 0.09
        t = np.arange(int(SR * d)) / SR
        f0 = rng.uniform(2600, 3800)
        f = f0 + np.sin(np.pi * t / d) * 900
        sig = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.sin(np.pi * t / d) ** 2
        add(sig * 0.05, t0 + k * 0.13, pan=rng.uniform(-0.7, 0.7))


# ── Atmosphäre: Wind durchgehend, leiser Bordun (D + A)
wind = noise_band(DUR, 120, 900)
wenv = 0.5 + 0.5 * np.sin(2 * np.pi * np.arange(N) / SR / 7.0)
L += wind * 0.035 * wenv
R += np.roll(wind, SR // 3) * 0.035 * (1 - wenv * 0.5)
tt = np.arange(N) / SR
drone = (np.sin(2 * np.pi * midi(38) * tt) + 0.6 * np.sin(2 * np.pi * midi(45) * tt)) * 0.05
drone *= np.minimum(1, tt / 4) * (0.6 + 0.4 * np.sin(2 * np.pi * tt / 11))
L += drone
R += drone

# ── Titel (0–5 s): Glöckchen, tiefe Zupftöne
add(bell(81), 0.8, -0.3, 0.7)
add(bell(74), 2.6, 0.3, 0.5)
add(pluck(50, 4), 1.2, 0, 0.6)
add(pluck(57, 4), 3.4, 0.2, 0.5)

# ── Anflug (5–14.5 s): Guzheng-Melodie, Flöte, Vögel
mel = [62, 64, 66, 69, 66, 64, 62, 59, 57, 59, 62, 64]
for k, m in enumerate(mel):
    add(pluck(m, 2.4, 0.6), 4.9 + k * 0.72, pan=-0.2 + 0.4 * (k % 2), gain=0.55)
    if k % 3 == 0:
        add(pluck(m - 12, 3), 4.9 + k * 0.72, pan=0, gain=0.35)
add(flute(74, 3.2), 7.6, 0.25, 0.5)
add(flute(71, 2.4), 10.8, 0.25, 0.45)
for t0 in (6.2, 8.9, 11.9):
    chirp(t0)

# ── Innen (14.5–26.5 s): ruhiger, Tee wird eingegossen, Arpeggien
pour = noise_band(3.2, 500, 4500)
pt = np.arange(len(pour)) / SR
pour *= (0.5 + 0.5 * np.sin(2 * np.pi * 9 * pt + np.sin(2 * np.pi * 3 * pt))) * np.minimum(1, pt / 0.3) * np.minimum(1, (3.2 - pt) / 0.8)
add(pour * 0.12, 15.4, 0.3)
arp = [57, 62, 66, 69, 66, 62]
for k in range(14):
    add(pluck(arp[k % len(arp)], 2.2, 0.4), 13.9 + k * 0.82, pan=0.3 * np.sin(k), gain=0.42)
add(flute(69, 4.0), 17.6, -0.2, 0.42)
add(flute(66, 3.0), 22.0, -0.2, 0.38)
add(bell(86, 2.5), 19.6, 0.4, 0.25)

# ── Dorf (26.5–38.5 s): leise Trommel, belebtere Melodie, Laternenglöckchen
for k in range(16):
    t0 = 25.1 + k * 0.7
    if k % 4 in (0, 2):
        add(drum(), t0, 0, 0.35 if k % 4 == 0 else 0.22)
mel2 = [69, 71, 74, 71, 69, 66, 69, 64, 66, 69, 71, 74, 76, 74, 71, 69]
for k, m in enumerate(mel2):
    add(pluck(m, 2.0, 0.7), 25.1 + k * 0.7, pan=0.2 * np.sin(k * 1.3), gain=0.5)
for t0 in (29.4, 32.2, 34.6):
    add(bell(rng.choice([81, 83, 86]), 2.5), t0, rng.uniform(-0.6, 0.6), 0.22)
add(flute(78, 2.5), 32.8, 0.2, 0.35)

# ── Spiele (38.5–48 s): verspielte Zupftöne
for k in range(13):
    m = PENTA[[5, 7, 8, 7, 9, 8, 7, 5, 6, 7, 8, 10, 9][k]]
    add(pluck(m, 1.8, 0.8), 36.6 + k * 0.7, pan=-0.3 + 0.6 * (k % 2), gain=0.48)
    if k % 2 == 0:
        add(pluck(m - 12, 2.4), 36.6 + k * 0.7, 0, 0.3)
chirp(39.0)
chirp(43.2)

# ── Schluss (48–56 s): Auflösung auf D, Gong-artiger Klang, Ausklang
add(bell(62, 6), 46.4, 0, 0.6)
add(bell(74, 5), 46.45, 0.3, 0.35)
for k, m in enumerate([62, 66, 69, 74]):
    add(pluck(m, 4, 0.5), 46.7 + k * 0.45, pan=-0.3 + 0.2 * k, gain=0.45)
add(flute(74, 4.5), 48.3, 0, 0.42)

# ── Betonungen an den Schnitten
for c in CUTS[:-1]:
    add(bell(86, 2.2), c - 0.05, 0.5 if c > 20 else -0.5, 0.2)

# Ein- und Ausblenden, Hall (einfache Verzögerungen), Normalisieren
def reverb(x):
    y = x.copy()
    for d, g in [(0.031, 0.35), (0.047, 0.3), (0.071, 0.25), (0.113, 0.2), (0.173, 0.15), (0.241, 0.1)]:
        k = int(d * SR)
        y[k:] += x[:-k] * g
    return y


L = reverb(L)
R = reverb(R)
fade = np.minimum(1, tt / 1.5) * np.minimum(1, (DUR - tt) / 4.0)
L *= fade
R *= fade
peak = max(np.abs(L).max(), np.abs(R).max())
L = L / peak * 0.8
R = R / peak * 0.8
data = (np.stack([L, R], axis=1) * 32767).astype(np.int16)
with wave.open(OUT, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(data.tobytes())
print("geschrieben", OUT, f"{DUR} s")
