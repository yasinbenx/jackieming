// Mini-Xiangqi: Zugregeln, Spielende, Gegner, Speichern
import { describe, expect, it } from 'vitest';
import {
  chooseMove,
  deserialize,
  idx,
  inCheck,
  legalMoves,
  newGame,
  outcome,
  pieceMoves,
  play,
  serialize,
  W,
  H,
} from '../src/minigames/xiangqi';
import type { Board, Game, Kind, Side } from '../src/minigames/xiangqi';

const empty = (): Board => new Array(W * H).fill(null);
const put = (b: Board, x: number, y: number, k: Kind, s: Side) => (b[idx(x, y)] = { k, s });
/** Brett mit beiden Generälen in den Ecken (stören nicht) */
const base = (): Board => {
  const b = empty();
  put(b, 0, 0, 'K', 'r');
  put(b, 4, 5, 'K', 'b');
  return b;
};
const sorted = (a: number[]) => [...a].sort((x, y) => x - y);

describe('Aufstellung', () => {
  it('je 8 Figuren, Rot beginnt, 22 Züge möglich', () => {
    const g = newGame();
    expect(g.board.filter((p) => p?.s === 'r')).toHaveLength(8);
    expect(g.board.filter((p) => p?.s === 'b')).toHaveLength(8);
    expect(g.turn).toBe('r');
    expect(legalMoves(g).length).toBeGreaterThan(5);
    expect(outcome(g)).toBeNull();
  });
});

describe('Zugregeln', () => {
  it('Wagen fährt gerade bis zum Hindernis und schlägt es', () => {
    const b = base();
    put(b, 2, 2, 'R', 'r');
    put(b, 2, 4, 'P', 'b');
    put(b, 4, 2, 'P', 'r');
    const m = pieceMoves(b, idx(2, 2));
    expect(m).toContain(idx(2, 3));
    expect(m).toContain(idx(2, 4));
    expect(m).not.toContain(idx(2, 5));
    expect(m).toContain(idx(3, 2));
    expect(m).not.toContain(idx(4, 2));
  });

  it('Pferd: ein Schritt gerade, einer schräg; gehemmt, wenn der erste Schritt besetzt ist', () => {
    const b = base();
    put(b, 2, 2, 'H', 'r');
    expect(sorted(pieceMoves(b, idx(2, 2)))).toEqual(
      sorted([idx(1, 4), idx(3, 4), idx(1, 0), idx(3, 0), idx(4, 1), idx(4, 3), idx(0, 1), idx(0, 3)]),
    );
    put(b, 2, 3, 'P', 'b');
    const m = pieceMoves(b, idx(2, 2));
    expect(m).not.toContain(idx(1, 4));
    expect(m).not.toContain(idx(3, 4));
  });

  it('Kanone zieht wie der Wagen, schlägt aber nur über genau eine Figur', () => {
    const b = base();
    put(b, 2, 1, 'C', 'r');
    put(b, 2, 3, 'P', 'r');
    put(b, 2, 5, 'P', 'b');
    const m = pieceMoves(b, idx(2, 1));
    expect(m).toContain(idx(2, 2));
    expect(m).not.toContain(idx(2, 3));
    expect(m).not.toContain(idx(2, 4));
    expect(m).toContain(idx(2, 5));
    // ohne Lafette kein Schlag
    const c = base();
    put(c, 2, 1, 'C', 'r');
    put(c, 2, 4, 'P', 'b');
    expect(pieceMoves(c, idx(2, 1))).not.toContain(idx(2, 4));
  });

  it('Soldat: vorwärts, erst jenseits der Mitte auch seitwärts, nie zurück', () => {
    const b = base();
    put(b, 2, 1, 'P', 'r');
    expect(pieceMoves(b, idx(2, 1))).toEqual([idx(2, 2)]);
    put(b, 2, 3, 'P', 'r');
    expect(sorted(pieceMoves(b, idx(2, 3)))).toEqual(sorted([idx(2, 4), idx(3, 3), idx(1, 3)]));
    put(b, 1, 2, 'P', 'b');
    expect(sorted(pieceMoves(b, idx(1, 2)))).toEqual(sorted([idx(1, 1), idx(0, 2), idx(2, 2)]));
  });

  it('General geht einen Schritt gerade', () => {
    const b = base();
    expect(sorted(pieceMoves(b, idx(0, 0)))).toEqual(sorted([idx(1, 0), idx(0, 1)]));
  });
});

describe('Spielende und Schach', () => {
  it('General geschlagen: der andere gewinnt', () => {
    const b = base();
    put(b, 4, 0, 'R', 'r');
    const g: Game = { board: b, turn: 'r', ply: 0 };
    expect(inCheck(b, 'b')).toBe(true);
    const r = play(g, { from: idx(4, 0), to: idx(4, 5) });
    expect(r.captured?.k).toBe('K');
    expect(outcome(r.game)).toEqual({ winner: 'r', reason: 'general' });
  });

  it('Zuglimit: unentschieden', () => {
    const g = { ...newGame(), ply: 999 };
    expect(outcome(g)?.winner).toBeNull();
  });
});

describe('Gegner', () => {
  it('schlägt den General, wenn es geht (alle Stufen)', () => {
    const b = base();
    put(b, 4, 0, 'R', 'b');
    const g: Game = { board: b, turn: 'b', ply: 0 };
    for (const lv of [1, 2, 3] as const)
      expect(chooseMove(g, lv, () => 0.99)).toEqual({ from: idx(4, 0), to: idx(0, 0) });
  });

  it('Stufe 3 sieht einen Wagen-Gewinn und wählt nur erlaubte Züge', () => {
    const b = base();
    put(b, 1, 3, 'R', 'b');
    put(b, 1, 1, 'R', 'r');
    const g: Game = { board: b, turn: 'b', ply: 0 };
    const m = chooseMove(g, 3, () => 0.5, 2000)!;
    expect(legalMoves(g).some((x) => x.from === m.from && x.to === m.to)).toBe(true);
    expect(m).toEqual({ from: idx(1, 3), to: idx(1, 1) });
  });

  it('Stufe 3 antwortet aus der Startstellung schnell genug', () => {
    let g = newGame();
    g = play(g, legalMoves(g)[0]!).game;
    const t0 = Date.now();
    expect(chooseMove(g, 3, Math.random, 600)).not.toBeNull();
    expect(Date.now() - t0).toBeLessThan(1500);
  });

  it('eine ganze Partie Stufe 1 gegen Stufe 3 endet regelgerecht', () => {
    let g = newGame();
    let n = 0;
    while (!outcome(g) && n++ < 200) {
      const m = chooseMove(g, g.turn === 'r' ? 1 : 3, Math.random, 50)!;
      g = play(g, m).game;
    }
    expect(outcome(g)).not.toBeNull();
  });
});

describe('Speichern', () => {
  it('Stellung übersteht Speichern und Laden', () => {
    let g = newGame();
    g = play(g, legalMoves(g)[3]!).game;
    expect(deserialize(serialize(g))).toEqual(g);
    expect(deserialize('kaputt')).toBeNull();
  });
});
