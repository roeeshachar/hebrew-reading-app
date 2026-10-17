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

test('syllables are the same letters as the word, in order', async () => {
  const { SYLLABLES } = await import('../src/content.js');
  const strip = (s) => s.replace(/[֑-ׇ]/g, '');
  for (const [id, parts] of Object.entries(SYLLABLES)) {
    const w = WORDS.find((x) => x.id === id);
    assert.ok(w, `word ${id} exists`);
    assert.ok(parts.length >= 2);
    assert.equal(strip(parts.join('')), w.he, id);
  }
});

test('every game builds a full session that can be solved', async () => {
  const { buildSession, buildAccepts, syllableAccepts, MODES } = await import('../src/challenges.js');
  let seed = 3;
  const rng = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let r = 0; r < 100; r++) {
    for (const mode of MODES) {
      const cs = buildSession(mode, rng);
      assert.equal(cs.length, 5, mode);
      for (const c of cs) {
        if (c.type === 'starts') assert.equal(c.options.filter((o) => o.letter === c.letter).length, 1);
        if (c.type === 'bubbles') {
          assert.ok(c.letters.length >= 2 && c.letters.length <= 4);
          assert.equal(c.need, c.letters.length);
          assert.deepEqual(c.letters.map((l) => l), [...c.word.he].map((ch) => ({ 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' })[ch] || ch));
          assert.ok(c.pool.length >= 6);
          assert.equal(new Set(c.pool).size, c.pool.length);
          for (const l of c.letters) assert.ok(!c.pool.includes(l), 'the pool holds only other letters');
        }
        if (c.type === 'build') {
          // Tapping the right tile for each slot in turn finishes the word.
          const tray = [...c.tray];
          for (let i = 0; i < c.slots.length; i++) {
            const k = tray.findIndex((t) => buildAccepts(c, i, t));
            assert.ok(k >= 0, `${c.word.id} slot ${i}`);
            tray.splice(k, 1);
          }
        }
        if (c.type === 'syllable') {
          const tray = [...c.tray];
          for (let i = 0; i < c.parts.length; i++) {
            const k = tray.findIndex((t) => syllableAccepts(c, i, t));
            assert.ok(k >= 0, `${c.word.id} part ${i}`);
            tray.splice(k, 1);
          }
        }
      }
      if (mode !== 'boss' && mode !== 'starts') assert.equal(new Set(cs.map((c) => c.word?.id ?? c.letter)).size, 5, `${mode} has no repeats`);
    }
  }
});

test('speech matching ignores nikud, punctuation and final letters, and forgives one slip in longer words', async () => {
  const { matchesWord, normalizeHebrew } = await import('../src/match.js');
  assert.equal(normalizeHebrew('דֶּלֶת.'), 'דלת');
  assert.equal(normalizeHebrew('לימון'), normalizeHebrew('לימוֹן'));
  assert.ok(matchesWord(['דלת'], 'דֶּלֶת'));
  assert.ok(matchesWord(['זה דלת'], 'דֶּלֶת'), 'a sentence containing the word counts');
  assert.ok(matchesWord(['לא נכון', 'כלב'], 'כֶּלֶב'), 'any alternative can match');
  assert.ok(matchesWord(['לימן'], 'לִימוֹן'), 'one letter off in a long word');
  assert.ok(!matchesWord(['דלי'], 'דֶּלֶת'), 'no slack on short words');
  assert.ok(!matchesWord(['חתול'], 'כֶּלֶב'));
  assert.ok(!matchesWord([], 'דֶּלֶת'));
  assert.ok(!matchesWord(['', '  '], 'דֶּלֶת'));
});

test('every reading word matches itself and nothing else in the list', async () => {
  const { matchesWord } = await import('../src/match.js');
  const { SYLLABLES } = await import('../src/content.js');
  const words = Object.entries(SYLLABLES).map(([id, parts]) => ({ id, text: parts.join(''), he: WORDS.find((w) => w.id === id).he }));
  for (const a of words) {
    assert.ok(matchesWord([a.he], a.text), a.id);
    for (const b of words) if (a !== b) assert.ok(!matchesWord([b.he], a.text), `${b.id} must not pass for ${a.id}`);
  }
});

test('clip list: every word has nikud, every letter has a sound text, keys are unique', async () => {
  const { CLIPS } = await import('../src/clip-list.js');
  const { WORD_NIKUD, SOUND_TEXT, LETTERS } = await import('../src/content.js');
  const strip = (s) => s.replace(/[\u0591-\u05C7]/g, '');
  assert.equal(new Set(CLIPS.map((c) => c.key)).size, CLIPS.length);
  for (const w of WORDS) assert.equal(strip(WORD_NIKUD[w.id] || ''), w.he, `nikud for ${w.id}`);
  for (const l of LETTERS) assert.equal(strip(SOUND_TEXT[l.ch] || '')[0], l.ch, `sound text for ${l.id}`);
  const { LETTER_NAME } = await import('../src/content.js');
  for (const l of LETTERS) assert.ok(LETTER_NAME[l.ch], `name for ${l.id}`);
  assert.notEqual(LETTER_NAME['ד'], SOUND_TEXT['ד'], 'the name and the sound are different clips');
  assert.ok(CLIPS.every((c) => c.say && /^[a-z-]+\/[a-z0-9-]+$/.test(c.key)));
});

test('"what starts with" never asks for a word spelled like its letter\'s name', async () => {
  const { NAME_WORD_IDS } = await import('../src/content.js');
  const { buildSession } = await import('../src/challenges.js');
  assert.ok(NAME_WORD_IDS.includes('delet') && NAME_WORD_IDS.includes('kof'), 'דלת and קוף give the answer away');
  for (let i = 0; i < 300; i++) for (const c of buildSession('starts')) assert.ok(!NAME_WORD_IDS.includes(c.target.id), c.target.id);
});

test('every syllable the monster can serve has a clip', async () => {
  const { PART_CLIPS, SYLLABLES } = await import('../src/content.js');
  const { CLIPS } = await import('../src/clip-list.js');
  const keys = new Set(CLIPS.map((c) => c.key));
  for (const parts of Object.values(SYLLABLES)) for (const p of parts) {
    assert.ok(PART_CLIPS.has(p), `no clip for ${p}`);
    assert.ok(keys.has(PART_CLIPS.get(p)), `${PART_CLIPS.get(p)} is not on the clip list`);
  }
  assert.equal(new Set(PART_CLIPS.values()).size, PART_CLIPS.size, 'keys are unique');
});
