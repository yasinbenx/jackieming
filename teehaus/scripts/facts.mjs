// Prüft die Inhalte und erzeugt FAKTEN.md aus src/content/facts.ts.
//   npm run facts           → FAKTEN.md neu schreiben
//   npm run facts -- --check → nur prüfen (Verweise, Länge der Antworten, Wörter)
// Benötigt Node ≥ 22.18 (führt .ts-Dateien ohne Build aus).
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (p) => import(join(root, 'src/content', p));
const { FACTS } = await load('facts.ts');
const { JACKIE } = await load('jackie.ts');
const { YAO } = await load('yao.ts');
const { WORDS } = await load('words.ts');
const { QUIZ } = await load('quiz.ts');
const { EGGS } = await load('extras.ts');

const profiles = [JACKIE, YAO];
const factIds = new Set(FACTS.map((f) => f.id));
const wordIds = new Set(WORDS.map((w) => w.id));
const problems = [];
const used = new Set();

for (const p of profiles) {
  const ids = new Set(p.questions.map((q) => q.id));
  if (p.questions.length < 12 || p.questions.length > 16)
    problems.push(`${p.id}: ${p.questions.length} Fragen (Ziel 12–16)`);
  for (const q of p.questions) {
    for (const f of q.facts ?? []) {
      used.add(f);
      if (!factIds.has(f)) problems.push(`${q.id}: unbekannter Fakt ${f}`);
    }
    if (q.word && !wordIds.has(q.word)) problems.push(`${q.id}: unbekanntes Wort ${q.word}`);
    if (q.needs && !ids.has(q.needs)) problems.push(`${q.id}: needs ${q.needs} existiert nicht`);
    const sentences = q.a.split(/(?<=[.!?])\s+/).filter(Boolean).length;
    if (sentences < 2 || sentences > 5) problems.push(`${q.id}: ${sentences} Sätze (Ziel 2–4)`);
  }
}
for (const e of EGGS) {
  if (!wordIds.has(e.word)) problems.push(`Ei ${e.id}: unbekanntes Wort ${e.word}`);
  for (const f of e.facts ?? []) {
    used.add(f);
    if (!factIds.has(f)) problems.push(`Ei ${e.id}: unbekannter Fakt ${f}`);
  }
}
for (const f of FACTS)
  if (!used.has(f.id)) console.warn(`Hinweis: Fakt ${f.id} wird in keiner Antwort verwendet`);
const qIds = new Set(profiles.flatMap((p) => p.questions.map((q) => q.id)));
for (const q of QUIZ) {
  if (q.correct < 0 || q.correct >= q.options.length) problems.push(`Quiz ${q.id}: correct außerhalb`);
  for (const r of q.related ?? []) if (!qIds.has(r)) problems.push(`Quiz ${q.id}: related ${r} unbekannt`);
}

if (problems.length) {
  console.error('Inhalts-Probleme:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log(
  `Inhalte ok: ${JACKIE.questions.length} + ${YAO.questions.length} Fragen, ${WORDS.length} Wörter, ${FACTS.length} Fakten, ${QUIZ.length} Quizfragen.`,
);
if (process.argv.includes('--check')) process.exit(0);

// ───────── FAKTEN.md
const who = { jackie: 'Jackie Chan · 成龙', yao: 'Yao Ming · 姚明', beide: 'Beide / Sprache' };
const questionsOf = (id) => [
  ...profiles.flatMap((p) => p.questions.filter((q) => (q.facts ?? []).includes(id)).map((q) => q.id)),
  ...EGGS.filter((e) => (e.facts ?? []).includes(id)).map((e) => `Ei:${e.id}`),
];
let md = `# Faktenliste zum Gegenchecken

> Wird automatisch aus \`src/content/facts.ts\` erzeugt (\`npm run facts\`). Nicht von Hand ändern, sondern in facts.ts.

**Wichtig:** Alle Antworten im Spiel sind frei formulierte Ich-Texte. Sie stützen sich auf die hier genannten, öffentlich bekannten Fakten.
Es sind **keine echten Zitate**. Wo eine Aussage sinngemäß einer Rede entspricht, steht das in der Spalte „Hinweis“.
Die Quellen wurden bei der Erstellung per Websuche gefunden. Bitte öffne sie vor einer Veröffentlichung kurz selbst.

Sicherheit: **hoch** = in mehreren Quellen bestätigt, **mittel** = bitte selbst nachprüfen.

`;
for (const key of ['jackie', 'yao', 'beide']) {
  md += `## ${who[key]}\n\n| ID | Aussage | Sicherheit | Quellen | Hinweis | Verwendet in |\n|---|---|---|---|---|---|\n`;
  for (const f of FACTS.filter((x) => x.who === key)) {
    const srcs = f.src.map((s, i) => `[${i + 1}](${s})`).join(' ');
    md += `| ${f.id} | ${f.text.replace(/\|/g, '/')} | ${f.confidence} | ${srcs} | ${(f.note ?? '').replace(/\|/g, '/')} | ${questionsOf(f.id).join(', ') || '–'} |\n`;
  }
  md += '\n';
}
md += `## Charakterliche Aussagen (keine Fakten)

Die Persönlichkeits- und Werte-Antworten (z. B. „Wie würdest du dich beschreiben?“) sind **Charakterisierungen im Stil der Figur**, keine belegten Aussagen der echten Personen.
Sie bleiben bewusst allgemein (Fleiß, Humor, Ruhe, Teamgeist).

## Humor und Zwischenrufe

Die Zwischenrufe der beiden Figuren (z. B. Scherze über Yaos Größe) sind erfundene Neckereien ohne Tatsachenbehauptung.
Nur wo sie eine Tatsache berühren (z. B. gemeinsame Haifisch-Kampagne, Jahr 2016), ist diese in der Tabelle belegt.

## Offene Punkte zum Nachprüfen

- Jackies Körpergröße (ca. 173 cm) schwankt je nach Quelle.
- Namensgeschichte „Jackie“: zwei Versionen, beide mit einem Kollegen namens Jack.
- „Kung Fu Panda“-Sprechrolle: bitte mit dem offiziellen Abspann abgleichen.
- Yao Ming: aktuelle Ämter (z. B. Verband) ändern sich – im Text steht nur die Zeitspanne 2017–2024.

## Darstellung im Spiel

- Alle Figuren sind stilisierte 3D-Figuren mit einem generischen, freundlichen Gesicht. Jackie Chan und Yao Ming sind **nicht** nach ihren echten Gesichtern modelliert; erkennbar sind sie über Kontext (Größe, Kleidung, Basketball, Namensschild).
- Größenverhältnis: Yao Ming 2,29 m, Jackie Chan ca. 1,73 m (Angaben zu Jackie schwanken). Die Köpfe sind stilisiert etwas größer als in echt.
- Die Kleidung (roter Mantel mit Golddrachen, Kampfkunst-Jacke) ist eine freie Gestaltung und keine Nachbildung bestimmter Auftritte.
`;
writeFileSync(join(root, 'FAKTEN.md'), md);
console.log('FAKTEN.md geschrieben.');
