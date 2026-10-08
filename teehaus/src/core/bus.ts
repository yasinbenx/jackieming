// Winziger, typisierter Event-Bus: entkoppelt Dialog, Sound, Szene und UI voneinander.
import type { FigureId } from '../content/types';

export interface BusEvents {
  /** Eine Figur beginnt / endet zu sprechen */
  'voice:start': { who: FigureId };
  'voice:end': { who: FigureId };
  /** Ein Sprechgeräusch pro Buchstabe(ngruppe) */
  'voice:blip': { who: FigureId; ch: string };
  /** Allgemeine UI-Geräusche */
  'ui:click': undefined;
  'ui:open': undefined;
  'ui:close': undefined;
  'ui:unlock': undefined;
  'ui:word': { id: string };
  'ui:lock': undefined;
  'ui:select': { who: FigureId };
  /** Szenen-Ereignisse mit Klang */
  'scene:sip': { who: FigureId };
  'scene:pour': undefined;
  'scene:clink': undefined;
  'scene:gong': undefined;
  'scene:bonk': undefined;
  'scene:bird': undefined;
  'scene:koi': undefined;
  'scene:lantern': undefined;
  'scene:cat': undefined;
  'scene:steam': undefined;
  'scene:enter': undefined;
  'scene:finale': undefined;
  'quiz:right': undefined;
  'quiz:wrong': undefined;
  'time:changed': { t: number };
}

type Handler<K extends keyof BusEvents> = (payload: BusEvents[K]) => void;

class Bus {
  private handlers = new Map<string, Set<Handler<keyof BusEvents>>>();

  on<K extends keyof BusEvents>(type: K, fn: Handler<K>): () => void {
    let set = this.handlers.get(type);
    if (!set) this.handlers.set(type, (set = new Set()));
    set.add(fn as Handler<keyof BusEvents>);
    return () => set.delete(fn as Handler<keyof BusEvents>);
  }

  emit<K extends keyof BusEvents>(type: K, payload?: BusEvents[K]): void {
    this.handlers.get(type)?.forEach((fn) => (fn as Handler<K>)(payload as BusEvents[K]));
  }
}

export const bus = new Bus();
