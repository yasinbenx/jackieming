// Mini-Xiangqi am Brettspieltisch: Gegner wählen (drei Stufen), Regeln mit allen Figuren, Partie auf einem
// gezeichneten Brett (Steine anklicken, erlaubte Ziele werden markiert), Ergebnis. Laufende Partien und
// Ergebnisse werden gespeichert. Esc schließt und merkt sich die Partie.
import { h } from './dom';
import { store } from '../state/store';
import { bus } from '../core/bus';
import { OPPONENTS, PIECES, RULES_INTRO, XQ_LINES } from '../content/xiangqi';
import type { Opponent } from '../content/xiangqi';
import {
  chooseMove,
  deserialize,
  H,
  inCheck,
  newGame,
  outcome,
  pieceMoves,
  play,
  serialize,
  W,
  xy,
} from '../minigames/xiangqi';
import type { Game, Piece } from '../minigames/xiangqi';

export interface XqHost {
  /** Gegner spricht (Sprechblase über der Figur) */
  say: (npc: string, text: string) => void;
  /** Gegner-Geste */
  act: (npc: string, what: 'nod' | 'laugh' | 'think' | 'bow' | 'shrug') => void;
  award: (wordId: string) => void;
  onClose: () => void;
}

const SAVE_ID = 'xiangqi';
const CELL = 64;
const PAD = 40;
const BW = PAD * 2 + CELL * (W - 1);
const BH = PAD * 2 + CELL * (H - 1);
const px = (x: number): number => PAD + x * CELL;
const py = (y: number): number => PAD + (H - 1 - y) * CELL;
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)]!;

function boardSvg(): string {
  const lines: string[] = [];
  for (let y = 0; y < H; y++)
    lines.push(`<line x1="${px(0)}" y1="${py(y)}" x2="${px(W - 1)}" y2="${py(y)}"/>`);
  for (let x = 0; x < W; x++) {
    const edge = x === 0 || x === W - 1;
    // über den Fluss (zwischen y 2 und 3) nur die Randlinien
    if (edge) lines.push(`<line x1="${px(x)}" y1="${py(0)}" x2="${px(x)}" y2="${py(H - 1)}"/>`);
    else {
      lines.push(`<line x1="${px(x)}" y1="${py(0)}" x2="${px(x)}" y2="${py(2)}"/>`);
      lines.push(`<line x1="${px(x)}" y1="${py(3)}" x2="${px(x)}" y2="${py(H - 1)}"/>`);
    }
  }
  const ry = (py(2) + py(3)) / 2 + 9;
  return `<svg class="xq-svg" viewBox="0 0 ${BW} ${BH}" width="${BW}" height="${BH}" aria-hidden="true">
    <rect x="6" y="6" width="${BW - 12}" height="${BH - 12}" rx="6" class="xq-wood"/>
    <g class="xq-lines">${lines.join('')}</g>
    <text x="${px(1)}" y="${ry}" class="xq-river">楚河</text>
    <text x="${px(3)}" y="${ry}" class="xq-river">汉界</text>
  </svg>`;
}

export class XiangqiGame {
  readonly el: HTMLElement;
  private body: HTMLElement;
  open = false;
  private g: Game = newGame();
  private opp: Opponent = OPPONENTS[0]!;
  private sel: number | null = null;
  private busy = false;
  private last: { from: number; to: number } | null = null;
  private lost: { r: Piece[]; b: Piece[] } = { r: [], b: [] };
  private boardEl: HTMLElement | null = null;
  private infoEl: HTMLElement | null = null;
  private statusEl: HTMLElement | null = null;
  private token = 0;

  constructor(private host: XqHost) {
    this.body = h('div', { class: 'xq-body' });
    this.el = h(
      'section',
      { class: 'xiangqi', hidden: true, role: 'dialog', 'aria-label': 'Xiangqi' },
      h(
        'header',
        { class: 'tg-head' },
        h('h2', {}, h('span', { lang: 'zh' }, '象棋'), ' ', h('i', {}, 'xiàngqí'), ' · Chinesisches Schach'),
        h(
          'button',
          {
            class: 'dlg3-close',
            type: 'button',
            'aria-label': 'Schließen (Esc)',
            onclick: () => this.close(),
          },
          '×',
        ),
      ),
      this.body,
    );
    document.body.appendChild(this.el);
    window.addEventListener('keydown', (e) => {
      if (this.open && e.key === 'Escape') {
        e.preventDefault();
        this.close();
      }
    });
  }

  /** Am Tisch: Gegnerwahl (oder Fortsetzen) */
  start(): void {
    this.open = true;
    this.el.hidden = false;
    document.body.classList.add('dialog-open', 'xq-open');
    if (!store.progress.games['xq-rules-seen']) this.showRules(true);
    else this.showLobby();
  }

  close(): void {
    if (!this.open) return;
    this.token++;
    this.open = false;
    this.el.hidden = true;
    document.body.classList.remove('dialog-open', 'xq-open');
    this.host.onClose();
  }

  private stats(level: number): string {
    const gm = store.progress.games;
    return `${gm[`xq-w${level}`] ?? 0} Siege · ${gm[`xq-l${level}`] ?? 0} Niederlagen${gm[`xq-d${level}`] ? ` · ${gm[`xq-d${level}`]} remis` : ''}`;
  }

  // ── Gegnerwahl
  private showLobby(): void {
    const saved = store.progress.saves[SAVE_ID];
    const savedGame = saved ? deserialize(saved.split('#')[0]!) : null;
    const savedLevel = saved ? Number(saved.split('#')[1]) || 1 : 1;
    const cards = OPPONENTS.map((o) =>
      h(
        'button',
        { class: 'xq-opp', type: 'button', onclick: () => this.newMatch(o) },
        h('span', { class: 'xq-opp-zh', lang: 'zh' }, o.zh),
        h('b', {}, o.name),
        h('small', {}, o.blurb),
        h('small', { class: 'xq-opp-stats' }, `${this.stats(o.level)} · Sieg: ${o.coins} Münzen`),
      ),
    );
    this.body.replaceChildren(
      h(
        'p',
        { class: 'xq-lead' },
        'Die Brettspieler laden dich zu einer Partie Mini-Xiangqi ein. Gegen wen spielst du?',
      ),
      savedGame
        ? h(
            'button',
            {
              class: 'btn primary xq-resume',
              type: 'button',
              onclick: () => {
                this.opp = OPPONENTS.find((o) => o.level === savedLevel) ?? OPPONENTS[0]!;
                this.g = savedGame;
                this.lost = { r: [], b: [] };
                this.last = null;
                this.showBoard();
              },
            },
            `Partie fortsetzen (Zug ${Math.floor(savedGame.ply / 2) + 1})`,
          )
        : '',
      h('div', { class: 'xq-opps' }, ...cards),
      h(
        'div',
        { class: 'tg-actions' },
        h(
          'button',
          { class: 'btn', type: 'button', onclick: () => this.showRules(false) },
          'Regeln und Figuren',
        ),
      ),
    );
  }

  // ── Regeln
  private showRules(first: boolean): void {
    const pieces = (Object.keys(PIECES) as (keyof typeof PIECES)[]).map((k) => {
      const p = PIECES[k];
      return h(
        'div',
        { class: 'xq-rule' },
        h('span', { class: 'xq-stone r', lang: 'zh' }, p.zh.r),
        h('span', { class: 'xq-stone b', lang: 'zh' }, p.zh.b),
        h(
          'div',
          {},
          h(
            'b',
            {},
            `${p.de} `,
            h('span', { lang: 'zh' }, p.zh.r === p.zh.b ? p.zh.r : `${p.zh.r} / ${p.zh.b}`),
            ' ',
            h('i', { class: 'q-py' }, p.py.r === p.py.b ? p.py.r : `${p.py.r} / ${p.py.b}`),
          ),
          h('p', {}, p.rule),
        ),
      );
    });
    const go = h(
      'button',
      {
        class: 'btn primary',
        type: 'button',
        onclick: () => {
          store.setGame('xq-rules-seen', 1);
          this.showLobby();
        },
      },
      first ? 'Verstanden, Gegner wählen' : 'Zurück',
    );
    this.body.replaceChildren(
      h(
        'div',
        { class: 'xq-rules' },
        ...RULES_INTRO.map((t) => h('p', {}, t)),
        h('div', { class: 'xq-pieces' }, ...pieces),
      ),
      h('div', { class: 'tg-actions' }, go),
    );
  }

  // ── Partie
  private newMatch(o: Opponent): void {
    this.opp = o;
    this.g = newGame();
    this.lost = { r: [], b: [] };
    this.last = null;
    this.sel = null;
    store.setSave(SAVE_ID, null);
    this.host.say(o.npc, pick(XQ_LINES.start));
    this.host.act(o.npc, 'bow');
    this.showBoard();
  }

  private save(): void {
    store.setSave(SAVE_ID, outcome(this.g) ? null : `${serialize(this.g)}#${this.opp.level}`);
  }

  private showBoard(): void {
    this.boardEl = h('div', { class: 'xq-board', style: `width:${BW}px;height:${BH}px`, html: boardSvg() });
    this.infoEl = h('div', { class: 'xq-info' });
    this.statusEl = h('div', { class: 'xq-status', role: 'status' });
    const resign = h('button', { class: 'btn', type: 'button' }, 'Aufgeben');
    resign.addEventListener('click', () => this.finish({ winner: 'b', reason: 'general' }, true));
    this.body.replaceChildren(
      h(
        'div',
        { class: 'xq-play' },
        h('div', { class: 'xq-board-wrap' }, this.boardEl),
        h(
          'div',
          { class: 'xq-side' },
          h('div', { class: 'xq-opp-line' }, h('b', {}, this.opp.name), h('small', {}, this.opp.blurb)),
          this.statusEl,
          this.infoEl,
          h(
            'div',
            { class: 'tg-actions' },
            h('button', { class: 'btn', type: 'button', onclick: () => this.showRulesOverlay() }, 'Regeln'),
            resign,
          ),
        ),
      ),
    );
    this.render();
    if (this.g.turn === 'b') this.aiTurn();
  }

  private showRulesOverlay(): void {
    const g = this.g;
    const back = this.body.replaceChildren.bind(this.body, ...this.body.childNodes);
    this.showRules(false);
    const btn = this.body.querySelector('.tg-actions .btn') as HTMLButtonElement;
    btn.onclick = () => {
      back();
      this.g = g;
      this.render();
    };
  }

  private render(): void {
    const b = this.boardEl!;
    b.querySelectorAll('.xq-piece, .xq-dot, .xq-mark').forEach((n) => n.remove());
    const targets = this.sel !== null ? pieceMoves(this.g.board, this.sel) : [];
    if (this.last) {
      for (const i of [this.last.from, this.last.to]) {
        const [x, y] = xy(i);
        b.append(h('span', { class: 'xq-mark', style: `left:${px(x)}px;top:${py(y)}px` }));
      }
    }
    this.g.board.forEach((p, i) => {
      if (!p) return;
      const [x, y] = xy(i);
      const info = PIECES[p.k];
      const btn = h(
        'button',
        {
          class: `xq-piece xq-stone ${p.s}${this.sel === i ? ' sel' : ''}${targets.includes(i) ? ' target' : ''}`,
          type: 'button',
          lang: 'zh',
          style: `left:${px(x)}px;top:${py(y)}px`,
          'aria-label': `${p.s === 'r' ? 'Rot' : 'Schwarz'}: ${info.de} ${info.zh[p.s]}`,
        },
        info.zh[p.s],
      );
      btn.addEventListener('click', () => this.clickCell(i));
      b.append(btn);
    });
    for (const t of targets) {
      if (this.g.board[t]) continue;
      const [x, y] = xy(t);
      const dot = h('button', {
        class: 'xq-dot',
        type: 'button',
        'aria-label': 'hierhin ziehen',
        style: `left:${px(x)}px;top:${py(y)}px`,
      });
      dot.addEventListener('click', () => this.clickCell(t));
      b.append(dot);
    }
    // Status und Steinkunde
    const end = outcome(this.g);
    const check = inCheck(this.g.board, 'r');
    this.statusEl!.className = `xq-status${check ? ' check' : ''}`;
    this.statusEl!.textContent = end
      ? ''
      : this.busy || this.g.turn === 'b'
        ? `${this.opp.name} überlegt …`
        : check
          ? '将军！Dein General wird angegriffen. Bring ihn in Sicherheit oder schlag den Angreifer.'
          : 'Du bist am Zug (Rot). Klick einen roten Stein an.';
    const selP = this.sel !== null ? this.g.board[this.sel] : null;
    const lostLine = (s: 'r' | 'b'): string => this.lost[s].map((p) => PIECES[p.k].zh[p.s]).join(' ') || '–';
    this.infoEl!.replaceChildren(
      selP
        ? h(
            'div',
            { class: 'xq-sel' },
            h('span', { class: `xq-stone ${selP.s}`, lang: 'zh' }, PIECES[selP.k].zh[selP.s]),
            h(
              'div',
              {},
              h('b', {}, PIECES[selP.k].de, ' ', h('i', { class: 'q-py' }, PIECES[selP.k].py[selP.s])),
              h('p', {}, PIECES[selP.k].rule),
            ),
          )
        : h(
            'p',
            { class: 'xq-hint' },
            'Tipp: Ein angeklickter Stein zeigt seine erlaubten Züge und wie er zieht.',
          ),
      h(
        'p',
        { class: 'xq-lost' },
        h('b', {}, 'Geschlagen – deine: '),
        h('span', { lang: 'zh' }, lostLine('r')),
        h('b', {}, ' · gegnerische: '),
        h('span', { lang: 'zh' }, lostLine('b')),
      ),
    );
  }

  private clickCell(i: number): void {
    if (this.busy || this.g.turn !== 'r' || outcome(this.g)) return;
    const p = this.g.board[i];
    if (this.sel !== null && pieceMoves(this.g.board, this.sel).includes(i)) {
      this.move({ from: this.sel, to: i });
      return;
    }
    if (p && p.s === 'r') {
      this.sel = this.sel === i ? null : i;
      bus.emit('ui:click');
      const w = PIECES[p.k].word;
      if (w) this.host.award(w);
    } else this.sel = null;
    this.render();
  }

  private move(m: { from: number; to: number }): void {
    const mover = this.g.turn;
    const r = play(this.g, m);
    this.g = r.game;
    this.last = m;
    this.sel = null;
    bus.emit('scene:pour');
    if (r.captured) {
      this.lost[r.captured.s].push(r.captured);
      const npc = this.opp.npc;
      if (mover === 'r') {
        this.host.say(npc, pick(XQ_LINES.lostPiece));
        this.host.act(npc, 'shrug');
      } else {
        this.host.say(npc, pick(XQ_LINES.capture));
        this.host.act(npc, 'laugh');
      }
    }
    this.save();
    const end = outcome(this.g);
    if (end) {
      this.render();
      window.setTimeout(() => this.finish(end, false), 700);
      return;
    }
    if (mover === 'b' && inCheck(this.g.board, 'r')) {
      this.host.say(this.opp.npc, pick(XQ_LINES.check));
      this.host.award('jiangjun');
    }
    this.render();
    if (this.g.turn === 'b') this.aiTurn();
  }

  private aiTurn(): void {
    this.busy = true;
    this.render();
    const tok = this.token;
    this.host.act(this.opp.npc, 'think');
    window.setTimeout(() => {
      if (tok !== this.token || !this.open) return;
      const m = chooseMove(this.g, this.opp.level);
      this.busy = false;
      if (m) this.move(m);
      else this.render();
    }, 650);
  }

  private finish(end: NonNullable<ReturnType<typeof outcome>>, resigned: boolean): void {
    const lv = this.opp.level;
    const key = end.winner === 'r' ? 'w' : end.winner === 'b' ? 'l' : 'd';
    store.setGame(`xq-${key}${lv}`, (store.progress.games[`xq-${key}${lv}`] ?? 0) + 1);
    store.setSave(SAVE_ID, null);
    const npc = this.opp.npc;
    if (end.winner === 'r') {
      store.addCoins(this.opp.coins);
      this.host.say(npc, pick(XQ_LINES.lose));
      this.host.act(npc, 'bow');
    } else if (end.winner === 'b') {
      this.host.say(npc, pick(XQ_LINES.win));
      this.host.act(npc, 'nod');
    } else this.host.say(npc, pick(XQ_LINES.draw));
    const title =
      end.winner === 'r'
        ? '你赢了！Du hast gewonnen.'
        : end.winner === 'b'
          ? resigned
            ? 'Aufgegeben.'
            : 'Verloren.'
          : 'Unentschieden.';
    const why =
      end.reason === 'general'
        ? end.winner === 'r'
          ? 'Du hast den gegnerischen General geschlagen.'
          : resigned
            ? 'Beim nächsten Mal klappt es.'
            : 'Dein General wurde geschlagen.'
        : end.reason === 'stuck'
          ? `${end.winner === 'r' ? 'Dein Gegner' : 'Du'} hatte keinen Zug mehr.`
          : 'Nach 120 Halbzügen ohne Entscheidung.';
    this.body.replaceChildren(
      h(
        'div',
        { class: 'tg-result' },
        h(
          'span',
          { class: `xq-stone big ${end.winner === 'b' ? 'b' : 'r'}`, lang: 'zh' },
          end.winner === 'b' ? '将' : '帅',
        ),
        h('h3', {}, title),
        h('p', {}, why),
        end.winner === 'r'
          ? h('p', { class: 'tg-coins' }, h('b', {}, `+${this.opp.coins}`), ' Münzen')
          : null,
        h('p', { class: 'xq-opp-stats' }, `Gegen ${this.opp.name}: ${this.stats(lv)}`),
      ),
      h(
        'div',
        { class: 'tg-actions' },
        h('button', { class: 'btn', type: 'button', onclick: () => this.close() }, 'Aufstehen'),
        h('button', { class: 'btn', type: 'button', onclick: () => this.showLobby() }, 'Anderer Gegner'),
        h(
          'button',
          { class: 'btn primary', type: 'button', onclick: () => this.newMatch(this.opp) },
          '再来一局 Noch eine Partie',
        ),
      ),
    );
  }
}
