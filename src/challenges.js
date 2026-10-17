// Builds the challenges for every game. Pure functions, so they can be tested.
import { LETTERS, WORDS, SYLLABLES, NAME_WORD_IDS, soundConflict } from './content.js';
import { buildQuestion } from './rounds.js';

export const SESSION_SIZE = 5;
export const MODES = ['starts', 'bubbles', 'build', 'syllable', 'read', 'boss'];

const FINAL_TO_BASE = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
export const baseLetter = (ch) => FINAL_TO_BASE[ch] || ch;

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const wordById = (id) => WORDS.find((w) => w.id === id);

export function makeStarts(rng) {
  const target = pick(WORDS.filter((w) => !NAME_WORD_IDS.includes(w.id)), rng);
  return { type: 'starts', ...buildQuestion(target, rng), word: target };
}

// Pop the letters of a word, in order. `letters` are the base letters; `slots` the word as
// written (with final forms). `pool` holds the other letters that float by.
export function makeBubbles(rng, avoid = []) {
  const words = WORDS.filter((w) => [...w.he].length >= 2 && [...w.he].length <= 4 && !avoid.includes(w.id));
  const word = pick(words, rng);
  const slots = [...word.he];
  const letters = slots.map(baseLetter);
  const pool = shuffle(LETTERS.map((l) => l.ch).filter((l) => !letters.includes(l)), rng).slice(0, 9);
  return { type: 'bubbles', word, slots, letters, pool, need: letters.length };
}

export function makeBuild(rng, avoid = []) {
  const words = WORDS.filter((w) => [...w.he].length >= 2 && [...w.he].length <= 4 && !avoid.includes(w.id));
  const word = pick(words, rng);
  const slots = [...word.he];
  const inWord = new Set(slots.map(baseLetter));
  const extra = shuffle(LETTERS.map((l) => l.ch).filter((l) => !inWord.has(l)), rng).slice(0, 2);
  const tray = shuffle([...slots.map(baseLetter), ...extra], rng);
  return { type: 'build', word, slots, tray };
}
// The tapped tile is right when it is the base form of the next empty slot's letter.
export const buildAccepts = (c, placed, tile) => baseLetter(c.slots[placed]) === tile;

export function makeSyllable(rng, avoid = []) {
  const ids = Object.keys(SYLLABLES).filter((id) => !avoid.includes(id));
  const id = pick(ids, rng);
  const parts = SYLLABLES[id];
  const others = Object.values(SYLLABLES).flat().filter((p) => !parts.includes(p));
  const extra = shuffle([...new Set(others)], rng).slice(0, 2);
  return { type: 'syllable', word: wordById(id), parts, tray: shuffle([...parts, ...extra], rng) };
}
export const syllableAccepts = (c, placed, piece) => c.parts[placed] === piece;

// The monster shows a pointed word and the child reads it aloud.
export function makeRead(rng, avoid = []) {
  const ids = Object.keys(SYLLABLES).filter((id) => !avoid.includes(id));
  const id = pick(ids, rng);
  const parts = SYLLABLES[id];
  return { type: 'read', word: wordById(id), parts, text: parts.join('') };
}

function many(make, key, rng, n = SESSION_SIZE) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(make(rng, out.map(key)));
  return out;
}

export function buildSession(mode, rng = Math.random) {
  switch (mode) {
    case 'bubbles': return many(makeBubbles, (c) => c.word.id, rng);
    case 'build': return many(makeBuild, (c) => c.word.id, rng);
    case 'syllable': return many(makeSyllable, (c) => c.word.id, rng);
    case 'read': return many(makeRead, (c) => c.word.id, rng);
    case 'boss': return [makeBubbles(rng), makeStarts(rng), makeBuild(rng), makeSyllable(rng), makeStarts(rng)];
    default: return many((r, avoid) => {
      // Starts-with questions must not repeat a first letter within a session.
      let q;
      do { q = makeStarts(r); } while (avoid.includes(q.letter) && avoid.length < 18);
      return q;
    }, (c) => c.letter, rng);
  }
}
