// Aufgaben im Spiel: Der Teemeister bietet sie an (Ausrufezeichen über ihm), eine Anzeige oben links zeigt den
// nächsten Schritt, Ereignisse aus der Welt (Tasse genommen, Gast angesprochen, Katze gefunden, Tee gebrüht)
// bringen sie voran. Beim Abgeben gibt es Münzen und Garderoben-Teile. Dazu Aufgabenbuch und Garderobe.
import { Vector3 } from 'three';
import type { World } from './world';
import type { Npcs } from './npcs';
import { CAT_HIDES, HEADS, QUESTS } from '../content/quests';
import type { Quest } from '../content/quests';
import { applyEvent, currentQuest, parseQuest, serializeQuest, stepText } from '../minigames/quests';
import type { QuestEvent, QuestState } from '../minigames/quests';
import { ALL_OUTFITS } from './looks';
import { store } from '../state/store';
import { h } from '../ui/dom';
import { Modal } from '../ui/modal';
import { pinyinHtml } from '../content/pinyin';
import type { Speaker } from '../ui/bubbles';
import { bus } from '../core/bus';
import { FLOOR } from './layout';

export interface QuestHost {
  world: World;
  npcs: Npcs;
  say: (sp: Speaker, text: string, hold?: number) => void;
  icon: (sp: Speaker, sym: string) => void;
  award: (wordId: string) => void;
  toast: (html: string) => void;
}

/** Wo die Tasse für „Tee bringen“ auf der Theke steht */
const TRAY_SPOT = new Vector3(-3.0, FLOOR, -3.55);

const itemName = (item: string): string => {
  const [kind, id] = item.split(':');
  if (kind === 'outfit') return `Outfit „${ALL_OUTFITS.find((o) => o.id === id)?.label ?? id}“`;
  const hd = HEADS.find((x) => x.id === id);
  return hd ? `${hd.de} (${hd.zh})` : id!;
};

export class QuestRunner {
  private tracker: HTMLElement;
  private offerEl: HTMLElement;
  carrying = false;
  private markT = 0;
  readonly journal = new Modal('journal', 'Aufgaben', '任务');
  readonly wardrobe = new Modal('wardrobe', 'Garderobe', '衣柜');

  constructor(private host: QuestHost) {
    this.tracker = h('aside', { class: 'quest-tracker', hidden: true, 'aria-live': 'polite' });
    this.offerEl = h('section', {
      class: 'quest-offer',
      hidden: true,
      role: 'dialog',
      'aria-label': 'Aufgabe',
    });
    document.body.append(this.tracker, this.offerEl);
    const w = host.world;
    // Tasse auf der Theke
    w.addInteractable({
      id: 'take-tea',
      pos: () => TRAY_SPOT,
      radius: 1.3,
      priority: 4,
      label: () => 'Tasse nehmen <span lang="zh">拿茶</span>',
      enabled: () => this.stepKind() === 'take' && !this.carrying && !w.player.seated,
      use: () => this.take(),
    });
    // Tee abliefern (an jede Figur, die der Schritt verlangt)
    for (const n of host.npcs.list) {
      w.addInteractable({
        id: `deliver-${n.profile.id}`,
        pos: () => n.pos,
        radius: 1.8,
        priority: 5,
        label: () => `Tee bringen <span lang="zh">送茶</span>: ${n.profile.name}`,
        hit: [n.ch.root],
        enabled: () => {
          const c = this.cur();
          const step = c?.quest.steps[c.state.step];
          return this.carrying && step?.kind === 'deliver' && step.to === n.profile.id;
        },
        use: () => this.deliver(n.profile.id),
      });
    }
    // laufende Katzensuche nach dem Laden wiederherstellen
    if (this.stepKind() === 'find-cat') this.hideCat();
    w.tickers.push((dt) => this.update(dt));
    this.refresh();
  }

  private cur(): { quest: Quest; state: QuestState } | null {
    return currentQuest(QUESTS, store.progress.quests);
  }

  private stepKind(): string | null {
    const c = this.cur();
    if (!c || c.state.status !== 'aktiv') return null;
    return c.quest.steps[c.state.step]?.kind ?? null;
  }

  private save(q: Quest, st: QuestState): void {
    store.setQuest(q.id, serializeQuest(st));
    this.refresh();
  }

  /** Ereignis aus der Welt; true, wenn es die Aufgabe weitergebracht hat */
  event(ev: QuestEvent): boolean {
    const c = this.cur();
    if (!c) return false;
    const r = applyEvent(c.quest, c.state, ev);
    if (!r.changed) return false;
    this.save(c.quest, r.state);
    const next = c.quest.steps[r.state.step];
    if (next && r.state.step !== c.state.step) {
      bus.emit('ui:click');
      this.flash();
      if (next.kind === 'report') this.host.toast(`<b>任务</b> ${c.quest.de}: ${next.text}`);
    }
    return true;
  }

  // ── Welt-Ereignisse

  /** Ansprechen: Teemeister (anbieten, Hinweis, abgeben), andere Gäste zählen */
  onTalk(id: string): boolean {
    if (id === 'master') return this.talkMaster();
    this.event({ type: 'talk', npc: id });
    return false;
  }

  onCat(): void {
    const cat = this.host.npcs.cat;
    if (this.stepKind() === 'find-cat' && cat.hidden) {
      cat.found();
      this.event({ type: 'cat' });
      this.host.award('zhao');
    }
  }

  onBrew(leaves: number): void {
    this.event({ type: 'brew', leaves });
  }

  private take(): void {
    const pl = this.host.world.player;
    pl.faceTo(TRAY_SPOT.x, TRAY_SPOT.z - 1);
    pl.ch.showProp('cup', true);
    this.carrying = true;
    bus.emit('scene:pour');
    this.event({ type: 'take', item: 'tea' });
  }

  private deliver(to: string): void {
    const n = this.host.npcs.list.find((x) => x.profile.id === to)!;
    const pl = this.host.world.player;
    pl.faceTo(n.pos.x, n.pos.z);
    pl.ch.showProp('cup', false);
    this.carrying = false;
    n.ch.lookAt(this.host.world.playerTarget());
    n.ch.play('nod', 1.4);
    this.host.say(n.speaker, '谢谢！Wie aufmerksam, der Tee ist noch warm.', 3);
    this.host.award('xiexie');
    this.event({ type: 'deliver', to });
  }

  private hideCat(): void {
    const w = this.host.world;
    const p = w.player.ch.root.position;
    const spots = CAT_HIDES.filter(([x, z]) => w.nav.walkable(x, z));
    const far = (spots.length ? spots : CAT_HIDES).reduce((a, b) =>
      Math.hypot(b[0] - p.x, b[1] - p.z) > Math.hypot(a[0] - p.x, a[1] - p.z) ? b : a,
    );
    this.host.npcs.cat.hide(far[0], far[1]);
  }

  // ── Teemeister

  private talkMaster(): boolean {
    const c = this.cur();
    const m = this.host.npcs.master;
    if (!c) return false;
    const w = this.host.world;
    m.ch.lookAt(w.playerTarget());
    w.player.faceTo(m.pos.x, m.pos.z);
    if (c.state.status === 'neu') {
      m.ch.play('bow', 1.4);
      this.host.say(m.speaker, `${c.quest.zh}…`, 2);
      this.showOffer(c.quest);
      return true;
    }
    const step = c.quest.steps[c.state.step];
    if (step?.kind === 'report') {
      this.complete(c.quest, c.state);
      return true;
    }
    // Hinweis zum aktuellen Schritt
    m.ch.play('nod', 1.2);
    this.host.say(m.speaker, stepText(c.quest, c.state), 3.2);
    return true;
  }

  private showOffer(q: Quest): void {
    const w = this.host.world;
    const prev = w.mode;
    w.mode = 'cutscene';
    const close = (): void => {
      this.offerEl.hidden = true;
      w.mode = prev === 'cutscene' ? 'free' : prev;
    };
    const accept = h(
      'button',
      { class: 'btn primary', type: 'button' },
      'Annehmen ',
      h('span', { lang: 'zh' }, '好'),
    );
    const later = h('button', { class: 'btn', type: 'button' }, 'Später');
    accept.addEventListener('click', () => {
      close();
      this.save(q, { status: 'aktiv', step: 0, seen: [] });
      if (q.steps[0]?.kind === 'find-cat') this.hideCat();
      this.host.say(this.host.npcs.master.speaker, '好，谢谢！', 2);
      this.flash();
    });
    later.addEventListener('click', close);
    this.offerEl.replaceChildren(
      h(
        'header',
        { class: 'qo-head' },
        h('span', { class: 'qo-kicker' }, 'Aufgabe vom Teemeister'),
        h(
          'h2',
          {},
          h('span', { lang: 'zh' }, q.zh),
          ' ',
          h('i', { class: 'q-py', html: pinyinHtml(q.py) }),
          ' ',
          q.de,
        ),
      ),
      h('p', { class: 'qo-text' }, `„${q.offer}“`),
      h('ol', { class: 'qo-steps' }, ...q.steps.map((s) => h('li', {}, s.text))),
      h(
        'p',
        { class: 'qo-reward' },
        h('b', {}, 'Belohnung: '),
        [`${q.reward.coins} Münzen`, ...q.reward.items.map(itemName)].join(', '),
      ),
      h('div', { class: 'qo-actions' }, later, accept),
    );
    this.offerEl.hidden = false;
    accept.focus({ preventScroll: true });
    const key = (e: KeyboardEvent): void => {
      if (this.offerEl.hidden) return window.removeEventListener('keydown', key, true);
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopImmediatePropagation();
        close();
      }
    };
    window.addEventListener('keydown', key, true);
  }

  private complete(q: Quest, st: QuestState): void {
    const m = this.host.npcs.master;
    this.event({ type: 'report' });
    void st;
    m.ch.play('bow', 1.8);
    this.host.say(m.speaker, q.thanks, 4);
    store.addCoins(q.reward.coins);
    const fresh = q.reward.items.filter((it) => store.grant(it));
    if (q.reward.word) this.host.award(q.reward.word);
    this.host.toast(
      `<b>任务 erledigt:</b> ${q.de} · +${q.reward.coins} Münzen${fresh.length ? ` · Neu: ${fresh.map(itemName).join(', ')} (Garderobe im Pausemenü)` : ''}`,
    );
    bus.emit('scene:tea');
  }

  // ── Anzeige

  private flash(): void {
    this.tracker.classList.remove('flash');
    void this.tracker.offsetWidth;
    this.tracker.classList.add('flash');
  }

  refresh(): void {
    const c = this.cur();
    if (!c || c.state.status !== 'aktiv') {
      this.tracker.hidden = true;
      return;
    }
    this.tracker.hidden = false;
    this.tracker.replaceChildren(
      h('div', { class: 'qt-title' }, h('span', { lang: 'zh' }, c.quest.zh), ' ', c.quest.de),
      h('div', { class: 'qt-step' }, stepText(c.quest, c.state)),
    );
  }

  private update(dt: number): void {
    // Zeichen über dem Teemeister: ! = neue Aufgabe, ? = abgeben
    this.markT -= dt;
    if (this.markT > 0) return;
    this.markT = 5;
    const w = this.host.world;
    if (w.mode !== 'free' || !document.body.classList.contains('is-inside')) return;
    const c = this.cur();
    if (!c) return;
    const m = this.host.npcs.master;
    if (m.pos.distanceTo(w.player.ch.root.position) > 12) return;
    if (c.state.status === 'neu') this.host.icon(m.speaker, '!');
    else if (c.quest.steps[c.state.step]?.kind === 'report') this.host.icon(m.speaker, '?');
  }

  // ── Aufgabenbuch und Garderobe

  openJournal(): void {
    const states = store.progress.quests;
    const cur = this.cur();
    const items = QUESTS.map((q) => {
      const st = parseQuest(states[q.id]);
      const locked = st.status === 'neu' && cur?.quest.id !== q.id;
      return h(
        'li',
        { class: `qj-item ${st.status}${locked ? ' locked' : ''}` },
        h(
          'div',
          { class: 'qj-title' },
          h('span', { lang: 'zh' }, locked ? '？' : q.zh),
          ' ',
          locked ? 'Noch nicht freigeschaltet' : q.de,
        ),
        locked
          ? null
          : h(
              'div',
              { class: 'qj-state' },
              st.status === 'erledigt'
                ? '✓ erledigt'
                : st.status === 'aktiv'
                  ? `läuft: ${stepText(q, st)}`
                  : 'Sprich mit dem Teemeister, um sie anzunehmen.',
            ),
      );
    });
    this.journal.setContent(
      h(
        'p',
        { class: 'dict-count' },
        `${QUESTS.filter((q) => states[q.id] === 'erledigt').length} von ${QUESTS.length} Aufgaben erledigt · ${store.coins} Münzen`,
      ),
      h('ul', { class: 'qj-list' }, ...items),
      h(
        'p',
        { class: 'set-hint' },
        'Weitere Aufgaben und Botengänge ins Dorf kommen mit der Welt-Erweiterung.',
      ),
    );
    this.journal.open();
  }

  openWardrobe(): void {
    const w = this.host.world;
    const render = (): void => {
      const outfits = ALL_OUTFITS.map((o, i) => {
        const owned = i < 4 || store.owns(`outfit:${o.id}`);
        const b = h(
          'button',
          {
            class: 'swatch',
            type: 'button',
            'aria-pressed': String(w.outfitIndex === i),
            disabled: !owned,
            style: `--sw:${o.swatch}`,
            title: owned ? o.label : 'Noch nicht freigeschaltet',
          },
          h('span', { class: 'swatch-dot' }),
          h('span', { class: 'swatch-label' }, owned ? o.label : '？'),
        );
        b.addEventListener('click', () => {
          w.setOutfit(i);
          if (this.carrying) w.player.ch.showProp('cup', true);
          render();
        });
        return b;
      });
      const heads = HEADS.map((hd) => {
        const owned = hd.free || store.owns(`head:${hd.id}`);
        const b = h(
          'button',
          {
            class: 'wr-head',
            type: 'button',
            'aria-pressed': String(store.progress.wardrobe.head === hd.id),
            disabled: !owned,
          },
          h('span', { lang: 'zh' }, owned ? hd.zh : '？'),
          h('small', {}, owned ? hd.de : 'Belohnung'),
        );
        b.addEventListener('click', () => {
          store.setHead(hd.id);
          w.rebuildPlayer();
          if (this.carrying) w.player.ch.showProp('cup', true);
          render();
        });
        return b;
      });
      this.wardrobe.setContent(
        h('h3', {}, h('span', { lang: 'zh' }, '衣服'), ' Kleidung'),
        h('div', { class: 'swatches wr-outfits' }, ...outfits),
        h('h3', {}, h('span', { lang: 'zh' }, '帽子和发型'), ' Hut und Frisur'),
        h('div', { class: 'wr-heads' }, ...heads),
        h('p', { class: 'set-hint' }, 'Neue Teile gibt es als Belohnung für Aufgaben vom Teemeister.'),
      );
    };
    render();
    this.wardrobe.open();
  }
}
