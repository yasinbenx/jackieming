// Verdrahtet Szene, Figuren, Dialog und Oberfläche zu einem Spiel.
import type { Stage } from './scene/stage';
import { store } from './state/store';
import { JACKIE } from './content/jackie';
import { YAO } from './content/yao';
import { WORDS } from './content/words';
import { createHud } from './ui/hud';
import type { Hud } from './ui/hud';
import { Bubbles } from './ui/bubble';
import { WordCard } from './ui/wordcard';
import { Dialog } from './ui/dialog';
import { Dictionary, HeightPanel, InfoPage } from './ui/panels';
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
  private dict = new Dictionary();
  private heights = new HeightPanel();
  private info: InfoPage;
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
    this.info = new InfoPage(() => this.refresh());
    this.sound = new SoundPanel(() => this.onSoundChange());
    this.hud = createHud(stage, {
      onWords: () => this.dict.open(),
      onInfo: () => this.info.open(),
      onToast: () => void this.finale.start(),
      onSound: (a) => this.sound.toggle(a),
    });
    this.hud.setSoundIcon(store.settings.muted);
    this.finale = new Finale(this);
    this.eggs = new Eggs(this);
    jackie.onTap = () => this.dialog.open('jackie');
    yao.onTap = () => this.dialog.open('yao');
    // Willkommensgeschenk: die ersten beiden Wörter gehören beim ersten Besuch schon dem Gast.
    if (store.asked.size === 0 && store.words.size === 0) {
      store.addWord('chaguan');
      store.addWord('qingjin');
    }
    store.subscribe(() => this.refresh());
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

  /** Zeigt die Messlatte mit dem Größenvergleich (Easter Egg) */
  openHeights(): void {
    this.heights.open();
  }
}
