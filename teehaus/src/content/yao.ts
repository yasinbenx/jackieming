// Yao Ming (姚明): ruhig, nachdenklich, trocken-witzig. Alle Antworten sind frei formulierte Ich-Texte
// auf Basis öffentlich bekannter Fakten (siehe facts.ts) – keine echten Zitate.
import type { FigureProfile } from './types';

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
