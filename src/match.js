// Compares what speech recognition heard with the word on screen.
// Recognition of a young child's voice is rough, so the match is forgiving:
// nikud, punctuation and final-letter shapes are ignored, a sentence that contains
// the word counts, and a longer word may be one letter off.

const FINAL = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

export function normalizeHebrew(text) {
  return [...String(text).normalize('NFC')]
    .filter((ch) => !/[֑-ׇ׳״'"“”.,!?\-–\s]/.test(ch))
    .map((ch) => FINAL[ch] || ch)
    .join('');
}

export function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return row[b.length];
}

export function matchesWord(alternatives, target) {
  const want = normalizeHebrew(target);
  if (!want) return false;
  for (const alt of alternatives) {
    const pieces = [alt, ...String(alt).split(/\s+/)];
    for (const piece of pieces) {
      const heard = normalizeHebrew(piece);
      if (!heard) continue;
      if (heard === want) return true;
      if (want.length >= 4 && distance(heard, want) <= 1) return true;
    }
  }
  return false;
}
