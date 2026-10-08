// Alle Tatsachen, auf die sich die Antworten stützen – mit Quellen zum Gegenchecken.
// FAKTEN.md wird daraus erzeugt:  npm run facts
import type { Fact } from './types';

const WP = 'https://en.wikipedia.org/wiki/';

export const FACTS: Fact[] = [
  // ───────────── Jackie Chan
  {
    id: 'J-geburt',
    who: 'jackie',
    confidence: 'hoch',
    text: 'Geboren am 7. April 1954 in Hongkong (Victoria Peak) als Chan Kong-sang (≈ „in Hongkong geboren“).',
    src: [WP + 'Jackie_Chan'],
  },
  {
    id: 'J-vater-konsul',
    who: 'jackie',
    confidence: 'hoch',
    text: 'Der Vater arbeitete als Koch im Haus des französischen Konsuls auf dem Victoria Peak; dort verbrachte Jackie seine frühen Jahre.',
    src: [WP + 'Jackie_Chan'],
  },
  {
    id: 'J-paopao',
    who: 'jackie',
    confidence: 'hoch',
    text: 'Als Baby (ca. 5,4 kg) wurde er „Paopao“ 炮炮 („Kanonenkugel“) genannt.',
    src: [WP + 'Jackie_Chan'],
  },
  {
    id: 'J-schule',
    who: 'jackie',
    confidence: 'hoch',
    text: '1960/61 kam er an die China Drama Academy (Peking-Oper-Schule) von Meister Yu Jim-yuen; die Ausbildung dauerte etwa zehn Jahre und war sehr streng.',
    src: [WP + 'China_Drama_Academy', WP + 'Yu_Jim-yuen'],
    note: 'Eintrittsjahr schwankt je nach Quelle (1960 oder 1961), deshalb steht im Text „mit sechs oder sieben“.',
  },
  {
    id: 'J-siebenfortunes',
    who: 'jackie',
    confidence: 'hoch',
    text: 'Mitglied der Kindertruppe „Seven Little Fortunes“ (七小福) mit u. a. Sammo Hung und Yuen Biao.',
    src: [WP + 'China_Drama_Academy'],
  },
  {
    id: 'J-keaton',
    who: 'jackie',
    confidence: 'hoch',
    text: 'Jackie nennt Stummfilm-Komiker wie Buster Keaton und Harold Lloyd als Vorbilder; für „Project A“ übernahm er einen Stunt aus Keatons/Lloyds Tradition (Uhrturm-Szene).',
    src: [
      'https://faroutmagazine.co.uk/inspirations-jackie-chan-signature-style/',
      'https://www.oscars.org/events/academy-salute-jackie-chan',
    ],
  },
  {
    id: 'J-flop',
    who: 'jackie',
    confidence: 'hoch',
    text: 'Frühe Filme (u. a. „New Fist of Fury“, 1976) sollten ihn als „nächsten Bruce Lee“ vermarkten und waren Misserfolge.',
    src: [WP + 'Lo_Wei'],
  },
  {
    id: 'J-australien',
    who: 'jackie',
    confidence: 'mittel',
    text: 'Zeitweise lebte und arbeitete er in Australien (Canberra), auch auf einer Baustelle; dort entstand der Name „Jack“/„Jackie“.',
    src: ['https://www.chinadaily.com.cn/life/2016-08/07/content_26375983.htm'],
    note: 'Es gibt zwei Versionen der Namensgeschichte („Little Jack“ vs. eigener Bericht von 2016). Beide haben einen Kollegen namens Jack, darum bleibt der Text allgemein.',
  },
  {
    id: 'J-durchbruch78',
    who: 'jackie',
    confidence: 'hoch',
    text: '1978: „Snake in the Eagle’s Shadow“ und „Drunken Master“ (醉拳) unter Regisseur Yuen Woo-ping brachten den Durchbruch; 1979 folgte sein Regiedebüt „The Fearless Hyena“.',
    src: [WP + 'Snake_in_the_Eagle%27s_Shadow', WP + 'Lo_Wei'],
  },
  {
    id: 'J-hollywood',
    who: 'jackie',
    confidence: 'hoch',
    text: 'Frühe US-Versuche („Battle Creek Brawl“, „The Protector“) scheiterten; der Durchbruch im Westen kam mit „Rumble in the Bronx“ (HK 1995, USA 1996).',
    src: [WP + 'Rumble_in_the_Bronx'],
  },
  {
    id: 'J-rushhour',
    who: 'jackie',
    confidence: 'hoch',
    text: '„Rush Hour“ (18. September 1998, mit Chris Tucker) spielte weltweit über 240 Mio. US-Dollar ein.',
    src: ['https://www.the-numbers.com/movie/Rush-Hour'],
  },
  {
    id: 'J-armour',
    who: 'jackie',
    confidence: 'hoch',
    text: '1986 stürzte er beim Dreh von „Armour of God“ von einem Ast; Schädelbruch, Operation.',
    src: [WP + 'Armour_of_God_(film)'],
    note: 'Fallhöhe und weitere Folgen werden in Quellen unterschiedlich angegeben und stehen deshalb nicht im Text.',
  },
  {
    id: 'J-police',
    who: 'jackie',
    confidence: 'hoch',
    text: 'Beim Mall-Finale von „Police Story“ (1985) rutschte er an einem Mast voller Lampen hinab: Verbrennungen zweiten Grades, ausgekugeltes Becken, Rückenverletzung.',
    src: [WP + 'Police_Story_(1985_film)'],
  },
  {
    id: 'J-stunts',
    who: 'jackie',
    confidence: 'hoch',
    text: 'Jackie macht seine Stunts weitgehend selbst (sein Markenzeichen).',
    src: [WP + 'Jackie_Chan'],
  },
  {
    id: 'J-oscar',
    who: 'jackie',
    confidence: 'hoch',
    text: 'Ehren-Oscar (Governors Awards) am 12. November 2016. In der Rede scherzte er sinngemäß, er habe sich so viele Knochen gebrochen, jetzt gehöre ihm endlich einer; sein Vater habe früher gefragt, warum er keinen Oscar habe.',
    src: [
      'https://www.oscars.org/governors-awards/2016/jackie-chan',
      'https://entertainment.inquirer.net/?p=206550',
    ],
    note: 'Sinngemäß wiedergegeben, nicht als wörtliches Zitat.',
  },
  {
    id: 'J-stiftung',
    who: 'jackie',
    confidence: 'hoch',
    text: 'Jackie Chan Charitable Foundation seit 1988 (Stipendien für junge Menschen in Hongkong, Hilfe bei Katastrophen). Dragon’s Heart Foundation hilft Kindern und älteren Menschen in abgelegenen Gegenden Chinas (Gründungsjahr 2004/2005, Quellen uneinheitlich).',
    src: [
      'https://looktothestars.org/celebrity/jackie-chan',
      'https://hkapa.edu/honorary-awardee/fellow/jackie-chan-kong-sang',
    ],
  },
  {
    id: 'J-unicef',
    who: 'jackie',
    confidence: 'hoch',
    text: 'Seit 2004 UNICEF-Botschafter (gemeinsame Ernennung durch UNICEF und UNAIDS).',
    src: [
      'https://www.unicef.org/goodwill-ambassadors/jackie-chan',
      'https://www.unaids.org/en/resources/presscentre/pressreleaseandstatementarchive/2004/april/2004-04-26jackiechansignsonforunicefandunaids',
    ],
  },
  {
    id: 'J-panda',
    who: 'jackie',
    confidence: 'mittel',
    text: 'Jackie spricht Meister Affe (Monkey) in „Kung Fu Panda“ (2008) und den Fortsetzungen, auch in den chinesischen Fassungen.',
    src: ['https://dreamworks.fandom.com/wiki/Jackie_Chan'],
    note: 'Quelle ist ein Fan-Wiki; bitte mit dem offiziellen Abspann/IMDb gegenprüfen.',
  },
  {
    id: 'J-adventures',
    who: 'jackie',
    confidence: 'hoch',
    text: 'Die Zeichentrickserie „Jackie Chan Adventures“ lief von 2000 bis 2005.',
    src: [WP + 'Jackie_Chan_Adventures'],
  },
  {
    id: 'J-sprachen',
    who: 'jackie',
    confidence: 'mittel',
    text: 'Jackie spricht Kantonesisch, Mandarin und Englisch; sein Name 成龙 (Mandarin Chéng Lóng) klingt auf Kantonesisch anders.',
    src: [WP + 'Jackie_Chan'],
  },
  {
    id: 'J-groesse',
    who: 'jackie',
    confidence: 'mittel',
    text: 'Körpergröße meist mit ca. 173 cm (5′8″) angegeben; Angaben schwanken.',
    src: [WP + 'Jackie_Chan'],
    note: 'Wird nur als „ca.“ auf der Messlatte gezeigt.',
  },

  // ───────────── Yao Ming
  {
    id: 'Y-geburt',
    who: 'yao',
    confidence: 'hoch',
    text: 'Geboren am 12. September 1980 in Shanghai.',
    src: ['https://www.britannica.com/biography/Yao-Ming', WP + 'Yao_Ming'],
  },
  {
    id: 'Y-eltern',
    who: 'yao',
    confidence: 'hoch',
    text: 'Beide Eltern (Yao Zhiyuan und Fang Fengdi) waren Basketballspieler.',
    src: [WP + 'Yao_Ming'],
    note: 'In schwachen Quellen kursieren falsche Berufe; Wikipedia und mehrere Biografien nennen Basketball.',
  },
  {
    id: 'Y-groesse',
    who: 'yao',
    confidence: 'hoch',
    text: 'Körpergröße 2,29 m (7′6″).',
    src: ['https://www.britannica.com/biography/Yao-Ming', 'https://olympics.com/it/atleti/ming-yao'],
    note: 'Anfangs wurde er in einigen Berichten mit 7′5″ geführt.',
  },
  {
    id: 'Y-sharks',
    who: 'yao',
    confidence: 'hoch',
    text: 'Er spielte bei den Shanghai Sharks; in der Saison 2001/02 (seinem letzten Jahr dort) gewannen sie erstmals die chinesische Meisterschaft (CBA).',
    src: [WP + 'Yao_Ming'],
  },
  {
    id: 'Y-draft',
    who: 'yao',
    confidence: 'hoch',
    text: '2002 wurde er an Position 1 vom NBA-Draft von den Houston Rockets gewählt; alle seine NBA-Jahre spielte er in Houston.',
    src: [
      'https://www.thescore.com/nba/news/995215/the-most-memorable-moments-of-yao-mings-hall-of-fame-career',
      WP + 'Yao_Ming',
    ],
  },
  {
    id: 'Y-allstar',
    who: 'yao',
    confidence: 'hoch',
    text: 'Achtmal All-Star, zweimal All-NBA Second Team. Beim All-Star-Game 2003 stand er als Rookie per Fanwahl in der Startformation (vor Shaquille O’Neal).',
    src: ['https://irontontribune.com/?p=23776', WP + '2003_NBA_All-Star_Game'],
  },
  {
    id: 'Y-mcgrady',
    who: 'yao',
    confidence: 'hoch',
    text: 'Am 29. Juni 2004 wurde Tracy McGrady nach Houston getauscht und spielte fortan an Yaos Seite.',
    src: [
      WP + 'Tracy_McGrady',
      'https://www.thedartmouth.com/article/2004/07/mcgrady-trade-rockets-poised-for-title-run-in-2005',
    ],
  },
  {
    id: 'Y-fuss',
    who: 'yao',
    confidence: 'hoch',
    text: 'Wiederholte Verletzungen am (linken) Fuß: Stressfraktur 2008, im Mai 2009 Bruch in den Playoffs gegen die Lakers, Operation, die komplette Saison 2009/10 verpasst; 2010/11 nur fünf Spiele.',
    src: ['https://www.irontontribune.com/?p=6392', 'https://www.si.com/more-sports/2010/10/15/yao-rockets'],
  },
  {
    id: 'Y-ruecktritt',
    who: 'yao',
    confidence: 'hoch',
    text: 'Offizieller Rücktritt am 20. Juli 2011 in Shanghai im Alter von 30 Jahren, wegen einer Serie von Fuß- und Beinverletzungen.',
    src: [
      'https://www.nbcbayarea.com/news/sports/natl-injuries-force-china-basketball-legend-yao-ming-to-retire/2095543/',
      'https://english.ahram.org.eg/News/16864.aspx',
    ],
  },
  {
    id: 'Y-hof',
    who: 'yao',
    confidence: 'hoch',
    text: 'Im April 2016 in die Basketball Hall of Fame gewählt (u. a. mit Allen Iverson und Shaquille O’Neal); Rockets haben die Nummer 11 aus dem Verkehr gezogen; 2023 auch in die FIBA Hall of Fame aufgenommen.',
    src: [
      'https://nwasianweekly.com/2016/04/yao-ming-elected-into-hall-of-fame',
      'https://about.fiba.basketball/en/fiba-hall-of-fame/hall-of-famers/yao-ming',
    ],
  },
  {
    id: 'Y-fahne',
    who: 'yao',
    confidence: 'hoch',
    text: 'Fahnenträger Chinas bei der Eröffnungsfeier 2004 (Athen) und 2008 (Peking); 2008 zog er mit dem neunjährigen Lin Hao ein, einem Überlebenden des Erdbebens von Sichuan.',
    src: [
      'https://www.nbcnews.com/id/wbna26079138',
      'https://language.chinadaily.com.cn/news/2008-08/07/content_6915653.htm',
    ],
  },
  {
    id: 'Y-stiftung',
    who: 'yao',
    confidence: 'hoch',
    text: '2008 nach dem Erdbeben von Sichuan gründete Yao die Yao Foundation (anfangs Wiederaufbau erdbebensicherer Schulen, 2 Mio. US-Dollar aus eigener Tasche), später Bildung, Sport und Gesundheit für Kinder (Hope-Grundschulen, Basketballprogramm seit 2012, jährliches Charity Game).',
    src: [
      'https://www.nba.com/rockets/news/yao_foundation_080610.html',
      'https://looktothestars.org/charity/yao-ming-foundation',
    ],
    note: 'Gründungsjahr in einigen Quellen 2007; mehrheitlich 2008 genannt.',
  },
  {
    id: 'Y-wildaid',
    who: 'yao',
    confidence: 'hoch',
    text: 'Seit 2006 WildAid-Botschafter (Verzicht auf Haifischflossensuppe, Kampagne „I’m FINished with Fins“, an der auch Jackie Chan beteiligt war); 2013 „Say No to Ivory“ / „Say No to Rhino Horn“; 2014 Dokumentarfilm über seine Afrika-Reise („The End of the Wild“).',
    src: [
      'https://wildaid.org/ambassadors/yao-ming/',
      'https://www.nbcnews.com/news/china/ex-nba-star-yao-ming-aims-wean-china-ivory-shark-n177496',
    ],
  },
  {
    id: 'Y-cba',
    who: 'yao',
    confidence: 'hoch',
    text: 'Von Februar 2017 bis Oktober 2024 Präsident des Chinesischen Basketballverbands (CBA); Besitzer der Shanghai Sharks.',
    src: [
      WP + 'Yao_Ming',
      'https://foxnews.com/sports/yao-ming-stays-busy-in-retirement-with-college-winemaking-and-owning-the-shanghai-sharks.amp',
    ],
    note: 'Aktuelle Ämter ändern sich – Text nennt nur die Zeitspanne 2017–2024.',
  },
  {
    id: 'Y-wein',
    who: 'yao',
    confidence: 'hoch',
    text: 'Yao Family Wines (Napa Valley, Kalifornien); erster Wein: Cabernet Sauvignon, Jahrgang 2009; Markenanmeldung 2011.',
    src: [
      'https://www.scmp.com/article/985755/basketball-star-brings-american-wine-china',
      'https://www.texasmonthly.com/food/yao-ming-dabbles-in-viticulture/',
    ],
  },
  {
    id: 'Y-doku',
    who: 'yao',
    confidence: 'hoch',
    text: 'Der Dokumentarfilm „The Year of the Yao“ (2004) begleitet sein erstes NBA-Jahr.',
    src: [WP + 'Yao_Ming'],
  },

  // ───────────── Sprache / beide
  {
    id: 'B-namen',
    who: 'beide',
    confidence: 'hoch',
    text: '成 chéng = werden, vollenden; 龙 lóng = Drache. 姚 Yáo ist ein Familienname; 明 míng = hell, klar (auch in „Ming-Dynastie“ 明朝 Míngcháo).',
    src: ['https://www.mdbg.net/chinese/dictionary'],
    note: 'Zeichenbedeutungen im Wörterbuch (MDBG/Pleco) prüfen. Die Deutung des Künstlernamens als „zum Drachen werden“ steht nirgends im Text.',
  },
  {
    id: 'B-2016',
    who: 'beide',
    confidence: 'hoch',
    text: '2016: Jackie erhielt den Ehren-Oscar, Yao wurde in die Basketball Hall of Fame gewählt.',
    src: [
      'https://www.oscars.org/governors-awards/2016/jackie-chan',
      'https://nwasianweekly.com/2016/04/yao-ming-elected-into-hall-of-fame',
    ],
  },
];

export const factById = (id: string): Fact | undefined => FACTS.find((f) => f.id === id);
