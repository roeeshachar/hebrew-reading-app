// Writes docs/recording-list.md: every clip the app can play, with the exact
// file name to save it as. Clips that already exist in audio/ are ticked.
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LETTERS, VOWELS, WORDS } from '../src/content.js';
import { makeToken } from '../src/lab-logic.js';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const row = (key, text, note = '') =>
  `| ${existsSync(join(root, 'audio', `${key}.mp3`)) ? '✅' : '⬜'} | ${text} | \`audio/${key}.mp3\` | ${note} |`;
const table = (rows) => ['| | להקליט | שם קובץ | הערה |', '|---|---|---|---|', ...rows].join('\n');

const prompts = [
  ['prompt/which-starts-with', 'איזו תמונה מתחילה בצליל', 'לפני צליל האות'],
  ['prompt/try-again', 'כמעט! נסו שוב', 'חם ועדין, בלי אכזבה'],
  ['prompt/pop-letter', 'פוצצו את הבועה עם האות', 'לפני צליל האות'],
  ['prompt/build-word', 'בנו את המילה', 'לפני המילה'],
  ['prompt/feed-monster', 'האכילו את המפלצת', 'לפני המילה'],
  ['prompt/well-done', 'כל הכבוד!', ''],
];
const sounds = LETTERS.map((l) => row(`letter-sound/${l.id}`, l.ch, 'הצליל בלבד ("דְּ"), לא השם "דלת"'));
const words = WORDS.map((w) => row(`word/${w.id}`, `${w.emoji} ${w.he}`));
const syl = LETTERS.flatMap((l) =>
  VOWELS.map((v) => row(`syllable/${l.id}-${v.id}`, makeToken(l.ch, v.id), v.name)));

const doc = `# רשימת הקלטות

סדר ההקלטה המומלץ הוא מלמעלה למטה. אפשר להתחיל רק בשלב 1: מה שחסר מושמע בקול המכשיר.

טיפים: חדר שקט, הטלפון במרחק כ-20 ס"מ, קליפ לכל פריט (1–2 שניות), בלי "אה" בהתחלה. שמרו כ-mp3 בשם שבטבלה, ואז הריצו \`npm run audio-manifest\`.

## שלב 1: הוראות ותגובות (${prompts.length})
${table(prompts.map(([k, t, n]) => row(k, t, n)))}

## שלב 2: צלילי האותיות (${sounds.length})
${table(sounds)}

## שלב 3: מילים (${words.length})
${table(words)}

## שלב 4: הברות לפיתוח המעבדה (${syl.length})
אופציונלי. כשכל ההברות של רצף קיימות, האפליקציה מחברת אותן. אחרת היא משתמשת בקול המכשיר.
${table(syl)}
`;
await mkdir(join(root, 'docs'), { recursive: true });
await writeFile(join(root, 'docs', 'recording-list.md'), doc);
console.log(`docs/recording-list.md: ${prompts.length + sounds.length + words.length + syl.length} clips`);
