// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
//  ALLE GESPRÄCHE DES TEEHAUSES IN EINER DATEI
//
//  • Jackie Chan (成龙) und Yao Ming (姚明): feste Fragen und Antworten in 8 Kategorien, Zwischenrufe (banter),
//    Lernwörter (word) und Verweise auf die geprüften Fakten (facts → src/content/facts.ts → FAKTEN.md).
//  • Charakterkarten (nur belegbare Angaben).
//  • Kurze Sprüche des Teemeisters und der Gäste.
//
//  Regeln: nur gut belegte, öffentlich bekannte Fakten; keine erfundenen Zitate, Details oder Zahlen; im Zweifel
//  weglassen; nichts zu Privatleben, Gesundheit, Skandalen oder Politik. Antworten 2–4 Sätze, Ich-Form, Deutsch.
//  Jackie: warm, humorvoll, bescheiden. Yao: ruhig, nachdenklich, trocken-witzig.
//  Nach Änderungen: npm run check:content (prüft Fakten, Wörter, Freischaltungen) und npm run facts.
// ═══════════════════════════════════════════════════════════════════════════════════════════════════════
import type { FigureId, FigureProfile } from './types';

/** Antwort auf „Etwas anderes fragen“ */
export const FALLBACK = 'Darauf kann ich nicht antworten. Wähle eine der Fragen.';

/** Hinweis beim ersten Gespräch (auch auf Startseite und Info-Seite) */
export const DISCLAIMER =
  'Fiktives Gespräch, basiert auf öffentlich bekannten Fakten. Keine echten Zitate. Nicht mit den dargestellten Personen verbunden.';

export interface CardField {
  label: string;
  value: string;
  /** Fakten-IDs zum Gegenprüfen */
  facts: string[];
}

/** Charakterkarten: nur belegte Angaben, keine erfundenen „Werte“ */
export const CARDS: Record<FigureId, CardField[]> = {
  jackie: [
    { label: 'Beruf', value: 'Schauspieler, Stuntman und Regisseur', facts: ['J-stunts', 'J-durchbruch78'] },
    { label: 'Größe', value: 'ca. 1,73 m (Angaben schwanken)', facts: ['J-groesse'] },
    { label: 'Herkunft', value: 'Hongkong, geboren 1954', facts: ['J-geburt'] },
    {
      label: 'Bekannt für',
      value: 'Kung-Fu-Komödien mit selbst gedrehten Stunts',
      facts: ['J-stunts', 'J-rushhour'],
    },
  ],
  yao: [
    {
      label: 'Beruf',
      value: 'ehemaliger Basketballspieler (NBA, Houston Rockets)',
      facts: ['Y-draft', 'Y-ruecktritt'],
    },
    { label: 'Größe', value: '2,29 m', facts: ['Y-groesse'] },
    { label: 'Herkunft', value: 'Shanghai, geboren 1980', facts: ['Y-geburt'] },
    {
      label: 'Bekannt für',
      value: 'Nr. 1 im NBA-Draft 2002, Basketball Hall of Fame 2016',
      facts: ['Y-draft', 'Y-hof'],
    },
  ],
};

// ───────────────────────────────────────── Jackie Chan
export const JACKIE: FigureProfile = {
  id: 'jackie',
  zh: '成龙',
  py: 'cheng2 long2',
  nameDe: 'Jackie Chan',
  parts: [
    ['成', 'werden, vollenden'],
    ['龙', 'Drache'],
  ],
  greetings: [
    'Willkommen! Setz dich, der Tee ist frisch. Frag mich, was du willst.',
    'Ah, ein neuer Gast! Keine Sorge, ich beiße nicht. Ich trete höchstens.',
    'Schön, dass du da bist. Nimm eine Tasse und frag drauflos!',
  ],
  idle: [
    'Der Tee wird kalt, ha! Frag mich etwas.',
    'Mein Kollege hier redet nicht viel. Ich dafür umso mehr.',
    'Keine Angst vor Fragen. Mit den schlimmsten kenne ich mich aus.',
  ],
  questions: [
    // ── Kindheit
    {
      id: 'j-kindheit-1',
      cat: 'kindheit',
      q: 'Wie war deine Kindheit in Hongkong?',
      a: 'Ich bin 1954 in Hongkong geboren und hieß damals Chan Kong-sang, ungefähr „in Hongkong geboren“. Mein Vater arbeitete als Koch im Haus des französischen Konsuls, dort habe ich meine ersten Jahre verbracht. Als Baby war ich so rund, dass man mich Kanonenkugel nannte, 炮炮 Pàopao – eine Kanonenkugel ohne Kanone, ha!',
      word: 'xianggang',
      mood: 'laugh',
      banter: { by: 'yao', text: 'Kanonenkugel? Ich war eher die Kanone.' },
      facts: ['J-geburt', 'J-vater-konsul', 'J-paopao'],
    },
    {
      id: 'j-kindheit-2',
      cat: 'kindheit',
      q: 'Wie war die Schule der Peking-Oper?',
      a: 'Mit sechs oder sieben Jahren kam ich an die China Drama Academy, eine Schule der Peking-Oper. Dort lernte ich Akrobatik, Singen, Schauspiel und Kampfkunst, rund zehn Jahre lang, und die Disziplin war hart. Mein Meister hieß Yu Jim-yuen. Mit Mitschülern wie Sammo Hung und Yuen Biao stand ich schon als Kind auf der Bühne.',
      word: 'jingju',
      needs: 'j-kindheit-1',
      mood: 'nod',
      banter: { by: 'yao', text: 'Akrobatik bei meiner Größe? Die Bühnendecke hätte Beulen bekommen.' },
      facts: ['J-schule', 'J-siebenfortunes'],
    },

    // ── Persönlichkeit
    {
      id: 'j-person-1',
      cat: 'persoenlichkeit',
      q: 'Wie würdest du dich selbst beschreiben?',
      a: 'Ich bin ein ganz normaler Kerl, der hart arbeitet und gern lacht. Ein Superheld bin ich nicht, und ehrlich gesagt tut es oft weh, wenn ich so tue als ob. Respekt vor meinen Lehrern und Disziplin habe ich in der Schule gelernt, und das begleitet mich bis heute.',
      word: 'qianxu',
      mood: 'nod',
      facts: [],
    },
    {
      id: 'j-person-2',
      cat: 'persoenlichkeit',
      q: 'Warum steckt in deinen Kämpfen so viel Humor?',
      a: 'Ich wollte nie einfach ein zweiter Bruce Lee sein. Mein Vorbild waren Stummfilm-Komiker wie Buster Keaton und Harold Lloyd, mit Leitern, Stühlen und viel Timing. Wenn ein Kampf nicht nur gefährlich aussieht, sondern auch witzig, lachen die Leute, und das macht mich glücklicher als jeder Schlag.',
      word: 'youmo',
      needs: 'j-person-1',
      mood: 'laugh',
      banter: {
        by: 'yao',
        text: 'Bei mir lacht das Publikum höchstens, wenn ich unter der Laterne durchgehe.',
      },
      facts: ['J-keaton'],
    },

    // ── Rückschläge
    {
      id: 'j-rueck-1',
      cat: 'rueckschlaege',
      q: 'Was war dein größter Rückschlag?',
      a: 'Am Anfang wollte man mich zum nächsten Bruce Lee machen, und meine ersten Filme floppten. Nach den ersten Misserfolgen zog es mich zeitweise nach Australien, wo ich sogar auf dem Bau gearbeitet habe. Zurück in Hongkong habe ich begriffen: Ich muss niemand anderes sein, ich brauche meinen eigenen Stil.',
      word: 'shibai',
      mood: 'think',
      banter: {
        by: 'yao',
        text: 'Allein der Flug nach Australien wäre für mich ein Beinfreiheits-Problem gewesen.',
      },
      facts: ['J-flop', 'J-australien'],
    },
    {
      id: 'j-rueck-2',
      cat: 'rueckschlaege',
      q: 'Du hast dich oft verletzt. Warum machst du weiter?',
      a: 'Ja, ich habe mir über die Jahre viele Knochen gebrochen. 1986 bin ich bei Armour of God von einem Baum gestürzt und musste am Kopf operiert werden. Bei Police Story habe ich mir an einem Mast voller Lampen Verbrennungen und eine ausgekugelte Hüfte geholt. Meine Stunts mache ich trotzdem meistens selbst, das gehört zu mir.',
      word: 'gutou',
      needs: 'j-rueck-1',
      mood: 'think',
      banter: {
        by: 'yao',
        text: 'Respekt. Mein Körper hat auch einiges abbekommen, bei mir waren es die Füße.',
      },
      facts: ['J-armour', 'J-police', 'J-stunts'],
    },

    // ── Karriere
    {
      id: 'j-karriere-1',
      cat: 'karriere',
      q: 'Wie kam dein Durchbruch?',
      a: '1978 habe ich mit Regisseur Yuen Woo-ping zwei Filme gedreht: Snake in the Eagle’s Shadow und Drunken Master, auf Chinesisch 醉拳, die Trunkene Faust. Dort durfte ich Kung-Fu mit Komödie mischen, und plötzlich mochte mich das Publikum. Danach habe ich selbst Regie geführt und meine eigenen Ideen ausprobiert.',
      word: 'zuiquan',
      mood: 'laugh',
      facts: ['J-durchbruch78'],
    },
    {
      id: 'j-karriere-2',
      cat: 'karriere',
      q: 'Wie war dein Weg nach Hollywood?',
      a: 'Holprig! Meine ersten Versuche im Westen in den Achtzigern klappten nicht. Erst mit Rumble in the Bronx Mitte der Neunziger wurde ich in Amerika bekannt, und 1998 kam Rush Hour mit Chris Tucker, das weltweit über 240 Millionen Dollar eingespielt hat. Ich habe gelernt: Humor funktioniert in jeder Sprache.',
      word: 'haolaiwu',
      needs: 'j-karriere-1',
      mood: 'nod',
      banter: {
        by: 'yao',
        text: 'Ich bin auch in den Westen gegangen, nach Houston. Erst die Sprache, dann das Spiel.',
      },
      facts: ['J-hollywood', 'J-rushhour'],
    },
    {
      id: 'j-karriere-3',
      cat: 'karriere',
      q: 'Was bedeutete dir der Ehren-Oscar?',
      a: '2016 habe ich einen Ehren-Oscar für mein Lebenswerk bekommen. In meiner Rede habe ich gescherzt, dass ich mir so viele Knochen gebrochen habe und jetzt endlich einer mir gehört. Und ich habe erzählt, dass mein Vater mich früher immer gefragt hat, warum ich keinen Oscar habe. Jetzt kann ich ihm antworten!',
      word: 'aosika',
      needs: 'j-karriere-2',
      mood: 'laugh',
      banter: { by: 'yao', text: '2016 war auch mein Jahr: die Hall of Fame. Wir sind quitt.' },
      facts: ['J-oscar', 'B-2016'],
    },

    // ── Werte
    {
      id: 'j-werte-1',
      cat: 'werte',
      q: 'Was ist dir im Leben wichtig?',
      a: 'Fleiß, Respekt und Dankbarkeit. In der Opernschule habe ich gelernt: Wer sich nicht anstrengt, kommt nicht weit. Und ich bin allen dankbar, die mir geholfen haben, meinen Lehrern, meinen Freunden und meinem Team.',
      word: 'nuli',
      mood: 'nod',
      banter: { by: 'yao', text: 'Bei mir heißt das: Geduld und Mannschaft.' },
      facts: [],
    },

    // ── Engagement
    {
      id: 'j-engage-1',
      cat: 'engagement',
      q: 'Warum engagierst du dich für andere?',
      a: 'Schon 1988 habe ich in Hongkong meine Stiftung gegründet, die junge Menschen mit Stipendien unterstützt und bei Katastrophen hilft. Später kam die Dragon’s Heart Foundation dazu, die Kindern und älteren Menschen in abgelegenen Gegenden Chinas hilft. Und seit 2004 bin ich UNICEF-Botschafter. Wer Glück hatte, sollte etwas zurückgeben.',
      word: 'bangzhu',
      mood: 'nod',
      banter: { by: 'yao', text: 'Respekt. Kindern zu helfen ist die beste Sache.' },
      facts: ['J-stiftung', 'J-unicef'],
    },

    // ── Bezug zu China
    {
      id: 'j-china-1',
      cat: 'china',
      q: 'Was bedeutet dir deine Heimat Hongkong?',
      a: 'Hongkong ist meine Heimat. Hier bin ich geboren, hier habe ich Kung-Fu und Bühne gelernt. Ich spreche Kantonesisch, 广东话, und Mandarin, und mein Name 成龙, auf Mandarin Chéng Lóng, klingt auf Kantonesisch ganz anders. Die Peking-Oper ist ein Stück chinesischer Kultur, das mich bis heute prägt.',
      word: 'guangdonghua',
      mood: 'nod',
      facts: ['J-sprachen', 'J-geburt'],
    },

    // ── Fun Facts
    {
      id: 'j-fun-1',
      cat: 'fun',
      q: 'Wie bist du zu deinem Namen „Jackie“ gekommen?',
      a: 'Das war in Australien, auf einer Baustelle: Dort gab es einen Kollegen namens Jack, und bald nannten mich alle Jackie. Mein chinesischer Name 成龙 besteht aus 成, werden, und 龙, Drache. Ein Drache auf der Baustelle, ha! Das sah bestimmt komisch aus.',
      word: 'long',
      mood: 'laugh',
      banter: { by: 'yao', text: 'Und ich? Bei mir sagen alle nur „Yao“. Und „Ist es kalt da oben?“' },
      facts: ['J-australien', 'B-namen'],
    },
    {
      id: 'j-fun-2',
      cat: 'fun',
      q: 'Du bist die Stimme von Meister Affe. Wie war das?',
      a: 'In Kung Fu Panda leihe ich Meister Affe meine Stimme, in der chinesischen Fassung übrigens auch. Es ist lustig, Kung-Fu nur mit der Stimme zu machen, ohne Knochenbrüche! Außerdem gab es früher sogar eine Zeichentrickserie mit mir als Hauptfigur: Jackie Chan Adventures.',
      word: 'xiongmao',
      needs: 'j-fun-1',
      mood: 'laugh',
      banter: { by: 'yao', text: 'Ich wäre als Panda wohl ziemlich groß geraten.' },
      facts: ['J-panda', 'J-adventures'],
    },
  ],
};

// ───────────────────────────────────────── Yao Ming
export const YAO: FigureProfile = {
  id: 'yao',
  zh: '姚明',
  py: 'yao2 ming2',
  nameDe: 'Yao Ming',
  parts: [
    ['姚', 'Familienname'],
    ['明', 'hell, klar'],
  ],
  greetings: [
    'Guten Tag. Ich würde aufstehen, aber dann stoße ich an den Balken.',
    'Setz dich. Der Tee ist gut, die Aussicht auch. Frag ruhig.',
    'Willkommen. Ich höre gern zu, und ich antworte gern in Ruhe.',
  ],
  idle: [
    'Keine Eile. Guter Tee braucht Zeit, gute Fragen auch.',
    'Mein Nachbar redet gern. Ich genieße die Pause.',
    'Du darfst mich ruhig etwas fragen. Ich beiße nicht, ich bücke mich höchstens.',
  ],
  questions: [
    // ── Kindheit
    {
      id: 'y-kindheit-1',
      cat: 'kindheit',
      q: 'Wie bist du in Shanghai aufgewachsen?',
      a: 'Ich bin 1980 in Shanghai geboren, als Sohn von zwei früheren Basketballspielern. Basketball lag also in der Familie, und ich war schon als Kind größer als alle anderen. Schulbänke fand ich damals schon ein bisschen knapp.',
      word: 'shanghai',
      mood: 'nod',
      banter: { by: 'jackie', text: 'Hongkong und Shanghai, zwei Hafenstädte. Das verbindet uns!' },
      facts: ['Y-geburt', 'Y-eltern'],
    },
    {
      id: 'y-kindheit-2',
      cat: 'kindheit',
      q: 'Wie hast du mit dem Basketball angefangen?',
      a: 'Ich habe als Kind in Shanghai trainiert und später bei den Shanghai Sharks in der chinesischen Liga gespielt. In der Saison 2001/02, meinem letzten Jahr dort, haben wir zum ersten Mal die chinesische Meisterschaft gewonnen. Danach ging es nach Amerika.',
      word: 'lanqiu',
      needs: 'y-kindheit-1',
      mood: 'nod',
      facts: ['Y-sharks'],
    },

    // ── Persönlichkeit
    {
      id: 'y-person-1',
      cat: 'persoenlichkeit',
      q: 'Wie würdest du dich beschreiben?',
      a: 'Eher ruhig. Ich überlege lieber einmal mehr, bevor ich etwas sage. Meine Größe sorgt dafür, dass ich ohnehin auffalle, da ist es ganz gut, wenn der Rest von mir leise bleibt.',
      word: 'anjing',
      mood: 'think',
      banter: { by: 'jackie', text: 'Ruhig? Du hast heute schon dreimal den Balken gestreift!' },
      facts: [],
    },
    {
      id: 'y-person-2',
      cat: 'persoenlichkeit',
      q: 'Wie gehst du damit um, überall aufzufallen?',
      a: 'Ich bin 2,29 Meter groß, das sieht man eben. Ich habe gelernt, es gelassen zu nehmen und bei Gelegenheit selbst darüber zu lachen. Türen, Betten, Autos: Ich plane inzwischen immer ein paar Zentimeter mehr ein.',
      word: 'gao',
      needs: 'y-person-1',
      mood: 'laugh',
      banter: { by: 'jackie', text: 'Und ich plane immer ein paar Zentimeter weniger. Wir passen zusammen!' },
      facts: ['Y-groesse'],
    },

    // ── Rückschläge
    {
      id: 'y-rueck-1',
      cat: 'rueckschlaege',
      q: 'Wie endete deine Karriere?',
      a: 'Mein Körper hat nicht mehr mitgemacht. Ich hatte wiederholt Verletzungen am Fuß, 2009 in den Playoffs gegen die Lakers, und danach habe ich eine ganze Saison verpasst. 2011 habe ich in Shanghai meinen Rücktritt erklärt, mit 30 Jahren. Das war schwer, aber ich habe gelernt: Danach gibt es noch viel anderes.',
      word: 'tuiyi',
      mood: 'think',
      banter: {
        by: 'jackie',
        text: 'Ich weiß, wie sich Verletzungen anfühlen. Respekt, dass du so lange durchgehalten hast.',
      },
      facts: ['Y-fuss', 'Y-ruecktritt'],
    },
    {
      id: 'y-rueck-2',
      cat: 'rueckschlaege',
      q: 'War der Anfang in Amerika schwer?',
      a: 'Neue Stadt, neue Sprache, anderes Spiel: Das war viel auf einmal. Ich musste Englisch lernen und mich an einen ganz anderen Alltag gewöhnen. Das Beste, was ich tun konnte: zuhören, nachfragen und nicht gleich alles perfekt machen wollen.',
      word: 'xuexi',
      needs: 'y-rueck-1',
      mood: 'think',
      banter: { by: 'jackie', text: 'Eine Sprache lernt man am besten mit Lachen.' },
      facts: [],
    },

    // ── Karriere
    {
      id: 'y-karriere-1',
      cat: 'karriere',
      q: 'Wie kam es zur NBA?',
      a: '2002 haben mich die Houston Rockets an erster Stelle im Draft gewählt. Alle meine Jahre in der NBA habe ich in Houston verbracht. Und ich wurde achtmal zum All-Star gewählt, darauf bin ich ein wenig stolz.',
      word: 'xuanxiu',
      mood: 'nod',
      facts: ['Y-draft', 'Y-allstar'],
    },
    {
      id: 'y-karriere-2',
      cat: 'karriere',
      q: 'Was war einer deiner schönsten Momente?',
      a: 'Mein erstes All-Star-Spiel 2003: Die Fans haben mich als Rookie in die Startformation gewählt, sogar vor Shaquille O’Neal. Das hat mich sehr berührt. Und ab 2004 hatte ich Tracy McGrady an meiner Seite, ein starkes Duo.',
      word: 'quanmingxing',
      needs: 'y-karriere-1',
      mood: 'laugh',
      facts: ['Y-allstar', 'Y-mcgrady'],
    },
    {
      id: 'y-karriere-3',
      cat: 'karriere',
      q: 'Was bedeutet dir die Hall of Fame?',
      a: '2016 wurde ich in die Basketball Hall of Fame gewählt, zusammen mit Allen Iverson und Shaquille O’Neal. Für einen Jungen aus Shanghai ist das eine große Ehre. Und die Rockets haben meine Nummer 11 nicht mehr vergeben.',
      word: 'mingrentang',
      needs: 'y-karriere-2',
      mood: 'nod',
      banter: { by: 'jackie', text: '2016 war auch mein Oscar-Jahr. Wir sind quitt!' },
      facts: ['Y-hof', 'B-2016'],
    },

    // ── Werte
    {
      id: 'y-werte-1',
      cat: 'werte',
      q: 'Was ist dir als Sportler wichtig?',
      a: 'Die Mannschaft. Ein Spiel gewinnt man nie allein, auch wenn man groß ist. Geduld und Respekt vor den Mitspielern, dem Gegner und dem Publikum sind mir wichtig.',
      word: 'tuandui',
      mood: 'nod',
      facts: [],
    },

    // ── Engagement
    {
      id: 'y-engage-1',
      cat: 'engagement',
      q: 'Wofür setzt du dich ein?',
      a: 'Nach dem Erdbeben in Sichuan 2008 habe ich die Yao Foundation gegründet, die zuerst beim Bau von Schulen geholfen hat. Später ging es um Bildung, Sport und Gesundheit für Kinder. Außerdem bin ich seit 2006 Botschafter von WildAid, gegen Haifischflossensuppe und für Elefanten und Nashörner.',
      word: 'baohu',
      mood: 'nod',
      banter: {
        by: 'jackie',
        text: 'Bei der Kampagne gegen Haifischflossen waren wir sogar zusammen dabei!',
      },
      facts: ['Y-stiftung', 'Y-wildaid'],
    },

    // ── Bezug zu China
    {
      id: 'y-china-1',
      cat: 'china',
      q: 'Was bedeutet dir China?',
      a: 'Bei den Olympischen Spielen 2004 und 2008 durfte ich die Fahne meines Landes tragen. 2008 in Peking bin ich mit Lin Hao ins Stadion eingezogen, einem neunjährigen Überlebenden des Erdbebens von Sichuan. Von 2017 bis 2024 war ich Präsident des chinesischen Basketballverbands, und der Club Shanghai Sharks gehört mir.',
      word: 'guoqi',
      mood: 'nod',
      facts: ['Y-fahne', 'Y-cba'],
    },

    // ── Fun Facts
    {
      id: 'y-fun-1',
      cat: 'fun',
      q: 'Was weiß kaum jemand über dich?',
      a: 'Ich habe ein Weingut. Yao Family Wines sitzt im Napa Valley in Kalifornien, mein erster Wein war ein Cabernet Sauvignon, Jahrgang 2009. Es ist ein ruhiges Hobby, das zu mir passt: Wein braucht Geduld.',
      word: 'putaojiu',
      mood: 'laugh',
      banter: { by: 'jackie', text: 'Prost darauf! Ich bleibe lieber beim Tee.' },
      facts: ['Y-wein'],
    },
    {
      id: 'y-fun-2',
      cat: 'fun',
      q: 'Über dein erstes NBA-Jahr gibt es einen Film?',
      a: 'Ja, „The Year of the Yao“ begleitet mein erstes Jahr in der NBA. Ehrlich gesagt war es seltsam, die ganze Zeit eine Kamera dabei zu haben. Aber ich bin froh, dass dieses erste Jahr festgehalten wurde.',
      word: 'jilupian',
      needs: 'y-fun-1',
      mood: 'think',
      facts: ['Y-doku'],
    },
  ],
};

// ───────────────────────────────────────── Teemeister und Gäste
export interface NpcLine {
  text: string;
  /** Lernwort (id aus words.ts) */
  word?: string;
}

export interface NpcProfile {
  id: string;
  /** Anzeigename (Deutsch) und Rolle */
  name: string;
  zh: string;
  py: string;
  /** Sprüche beim Ansprechen, der Reihe nach */
  lines: NpcLine[];
  /** Kurze Reaktion, wenn der Spieler winkt */
  wave?: string;
}

export const NPCS: Record<string, NpcProfile> = {
  master: {
    id: 'master',
    name: 'Teemeister',
    zh: '茶师',
    py: 'cha2shi1',
    lines: [
      { text: '欢迎光临! Herzlich willkommen in meinem Teehaus.', word: 'huanying' },
      { text: 'Guter Tee braucht Geduld. Und heißes, aber nicht kochendes Wasser.' },
      { text: 'Möchtest du Tee? Komm an die Theke, dann schenke ich dir ein.', word: 'qinghecha' },
      { text: 'Man nennt mich hier einfach 师傅 shīfu. Das ist eine höfliche Anrede.', word: 'shifu' },
    ],
    wave: 'Eine kleine Verbeugung zurück.',
  },
  boardA: {
    id: 'boardA',
    name: 'Schachspieler',
    zh: '棋手',
    py: 'qi2shou3',
    lines: [
      { text: 'Pssst, ich denke nach. Das ist 象棋 xiàngqí, chinesisches Schach.', word: 'xiangqi' },
      { text: 'Der Fluss in der Mitte heißt 楚河汉界. Bis dahin darf mein Elefant.' },
      { text: 'Noch drei Züge, dann habe ich ihn. Vielleicht. Hoffentlich.' },
    ],
  },
  boardB: {
    id: 'boardB',
    name: 'Schachspielerin',
    zh: '棋手',
    py: 'qi2shou3',
    lines: [
      { text: '你好! Er überlegt schon seit zehn Minuten.', word: 'nihao' },
      { text: 'Beim Schach und beim Tee gilt dasselbe: nicht hetzen.' },
    ],
  },
  poet: {
    id: 'poet',
    name: 'Dichterin',
    zh: '诗人',
    py: 'shi1ren2',
    lines: [
      { text: 'Ich schreibe ein 诗 shī, ein Gedicht, über die Berge im Nebel.', word: 'shi' },
      { text: 'Mit dem 毛笔 máobǐ schreibt man langsam. Das ist das Schöne daran.', word: 'maobi' },
      { text: '山 shān, Berg. Drei Striche nach oben, wie drei Gipfel.', word: 'shan' },
    ],
  },
  merchant: {
    id: 'merchant',
    name: 'Händler',
    zh: '商人',
    py: 'shang1ren2',
    lines: [
      { text: 'Puh, warm heute! Zum Glück habe ich meinen 扇子 shànzi, meinen Fächer.', word: 'shanzi' },
      { text: 'Ich handle mit Tee aus den Bergen. Aber hier trinke ich ihn nur.' },
      { text: 'Ein guter Handel ist wie guter Tee: Beide Seiten gehen zufrieden.' },
    ],
  },
  child: {
    id: 'child',
    name: 'Kind',
    zh: '小朋友',
    py: 'xiao3peng2you3',
    lines: [
      { text: '你好! Hast du die Katze schon gesehen? Sie heißt Mantou.', word: 'nihao' },
      { text: 'Ich darf heute Tee probieren. Aber nur einen ganz kleinen Schluck!' },
      { text: 'Fang mich doch! Haha!' },
    ],
  },
  wanderer: {
    id: 'wanderer',
    name: 'Wanderer',
    zh: '旅人',
    py: 'lv3ren2',
    lines: [
      { text: 'Ich bin über die Brücke gekommen. Der Weg durch den Bambus ist wunderschön.' },
      { text: 'Nach dem Aufstieg schmeckt der Tee doppelt so gut.', word: 'cha' },
    ],
  },
  visitor: {
    id: 'visitor',
    name: 'Besucherin',
    zh: '客人',
    py: 'ke4ren2',
    lines: [
      { text: 'Hast du die Schriftrolle gesehen? Die Pinselstriche sind so ruhig.' },
      { text: 'Ich komme jede Woche her. Hier wird man ganz still.' },
    ],
  },
  terrace: {
    id: 'terrace',
    name: 'Gast auf der Terrasse',
    zh: '客人',
    py: 'ke4ren2',
    lines: [
      { text: 'Von hier sieht man die Berge am schönsten. Besonders am Abend.', word: 'shan' },
      { text: 'Bevor du gehst, sag 再见 zàijiàn, auf Wiedersehen.', word: 'zaijian' },
    ],
  },
};

/** Was der Teemeister beim Einschenken sagt */
export const TEA_LINES: NpcLine[] = [
  { text: '请喝茶 qǐng hē chá, bitte trink. Grüner Tee aus den Bergen.', word: 'qinghecha' },
  { text: 'Noch eine Tasse? Gern. Langsam trinken, dann schmeckt man mehr.' },
  { text: 'Dieser Oolong ist etwas kräftiger. Zum Wohl!' },
];
