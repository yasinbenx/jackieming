// Sprechgeräusche (Blips): pro Figur eigene Stimmlage, Töne aus der Pentatonik – wie bei Animal Crossing,
// nur freundlicher. Jackie höher und heller, Yao tiefer und runder.
import { isCjk } from '../ui/dom';
import type { FigureId } from '../content/types';
import type { AudioEngine } from './engine';
import { midiToFreq } from './engine';

const DEGREES = [0, 2, 4, 7, 9];

export class Voice {
  private last: Record<FigureId, number> = { jackie: 0, yao: 0 };

  constructor(private e: AudioEngine) {}

  blip(who: FigureId, ch: string): void {
    const e = this.e;
    const code = ch.codePointAt(0) ?? 0;
    const deg = DEGREES[code % 5]!;
    const jackie = who === 'jackie';
    const base = jackie ? 74 : 57;
    const oct = jackie ? ((code >> 3) % 2) * 12 : ((code >> 3) % 2) * 12 - 0;
    const m = base + deg + oct + (isCjk(ch) ? 5 : 0);
    const f = midiToFreq(m) * (1 + (Math.random() - 0.5) * 0.02);
    // kleine Variation der Stimmlage, damit es nicht monoton klingt
    const prev = this.last[who];
    this.last[who] = f;
    const dur = jackie ? 0.06 : 0.075;
    e.tone({
      freq: prev > 0 && Math.abs(prev - f) < f * 0.6 ? prev : f,
      glideTo: f,
      dur,
      gain: jackie ? 0.1 : 0.13,
      type: jackie ? 'triangle' : 'sine',
      attack: 0.004,
      lowpass: jackie ? 3200 : 1500,
      bus: e.buses.sfx,
      reverb: 0.05,
    });
    // zweite Harmonische für etwas Stimmcharakter
    e.tone({ freq: f * 2.01, dur: dur * 0.7, gain: jackie ? 0.025 : 0.03, bus: e.buses.sfx, attack: 0.004 });
  }
}
