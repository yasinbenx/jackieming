// Verdrahtet Welt, Oberfläche, Ton und Spielstand. NPCs, Dialog und Fundstücke hängen sich hier an.
import type { World } from './world/world';
import { store } from './state/store';
import { JACKIE } from './content/jackie';
import { YAO } from './content/yao';
import { WORDS } from './content/words';
import { createHud } from './ui/hud';
import type { Hud } from './ui/hud';
import { WordCard } from './ui/wordcard';
import { CreditsPage, Dictionary, HeightPanel, InfoPage } from './ui/panels';
import { SoundPanel } from './ui/sound';
import { GameAudio } from './audio';
import { Toast } from './ui/toast';

const TOTAL_QUESTIONS = JACKIE.questions.length + YAO.questions.length;

export class Game {
  readonly hud: Hud;
  readonly wordCard: WordCard;
  private dict = new Dictionary();
  private heights = new HeightPanel();
  private info: InfoPage;
  readonly credits = new CreditsPage();
  readonly audio = new GameAudio();
  private sound: SoundPanel;
  readonly toast = new Toast();

  constructor(readonly world: World) {
    this.wordCard = new WordCard(() => `${store.words.size} von ${WORDS.length} Wörtern`);
    this.info = new InfoPage(
      () => this.refresh(),
      () => {
        this.info.modal.close();
        this.credits.open();
      },
    );
    this.sound = new SoundPanel(() => this.onSoundChange());
    this.hud = createHud(world, {
      onWords: () => this.dict.open(),
      onInfo: () => this.info.open(),
      onToast: () => undefined,
      onSound: (a) => this.sound.toggle(a),
    });
    this.hud.setSoundIcon(store.settings.muted);
    world.onInsideChange = (inside) => this.audio.setInside(inside);
    if (store.asked.size === 0 && store.words.size === 0) {
      store.addWord('chaguan');
      store.addWord('qingjin');
    }
    store.subscribe(() => this.refresh());
    let calm = store.settings.calm;
    let quality = store.settings.quality;
    store.subscribe(() => {
      if (store.settings.calm !== calm) {
        calm = store.settings.calm;
        world.setCalm(calm);
      }
      if (store.settings.quality !== quality) {
        quality = store.settings.quality;
        if (quality !== 'auto') world.setQuality(quality);
      }
    });
    this.refresh();
  }

  refresh(): void {
    this.hud.setProgress(store.asked.size, TOTAL_QUESTIONS, store.words.size, WORDS.length);
    this.hud.setToastReady(false);
  }

  private onSoundChange(): void {
    this.audio.applySettings();
    this.hud.setSoundIcon(store.settings.muted);
  }

  openHeights(): void {
    this.heights.open();
  }
}
