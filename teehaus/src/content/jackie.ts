// Jackie Chan (成龙): humorvoll, bescheiden, bodenständig. Alle Antworten sind frei formulierte Ich-Texte
// auf Basis öffentlich bekannter Fakten (siehe facts.ts) – keine echten Zitate.
import type { FigureProfile } from './types';

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
      a: 'Ich bin 1954 in Hongkong geboren und hieß damals Chan Kong-sang, ungefähr „in Hongkong geboren“. Mein Vater arbeitete als Koch im Haus des französischen Konsuls, dort habe ich meine ersten Jahre verbracht. Als Baby war ich so rund, dass man mich Kanonenkugel nannte, 炮炮 Pàopao. Ha! Eine Kanonenkugel ohne Kanone.',
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
