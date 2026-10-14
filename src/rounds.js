// Builds a round of "what starts with…?" questions.
import { WORDS, soundConflict } from './content.js';

export const ROUND_SIZE = 5;

function shuffle(list, rng) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildQuestion(target, rng = Math.random) {
  const pool = WORDS.filter((w) => !soundConflict(w.letter, target.letter));
  // One distractor per starting letter, so no two options share an initial.
  const seen = new Set();
  const distractors = [];
  for (const w of shuffle(pool, rng)) {
    if (seen.has(w.letter)) continue;
    seen.add(w.letter);
    distractors.push(w);
    if (distractors.length === 3) break;
  }
  return { letter: target.letter, target, options: shuffle([target, ...distractors], rng) };
}

export function buildRound(rng = Math.random, size = ROUND_SIZE) {
  const byLetter = new Map();
  for (const w of WORDS) byLetter.set(w.letter, [...(byLetter.get(w.letter) || []), w]);
  const letters = shuffle([...byLetter.keys()], rng);
  const picked = [];
  for (const l of letters) {
    // Avoid two questions in a row that are easy to confuse.
    if (picked.length && soundConflict(picked[picked.length - 1].letter, l)) continue;
    const words = byLetter.get(l);
    picked.push(words[Math.floor(rng() * words.length)]);
    if (picked.length === size) break;
  }
  return picked.map((t) => buildQuestion(t, rng));
}
