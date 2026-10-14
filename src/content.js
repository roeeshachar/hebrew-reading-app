// Static learning content. Pictures are emoji placeholders until real illustrations exist.

export const LETTERS = [
  ['alef', 'א'], ['bet', 'ב'], ['gimel', 'ג'], ['dalet', 'ד'], ['he', 'ה'], ['vav', 'ו'],
  ['zayin', 'ז'], ['chet', 'ח'], ['tet', 'ט'], ['yod', 'י'], ['kaf', 'כ'], ['lamed', 'ל'],
  ['mem', 'מ'], ['nun', 'נ'], ['samech', 'ס'], ['ayin', 'ע'], ['pe', 'פ'], ['tsadi', 'צ'],
  ['qof', 'ק'], ['resh', 'ר'], ['shin', 'ש'], ['tav', 'ת'],
].map(([id, ch]) => ({ id, ch }));

export const LETTER_ID = Object.fromEntries(LETTERS.map((l) => [l.ch, l.id]));

// `mark` is appended after the letter. Shuruk is a vav with a dot, so it adds a letter.
export const VOWELS = [
  { id: 'kamatz', mark: 'ָ', name: 'קָמץ', sample: 'בָ' },
  { id: 'patach', mark: 'ַ', name: 'פַּתח', sample: 'בַ' },
  { id: 'chirik', mark: 'ִ', name: 'חִירִיק', sample: 'בִ' },
  { id: 'tsere', mark: 'ֵ', name: 'צֵירֶה', sample: 'בֵ' },
  { id: 'segol', mark: 'ֶ', name: 'סֶגּוֹל', sample: 'בֶ' },
  { id: 'cholam', mark: 'ֹ', name: 'חוֹלָם', sample: 'בֹ' },
  { id: 'shuruk', mark: '', suffix: 'וּ', name: 'שׁוּרוּק', sample: 'בוּ' },
];

// Letters that sound alike at the start of a word. Never show them together
// as target and distractor, or the child cannot tell which answer is right.
export const SOUND_GROUPS = [
  ['א', 'ע'],
  ['ט', 'ת'],
  ['כ', 'ק', 'ח'],
  ['ב', 'ו'],
];

// Only words whose first letter is spelled and pronounced unambiguously
// (בּ, כּ, פּ words start with the hard sound; no silent or shared-sound openers
// other than the groups above).
export const WORDS = [
  ['banana', 'בננה', '🍌', 'ב'], ['bayit', 'בית', '🏠', 'ב'],
  ['gamal', 'גמל', '🐪', 'ג'], ['gezer', 'גזר', '🥕', 'ג'], ['glida', 'גלידה', '🍦', 'ג'],
  ['delet', 'דלת', '🚪', 'ד'], ['dag', 'דג', '🐟', 'ד'], ['dov', 'דב', '🐻', 'ד'],
  ['halicopter', 'הליקופטר', '🚁', 'ה'],
  ['zebra', 'זברה', '🦓', 'ז'], ['zman', 'זמן', '⏰', 'ז'],
  ['chatul', 'חתול', '🐱', 'ח'], ['chalon', 'חלון', '🪟', 'ח'],
  ['tayil', 'טיל', '🚀', 'ט'],
  ['yeled', 'ילד', '👦', 'י'], ['yareach', 'ירח', '🌙', 'י'],
  ['kelev', 'כלב', '🐶', 'כ'], ['kadur', 'כדור', '⚽', 'כ'],
  ['limon', 'לימון', '🍋', 'ל'], ['lev', 'לב', '❤️', 'ל'],
  ['mayim', 'מים', '💧', 'מ'], ['mechonit', 'מכונית', '🚗', 'מ'],
  ['nachash', 'נחש', '🐍', 'נ'], ['naal', 'נעל', '👟', 'נ'],
  ['sus', 'סוס', '🐴', 'ס'], ['sefer', 'ספר', '📖', 'ס'],
  ['etz', 'עץ', '🌳', 'ע'], ['anan', 'ענן', '☁️', 'ע'],
  ['pil', 'פיל', '🐘', 'פ'], ['perach', 'פרח', '🌸', 'פ'],
  ['tsfardea', 'צפרדע', '🐸', 'צ'],
  ['kof', 'קוף', '🐒', 'ק'], ['kafe', 'קפה', '☕', 'ק'],
  ['rakevet', 'רכבת', '🚂', 'ר'], ['rimon', 'רימון', '🍎', 'ר'],
  ['shemesh', 'שמש', '☀️', 'ש'], ['shualcha', 'שועל', '🦊', 'ש'],
  ['tapuz', 'תפוז', '🍊', 'ת'], ['tut', 'תות', '🍓', 'ת'],
  ['arye', 'אריה', '🦁', 'א'], ['avatiach', 'אבטיח', '🍉', 'א'],
].map(([id, he, emoji, letter]) => ({ id, he, emoji, letter }));

export function soundConflict(a, b) {
  return a === b || SOUND_GROUPS.some((g) => g.includes(a) && g.includes(b));
}
