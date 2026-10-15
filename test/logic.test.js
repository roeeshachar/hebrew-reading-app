import test from 'node:test';
import assert from 'node:assert/strict';
import { makeToken, addToken, removeLast, applyVowel, display, MAX_TOKENS } from '../src/lab-logic.js';
import { buildRound, buildQuestion } from '../src/rounds.js';
import { WORDS, LETTERS, VOWELS, soundConflict } from '../src/content.js';

test('token combines letter and vowel; shuruk adds a dotted vav', () => {
  assert.equal(makeToken('ב'), 'ב');
  assert.equal(makeToken('ב', 'kamatz'), 'בָ');
  assert.equal(makeToken('מ', 'shuruk'), 'מוּ');
});

test('delete removes the letter together with its vowel', () => {
  const seq = [makeToken('ב', 'kamatz'), makeToken('ד', 'chirik')];
  assert.deepEqual(removeLast(seq), [makeToken('ב', 'kamatz')]);
  assert.deepEqual(removeLast([]), []);
});

test('empty sequence is safe', () => {
  assert.equal(display([]), '');
});

test('last letter takes its final shape, others do not', () => {
  assert.equal(display(['ש', 'ל', 'מ']), 'שלם');
  assert.equal(display(['מ', 'מ']), 'מם');
  assert.equal(display(['מ']), 'ם');
  assert.equal(display(['ד', 'ל', 'ת']), 'דלת');
  assert.equal(display(['ב', makeToken('נ', 'kamatz')]), 'ב' + 'ןָ');
});

test('shuruk token ends in vav so it is never reshaped', () => {
  assert.equal(display(['ש', makeToken('מ', 'shuruk')]), 'שמוּ');
});

test('sequence is capped', () => {
  let s = [];
  for (let i = 0; i < 40; i++) s = addToken(s, 'א');
  assert.equal(s.length, MAX_TOKENS);
});

test('non-words are accepted like any other sequence', () => {
  assert.equal(display(['ש', 'ק', 'ל', 'ק', 'ל']), 'שקלקל');
});

test('every letter and vowel has the data the audio and UI need', () => {
  assert.equal(LETTERS.length, 22);
  assert.equal(VOWELS.length, 7);
});

test('rounds: 5 questions, 4 unique options, one correct, no confusable letters', () => {
  let seed = 7;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let r = 0; r < 200; r++) {
    const round = buildRound(rng);
    assert.equal(round.length, 5);
    for (const q of round) {
      assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options.map((o) => o.id)).size, 4);
      assert.equal(q.options.filter((o) => o.letter === q.letter).length, 1);
      for (const o of q.options) if (o !== q.target) assert.ok(!soundConflict(o.letter, q.letter));
    }
    assert.equal(new Set(round.map((q) => q.letter)).size, 5);
  }
});

test('every word can form a question', () => {
  for (const w of WORDS) assert.equal(buildQuestion(w).options.length, 4);
});

test('choosing a vowel changes the last letter only, and can be changed again or removed', () => {
  let seq = ['ד', 'מ'];
  seq = applyVowel(seq, 'מ', 'kamatz');
  assert.deepEqual(seq, ['ד', makeToken('מ', 'kamatz')]);
  seq = applyVowel(seq, 'מ', 'chirik');
  assert.deepEqual(seq, ['ד', makeToken('מ', 'chirik')]);
  seq = applyVowel(seq, 'מ', null);
  assert.deepEqual(seq, ['ד', 'מ']);
  assert.deepEqual(applyVowel([], 'מ', 'kamatz'), []);
});
