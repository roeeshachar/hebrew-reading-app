// Every clip the app can play, in the order they should be made.
// text: what is shown on the recording list. say: what a voice should speak.
import { LETTERS, VOWELS, WORDS, WORD_NIKUD, SOUND_TEXT, LETTER_NAME, PART_CLIPS } from './content.js';
import { makeToken } from './lab-logic.js';

export const GROUPS = [
  { id: 'prompts', label: 'הוראות' },
  { id: 'names', label: 'שמות' },
  { id: 'sounds', label: 'צלילים' },
  { id: 'words', label: 'מילים' },
  { id: 'syllables', label: 'הברות' },
  { id: 'parts', label: 'חלקי מילים' },
];

const prompt = (key, text, note = '') => ({ group: 'prompts', key, text, say: text, note });

export const CLIPS = [
  prompt('prompt/what-starts-with', 'מה מתחיל באות', 'לפני שם האות'),
  prompt('prompt/pop-word', 'פוצצו את האותיות של המילה לפי הסדר', 'לפני המילה'),
  prompt('prompt/build-word', 'בנו את המילה', 'לפני המילה'),
  prompt('prompt/feed-monster', 'האכילו את המפלצת', 'לפני המילה'),
  prompt('prompt/read-word', 'קראו את המילה', 'לפני המילה'),
  prompt('prompt/read-together', 'בואו נקרא ביחד', 'חם, בלי אכזבה'),
  prompt('prompt/try-again', 'כמעט! נסו שוב', 'חם ועדין, בלי אכזבה'),
  prompt('prompt/well-done', 'כל הכבוד!'),
  ...LETTERS.map((l) => ({ group: 'names', key: `letter-name/${l.id}`, text: l.ch, say: LETTER_NAME[l.ch], note: 'שם האות' })),
  ...LETTERS.map((l) => ({ group: 'sounds', key: `letter-sound/${l.id}`, text: l.ch, say: SOUND_TEXT[l.ch], note: 'הצליל בלבד, לא שם האות' })),
  ...WORDS.map((w) => ({ group: 'words', key: `word/${w.id}`, text: w.he, say: WORD_NIKUD[w.id], note: w.emoji })),
  ...LETTERS.flatMap((l) =>
    VOWELS.map((v) => {
      const t = makeToken(l.ch, v.id);
      return { group: 'syllables', key: `syllable/${l.id}-${v.id}`, text: t, say: t, note: v.name };
    })),
  ...[...PART_CLIPS].map(([text, key]) => ({ group: 'parts', key, text, say: text, note: 'חלק מילה למפלצת' })),
];
