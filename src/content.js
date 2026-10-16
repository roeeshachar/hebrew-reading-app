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
  ['rakevet', 'רכבת', '🚂', 'ר'], ['radio', 'רדיו', '📻', 'ר'],
  ['shemesh', 'שמש', '☀️', 'ש'], ['shualcha', 'שועל', '🦊', 'ש'],
  ['tapuz', 'תפוז', '🍊', 'ת'], ['tut', 'תות', '🍓', 'ת'],
  ['arye', 'אריה', '🦁', 'א'], ['avatiach', 'אבטיח', '🍉', 'א'],
].map(([id, he, emoji, letter]) => ({ id, he, emoji, letter }));

export function soundConflict(a, b) {
  return a === b || SOUND_GROUPS.some((g) => g.includes(a) && g.includes(b));
}

// Words split into spoken syllables, with nikud. Used by the syllable monster.
export const SYLLABLES = {
  banana: ['בָּ', 'נָ', 'נָה'],
  delet: ['דֶּ', 'לֶת'],
  kelev: ['כֶּ', 'לֶב'],
  chatul: ['חָ', 'תוּל'],
  shemesh: ['שֶׁ', 'מֶשׁ'],
  sefer: ['סֵ', 'פֶר'],
  perach: ['פֶּ', 'רַח'],
  yeled: ['יֶ', 'לֶד'],
  gamal: ['גָּ', 'מָל'],
  tapuz: ['תַּ', 'פּוּז'],
  limon: ['לִי', 'מוֹן'],
  chalon: ['חַ', 'לּוֹן'],
  kadur: ['כַּ', 'דּוּר'],
  nachash: ['נָ', 'חָשׁ'],
  mechonit: ['מְ', 'כוֹ', 'נִית'],
};

// What a voice should say for each word: the same word with nikud, so it is read the way
// a child should learn it. Keyed by word id.
export const WORD_NIKUD = {
  banana: 'בָּנָנָה', bayit: 'בַּיִת', gamal: 'גָּמָל', gezer: 'גֶּזֶר', glida: 'גְּלִידָה',
  delet: 'דֶּלֶת', dag: 'דָּג', dov: 'דֹּב', halicopter: 'הֶלִיקוֹפְּטֶר', zebra: 'זֶבְּרָה', zman: 'זְמַן',
  chatul: 'חָתוּל', chalon: 'חַלּוֹן', tayil: 'טִיל', yeled: 'יֶלֶד', yareach: 'יָרֵחַ',
  kelev: 'כֶּלֶב', kadur: 'כַּדּוּר', limon: 'לִימוֹן', lev: 'לֵב', mayim: 'מַיִם', mechonit: 'מְכוֹנִית',
  nachash: 'נָחָשׁ', naal: 'נַעַל', sus: 'סוּס', sefer: 'סֵפֶר', etz: 'עֵץ', anan: 'עָנָן',
  pil: 'פִּיל', perach: 'פֶּרַח', tsfardea: 'צְפַרְדֵּעַ', kof: 'קוֹף', kafe: 'קָפֶה',
  rakevet: 'רַכֶּבֶת', radio: 'רָדִיו', shemesh: 'שֶׁמֶשׁ', shualcha: 'שׁוּעָל', tapuz: 'תַּפּוּז',
  tut: 'תּוּת', arye: 'אַרְיֵה', avatiach: 'אֲבַטִּיחַ',
};

// The sound of each letter on its own, as text a voice can say: the letter with a sheva
// (a short "d"), not the letter's name. Alef and ayin are silent with a sheva, so they take
// a patach. Change an entry and generate that clip again if a letter sounds wrong.
export const SOUND_TEXT = {
  'א': 'אַ', 'ב': 'בְּ', 'ג': 'גְּ', 'ד': 'דֶ', 'ה': 'הְ', 'ו': 'וְ', 'ז': 'זְ', 'ח': 'חְ',
  'ט': 'טְ', 'י': 'יְ', 'כ': 'כְּ', 'ל': 'לְ', 'מ': 'מְ', 'נ': 'נְ', 'ס': 'סְ', 'ע': 'עַ',
  'פ': 'פְּ', 'צ': 'צְ', 'ק': 'קְ', 'ר': 'רְ', 'ש': 'שְׁ', 'ת': 'תְּ',
};

// A letter's name, as a voice should say it. Used when the child is finding or choosing a
// letter (bubbles, the word lab). The sound (SOUND_TEXT) is for matching and spelling.
export const LETTER_NAME = {
  'א': 'אָלֶף', 'ב': 'בֵּית', 'ג': 'גִּימֶל', 'ד': 'דָּלֶת', 'ה': 'הֵא', 'ו': 'וָו', 'ז': 'זַיִן', 'ח': 'חֵית',
  'ט': 'טֵית', 'י': 'יוֹד', 'כ': 'כָּף', 'ל': 'לָמֶד', 'מ': 'מֵם', 'נ': 'נוּן', 'ס': 'סָמֶךְ', 'ע': 'עַיִן',
  'פ': 'פֵּא', 'צ': 'צָדִי', 'ק': 'קוּף', 'ר': 'רֵישׁ', 'ש': 'שִׁין', 'ת': 'תָּו',
};
