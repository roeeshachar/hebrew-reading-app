// Pure logic for the Word Lab. A sequence is a list of tokens; each token is
// one letter plus its vowel, so deleting removes the letter and its vowel together.
import { VOWELS } from './content.js';

export const MAX_TOKENS = 12;

const FINAL = { 'כ': 'ך', 'מ': 'ם', 'נ': 'ן', 'פ': 'ף', 'צ': 'ץ' };

export function makeToken(letter, vowelId = null) {
  const v = VOWELS.find((x) => x.id === vowelId);
  if (!v) return letter;
  return letter + v.mark + (v.suffix || '');
}

export function addToken(seq, token) {
  return seq.length >= MAX_TOKENS ? seq : [...seq, token];
}

export function removeLast(seq) {
  return seq.slice(0, -1);
}

// Text to show or speak. The last letter takes its word-final shape when it is
// the last letter written (a shuruk token ends in vav, so it never changes).
export function display(seq) {
  if (!seq.length) return '';
  const last = seq[seq.length - 1];
  const first = [...last][0];
  const rest = last.slice(first.length);
  const endsInLetter = !rest.includes('וּ');
  const shaped = endsInLetter && FINAL[first] ? FINAL[first] + rest : last;
  return seq.slice(0, -1).join('') + shaped;
}

// Gives the last letter a vowel (or none, with null) without adding a new token.
export function applyVowel(seq, letter, vowelId) {
  if (!seq.length) return seq;
  return [...seq.slice(0, -1), makeToken(letter, vowelId)];
}
