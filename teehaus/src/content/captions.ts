// Untertitel für das Hintergrund-Gemurmel (Einstellung „Untertitel fürs Gemurmel“). Das Simlish hat keine
// Bedeutung; die Untertitel sagen nur, was gerade geschieht. Je Figur (id) eigene Sätze, sonst die allgemeinen.

export const MURMUR_GENERAL = [
  'murmelt leise vor sich hin',
  'erzählt etwas und lacht',
  'summt eine Melodie',
  'flüstert etwas über den Tee',
  'spricht über das Wetter in den Bergen',
];

export const MURMUR: Record<string, string[]> = {
  master: [
    'brummt zufrieden über den Duft des Tees',
    'zählt leise die Teedosen',
    'murmelt etwas über das Wasser',
  ],
  boardA: ['überlegt laut den nächsten Zug', 'murmelt: „Der Wagen ist in Gefahr …“'],
  boardB: ['lacht über den Zug des Gegners', 'flüstert eine Spielregel'],
  poet: ['sucht leise nach dem passenden Wort', 'liest einen Vers halblaut vor'],
  merchant: ['rechnet halblaut Preise zusammen', 'erzählt vom Markt im Tal'],
  child: ['kichert und ruft nach der Katze', 'zählt die Laternen'],
  terrace: ['seufzt über die schöne Aussicht', 'erzählt von früher'],
  wanderer: ['spricht über den langen Weg', 'fragt nach dem Pfad ins Tal'],
  visitor: ['bewundert leise die Hängerollen', 'flüstert: „Wie schön es hier ist …“'],
  jackie: ['erzählt leise eine Geschichte vom Dreh', 'lacht und klopft auf den Tisch'],
  yao: ['spricht ruhig über Basketball', 'lacht tief und leise'],
};

export function murmurCaption(id: string): string {
  const list = MURMUR[id] ?? MURMUR_GENERAL;
  return list[Math.floor(Math.random() * list.length)]!;
}
