// Verdrahtet Szene, Figuren, Dialog und Oberfläche zu einem Spiel.
import type { Stage } from './three/stage';
import { store } from './state/store';
import { JACKIE } from './content/jackie';
import { YAO } from './content/yao';
import { WORDS } from './content/words';
import { createHud } from './ui/hud';
import type { Hud } from './ui/hud';
import { Bubbles } from './ui/bubble';
import { WordCard } from './ui/wordcard';
import { Dialog } from './ui/dialog';
import { CreditsPage, Dictionary, HeightPanel, InfoPage } from './ui/panels';
import { SoundPanel } from './ui/sound';
import { GameAudio } from './audio';
import { Toast } from './ui/toast';
import { Eggs } from './interactions/eggs';
import { Finale } from './interactions/finale';

const TOTAL_QUESTIONS = JACKIE.questions.length + YAO.questions.length;
/** Ab so vielen gestellten Fragen erscheint der Anstoßen-Knopf */
export const TOAST_UNLOCK = 8;

export class Game {
  readonly hud: Hud;
  readonly dialog: Dialog;
  readonly bubbles: Bubbles;
  readonly wordCard: WordCard;
  private lastActivity = performance.now();
  private lastIdle = 0;
  private idleCount = 0;
  private dict = new Dictionary();
  private heights = new HeightPanel();
  private info: InfoPage;
  readonly credits = new CreditsPage();
  readonly audio = new GameAudio();
  private sound: SoundPanel;
  readonly toast = new Toast();
  finaleActive = false;
  private finale: Finale;
  readonly eggs: Eggs;

  constructor(readonly stage: Stage) {
    const { jackie, yao } = stage.cast;
    this.bubbles = new Bubbles(stage);
    this.wordCard = new WordCard(() => `${store.words.size} von ${WORDS.length} Wörtern`);
    this.dialog = new Dialog({ jackie, yao }, this.wordCard, this.bubbles);
    void this.dialog.enableChat();
    this.info = new InfoPage(
      () => this.refresh(),
      () => {
        this.info.modal.close();
        this.credits.open();
      },
    );
    this.sound = new SoundPanel(() => this.onSoundChange());
    this.hud = createHud(stage, {
      onWords: () => this.dict.open(),
      onInfo: () => this.info.open(),
      onToast: () => void this.finale.start(),
      onSound: (a) => this.sound.toggle(a),
    });
    this.hud.setSoundIcon(store.settings.muted);
    this.finale = new Finale(this);
    stage.onInsideChange = (inside) => this.audio.setInside(inside);
    this.eggs = new Eggs(this);
    jackie.onTap = () => this.dialog.open('jackie');
    yao.onTap = () => this.dialog.open('yao');
    // Willkommensgeschenk: die ersten beiden Wörter gehören beim ersten Besuch schon dem Gast.
    if (store.asked.size === 0 && store.words.size === 0) {
      store.addWord('chaguan');
      store.addWord('qingjin');
    }
    for (const ev of ['pointerdown', 'keydown', 'wheel', 'touchstart']) {
      window.addEventListener(ev, () => (this.lastActivity = performance.now()), { passive: true });
    }
    window.setInterval(() => this.idleTick(), 2000);
    store.subscribe(() => this.refresh());
    // Einstellungen an die Szene weitergeben
    let calm = store.settings.calm;
    let quality = store.settings.quality;
    store.subscribe(() => {
      if (store.settings.calm !== calm) {
        calm = store.settings.calm;
        stage.setCalm(calm);
      }
      if (store.settings.quality !== quality) {
        quality = store.settings.quality;
        if (quality !== 'auto') stage.setQuality(quality);
      }
    });
    // Kamera richtet sich beim Gespräch sanft auf die Figur aus
    this.dialog.onOpenFigure = (id) => stage.focusFigure(id);
    this.refresh();
  }

  refresh(): void {
    this.hud.setProgress(store.asked.size, TOTAL_QUESTIONS, store.words.size, WORDS.length);
    this.hud.setToastReady(store.asked.size >= TOAST_UNLOCK);
  }

  /** Nach dem Eintreten: die beiden begrüßen den Gast. */
  async greet(): Promise<void> {
    const { jackie, yao } = this.stage.cast;
    await new Promise((r) => setTimeout(r, 1400));
    if (this.dialog.isOpen) return;
    jackie.react('hello');
    await this.bubbles.say(jackie, 'Willkommen im Teehaus! Setz dich, der Tee ist frisch.', 1200);
    if (this.dialog.isOpen) return;
    yao.react('nod');
    await this.bubbles.say(yao, 'Frag uns ruhig etwas. Tippe einfach auf einen von uns.', 1400);
  }

  private onSoundChange(): void {
    this.audio.applySettings();
    this.hud.setSoundIcon(store.settings.muted);
  }

  /** Wenn länger nichts passiert, meldet sich einer der beiden mit einem Satz (selten, nie während eines Gesprächs). */
  private idleTick(): void {
    const now = performance.now();
    if (!document.body.classList.contains('is-inside') || document.hidden) return;
    if (this.dialog.isOpen || this.finaleActive || document.body.classList.contains('modal-open')) return;
    if (this.idleCount >= 4 || now - this.lastActivity < 28000 || now - this.lastIdle < 50000) return;
    this.lastIdle = now;
    this.idleCount++;
    const who = Math.random() < 0.5 ? this.stage.cast.jackie : this.stage.cast.yao;
    const lines = (who.style.id === 'jackie' ? JACKIE : YAO).idle;
    void this.bubbles.say(who, lines[Math.floor(Math.random() * lines.length)]!, 1600);
  }

  /** Zeigt die Messlatte mit dem Größenvergleich (Easter Egg) */
  openHeights(): void {
    this.heights.open();
  }
}
