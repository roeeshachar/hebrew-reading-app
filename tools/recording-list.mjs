// Writes docs/recording-list.md: every clip the app can play, with the exact
// file name to save it as. Clips that already exist in audio/ are ticked.
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLIPS } from '../src/clip-list.js';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const row = (key, text, note = '') =>
  `| ${existsSync(join(root, 'audio', `${key}.mp3`)) ? '✅' : '⬜'} | ${text} | \`audio/${key}.mp3\` | ${note} |`;
const table = (rows) => ['| | להקליט | שם קובץ | הערה |', '|---|---|---|---|', ...rows].join('\n');

const by = (g) => CLIPS.filter((c) => c.group === g);
const rows = (g) => by(g).map((c) => row(c.key, c.say && c.say !== c.text ? `${c.text} (${c.say})` : c.text, c.note));
const prompts = by('prompts'), names = by('names'), sounds = by('sounds'), words = by('words'), syl = by('syllables');

const doc = `# רשימת הקלטות

סדר ההקלטה המומלץ הוא מלמעלה למטה. אפשר להתחיל רק בשלב 1: מה שחסר מושמע בקול המכשיר.

טיפים: חדר שקט, הטלפון במרחק כ-20 ס"מ, קליפ לכל פריט (1–2 שניות), בלי "אה" בהתחלה. שמרו כ-mp3 בשם שבטבלה, ואז הריצו \`npm run audio-manifest\`.

## שלב 1: הוראות ותגובות (${prompts.length})
${table(rows('prompts'))}

## שלב 2: שמות האותיות (${names.length})
כשמחפשים או בוחרים אות (בועות, מעבדה): "דלת", "בית".
${table(rows('names'))}

## שלב 3: צלילי האותיות (${sounds.length})
כשמתאימים אות לצליל או מאייתים: "דְּ", "בְּ". לא השם.
${table(rows('sounds'))}

## שלב 4: מילים (${words.length})
${table(rows('words'))}

## שלב 5: הברות לפיתוח המעבדה (${syl.length})
אופציונלי. כשכל ההברות של רצף קיימות, האפליקציה מחברת אותן. אחרת היא משתמשת בקול המכשיר.
${table(rows('syllables'))}
`;
await mkdir(join(root, 'docs'), { recursive: true });
await writeFile(join(root, 'docs', 'recording-list.md'), doc);
console.log(`docs/recording-list.md: ${prompts.length + names.length + sounds.length + words.length + syl.length} clips`);
