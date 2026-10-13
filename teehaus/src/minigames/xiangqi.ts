// Mini-Xiangqi (小象棋): Regeln und Gegner ohne Oberfläche.
// Brett: 5 Linien breit, 6 tief (x 0–4, y 0–5). Rot unten (y 0–1) zieht zuerst, Schwarz oben (y 4–5).
// Zwischen y 2 und 3 liegt die Mitte („Fluss“). Gewonnen hat, wer den gegnerischen General schlägt; wer keinen
// Zug mehr hat, verliert (wie im echten Xiangqi). Nach MAX_PLIES Halbzügen endet die Partie unentschieden.
// Bewusst weggelassen: Palast, Elefanten und Berater, das Verbot sich gegenüberstehender Generäle.

export type Side = 'r' | 'b';
/** K General, R Wagen, H Pferd, C Kanone, P Soldat */
export type Kind = 'K' | 'R' | 'H' | 'C' | 'P';
export interface Piece {
  k: Kind;
  s: Side;
}
export type Board = (Piece | null)[];
export interface Move {
  from: number;
  to: number;
}
export interface Game {
  board: Board;
  turn: Side;
  ply: number;
}

export const W = 5;
export const H = 6;
export const MAX_PLIES = 120;
export const idx = (x: number, y: number): number => y * W + x;
export const xy = (i: number): [number, number] => [i % W, Math.floor(i / W)];
const inside = (x: number, y: number): boolean => x >= 0 && x < W && y >= 0 && y < H;
export const other = (s: Side): Side => (s === 'r' ? 'b' : 'r');

/** Startaufstellung */
export function newGame(): Game {
  const board: Board = new Array(W * H).fill(null);
  const back: Kind[] = ['R', 'H', 'K', 'C', 'R'];
  back.forEach((k, x) => {
    board[idx(x, 0)] = { k, s: 'r' };
    // Schwarz spiegelbildlich (punktsymmetrisch), damit Kanone und Pferd sich gegenüberstehen
    board[idx(W - 1 - x, H - 1)] = { k, s: 'b' };
  });
  for (const x of [0, 2, 4]) {
    board[idx(x, 1)] = { k: 'P', s: 'r' };
    board[idx(x, H - 2)] = { k: 'P', s: 'b' };
  }
  return { board, turn: 'r', ply: 0 };
}

/** Soldat hat die Mitte überquert? */
export const crossed = (s: Side, y: number): boolean => (s === 'r' ? y >= H / 2 : y < H / 2);

const ORTHO: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Alle Züge einer Figur (Schlagen des Generals erlaubt; eigene Figuren blockieren) */
export function pieceMoves(board: Board, from: number): number[] {
  const p = board[from];
  if (!p) return [];
  const [x, y] = xy(from);
  const out: number[] = [];
  const add = (tx: number, ty: number): boolean => {
    if (!inside(tx, ty)) return false;
    const t = board[idx(tx, ty)];
    if (!t || t.s !== p.s) out.push(idx(tx, ty));
    return !t;
  };
  switch (p.k) {
    case 'K':
      for (const [dx, dy] of ORTHO) add(x + dx, y + dy);
      break;
    case 'R':
      for (const [dx, dy] of ORTHO) for (let n = 1; add(x + dx * n, y + dy * n); n++);
      break;
    case 'C':
      for (const [dx, dy] of ORTHO) {
        let n = 1;
        // ohne Schlagen wie der Wagen
        while (inside(x + dx * n, y + dy * n) && !board[idx(x + dx * n, y + dy * n)]) {
          out.push(idx(x + dx * n, y + dy * n));
          n++;
        }
        // Schlagen nur über genau eine Figur hinweg (die „Lafette“)
        n++;
        while (inside(x + dx * n, y + dy * n)) {
          const t = board[idx(x + dx * n, y + dy * n)];
          if (t) {
            if (t.s !== p.s) out.push(idx(x + dx * n, y + dy * n));
            break;
          }
          n++;
        }
      }
      break;
    case 'H':
      for (const [dx, dy] of ORTHO) {
        // erst ein Schritt gerade (muss frei sein, sonst ist das Pferd „gehemmt“), dann einer schräg nach außen
        if (!inside(x + dx, y + dy) || board[idx(x + dx, y + dy)]) continue;
        if (dx) {
          add(x + 2 * dx, y + 1);
          add(x + 2 * dx, y - 1);
        } else {
          add(x + 1, y + 2 * dy);
          add(x - 1, y + 2 * dy);
        }
      }
      break;
    case 'P': {
      const f = p.s === 'r' ? 1 : -1;
      add(x, y + f);
      if (crossed(p.s, y)) {
        add(x + 1, y);
        add(x - 1, y);
      }
      break;
    }
  }
  return out;
}

export function legalMoves(g: Game, side: Side = g.turn): Move[] {
  const moves: Move[] = [];
  g.board.forEach((p, i) => {
    if (p && p.s === side) for (const to of pieceMoves(g.board, i)) moves.push({ from: i, to });
  });
  return moves;
}

/** Zug ausführen (neues Spiel-Objekt); gibt die geschlagene Figur mit zurück */
export function play(g: Game, m: Move): { game: Game; captured: Piece | null } {
  const board = g.board.slice();
  const captured = board[m.to] ?? null;
  board[m.to] = board[m.from]!;
  board[m.from] = null;
  return { game: { board, turn: other(g.turn), ply: g.ply + 1 }, captured };
}

/** Steht der General dieser Seite im Angriff („将军“)? */
export function inCheck(board: Board, side: Side): boolean {
  const k = board.findIndex((p) => p?.k === 'K' && p.s === side);
  if (k < 0) return false;
  return board.some((p, i) => p && p.s !== side && pieceMoves(board, i).includes(k));
}

export type Outcome = { winner: Side | null; reason: 'general' | 'stuck' | 'limit' } | null;

/** Partie zu Ende? */
export function outcome(g: Game): Outcome {
  for (const s of ['r', 'b'] as Side[])
    if (!g.board.some((p) => p?.k === 'K' && p.s === s)) return { winner: other(s), reason: 'general' };
  if (!legalMoves(g).length) return { winner: other(g.turn), reason: 'stuck' };
  if (g.ply >= MAX_PLIES) return { winner: null, reason: 'limit' };
  return null;
}

// ───────────────────────────────────────── Gegner

const VALUE: Record<Kind, number> = { K: 10000, R: 900, C: 450, H: 400, P: 100 };

/** Bewertung aus Sicht von side: Material, vorgerückte Soldaten, Beweglichkeit in der Mitte */
export function evaluate(board: Board, side: Side): number {
  let score = 0;
  board.forEach((p, i) => {
    if (!p) return;
    const [x, y] = xy(i);
    let v = VALUE[p.k];
    if (p.k === 'P' && crossed(p.s, y)) v += 60;
    if (p.k === 'H' || p.k === 'C') v += x === 2 ? 15 : x === 1 || x === 3 ? 8 : 0;
    score += p.s === side ? v : -v;
  });
  return score;
}

/** Schlagzüge zuerst (wertvolles Opfer mit billigem Angreifer) */
function ordered(g: Game, moves: Move[]): Move[] {
  const key = (m: Move): number => {
    const t = g.board[m.to];
    return t ? VALUE[t.k] * 10 - VALUE[g.board[m.from]!.k] / 10 : 0;
  };
  return moves.sort((a, b) => key(b) - key(a));
}

function negamax(g: Game, depth: number, alpha: number, beta: number, stop: () => boolean): number {
  const side = g.turn;
  if (!g.board.some((p) => p?.k === 'K' && p.s === side)) return -100000 - depth;
  if (depth === 0 || stop()) return evaluate(g.board, side);
  const moves = ordered(g, legalMoves(g));
  if (!moves.length) return -100000 - depth;
  let best = -Infinity;
  for (const m of moves) {
    const v = -negamax(play(g, m).game, depth - 1, -beta, -alpha, stop);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}

export type Level = 1 | 2 | 3;

/**
 * Zug des Gegners. Stufe 1: schaut einen Zug weit und greift oft daneben. Stufe 2: zwei Halbzüge, kleine Fehler.
 * Stufe 3: bis vier Halbzüge mit Zeitgrenze, ohne Zufall. rnd ist austauschbar für Tests.
 */
export function chooseMove(
  g: Game,
  level: Level,
  rnd: () => number = Math.random,
  timeMs = 600,
): Move | null {
  const moves = ordered(g, legalMoves(g));
  if (!moves.length) return null;
  // General schlagen geht immer vor
  const kill = moves.find((m) => g.board[m.to]?.k === 'K');
  if (kill) return kill;
  if (level === 1 && rnd() < 0.45) return moves[Math.floor(rnd() * moves.length)]!;
  const depth = level === 1 ? 1 : level === 2 ? 2 : 4;
  const t0 = Date.now();
  const stop = (): boolean => Date.now() - t0 > timeMs;
  let best: Move[] = [];
  let bestV = -Infinity;
  for (const m of moves) {
    const v =
      -negamax(play(g, m).game, depth - 1, -Infinity, Infinity, stop) + (level === 2 ? rnd() * 40 : 0);
    if (v > bestV + 1e-9) {
      bestV = v;
      best = [m];
    } else if (Math.abs(v - bestV) < 1e-9) best.push(m);
  }
  return best[Math.floor(rnd() * best.length)] ?? moves[0]!;
}

// ───────────────────────────────────────── Speichern

const CODE: Record<Kind, string> = { K: 'k', R: 'r', H: 'h', C: 'c', P: 'p' };

/** Kurzform: Feld für Feld (Rot groß, Schwarz klein, leer '.'), dann Zugrecht und Zugzahl */
export function serialize(g: Game): string {
  const cells = g.board.map((p) => (p ? (p.s === 'r' ? CODE[p.k].toUpperCase() : CODE[p.k]) : '.')).join('');
  return `${cells}|${g.turn}|${g.ply}`;
}

export function deserialize(s: string): Game | null {
  const [cells, turn, ply] = s.split('|');
  if (!cells || cells.length !== W * H || (turn !== 'r' && turn !== 'b')) return null;
  const rev = Object.fromEntries(Object.entries(CODE).map(([k, c]) => [c, k as Kind]));
  const board: Board = [...cells].map((c) => {
    if (c === '.') return null;
    const k = rev[c.toLowerCase()];
    return k ? { k, s: c === c.toUpperCase() ? 'r' : 'b' } : null;
  });
  const g: Game = { board, turn, ply: Number(ply) || 0 };
  return board.filter((p) => p?.k === 'K').length === 2 ? g : null;
}
