import { LETTERS, LETTER_ID, VOWELS } from './content.js';
import { MAX_TOKENS, makeToken, addToken, removeLast, applyVowel, display } from './lab-logic.js';
import { buildSession, buildAccepts, syllableAccepts, MODES } from './challenges.js';
import * as audio from './audio.js';
import { startArena } from './arena.js';
import * as progress from './progress.js';

const app = document.getElementById('app');
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- state ----
// pending: the letter just tapped, whose vowel can still be chosen.
let lab = { seq: [], pending: null };
// One play-through of a game: five challenges, one after another.
// st holds the on-screen state of the current challenge.
let session = null;
const freshState = () => ({ picked: null, placed: 0, used: [], hit: false, hits: 0 });
let stopArena = null;

// ---- shared pieces ----
const homeBtn = (visible = true) =>
  `<button class="round" data-go="home" aria-label="הביתה" ${visible ? '' : 'style="visibility:hidden"'}>🏠</button>`;
const starsPill = () => `<div class="pill" aria-label="כוכבים">⭐ ${progress.get().stars}</div>`;
const ttsNote = () =>
  audio.state.ttsAvailable ? '' : `<div class="notice" role="status">🔇 אין קול עברי במכשיר. אפשר להמשיך לשחק.</div>`;


// ---- how each kind of challenge looks ----
const bannerGood = (text) => `<div class="banner good"><span class="e">🎉</span>${esc(text)}</div><button class="next" data-next>${session.i + 1 === session.cs.length ? 'סיימנו ▶' : 'עוד אחת ▶'}</button>`;
const bannerTry = '<div class="banner try"><span class="e">🤔</span>כמעט! בוא ננסה עוד פעם</div>';

const draw = {
  starts(c) {
    const opts = c.options.map((w, i) => {
      let cls = 'opt';
      if (session.answered) cls += w === c.target ? ' ok' : ' dim';
      else if (session.st.picked === i) cls += ' retry';
      return `<button class="${cls}" data-opt="${i}" ${session.answered ? 'disabled' : ''}>${w.emoji}<span>${esc(w.he)}</span></button>`;
    }).join('');
    return `<div class="prompt"><p class="sub">איזו תמונה מתחילה בצליל…</p>
      <button class="sound" data-say aria-label="השמע שוב">${c.letter}<small>🔊</small></button></div>
      <div class="opts">${opts}</div>`;
  },
  bubbles(c) {
    const filled = session.answered ? c.need : session.st.hits;
    const hits = Array.from({ length: c.need }, (_, k) => `<i class="${k < filled ? 'on' : ''}"></i>`).join('');
    return `<div class="bubprompt">
      <button class="sound mini" data-say aria-label="השמע שוב">${c.letter}<small>🔊</small></button>
      <div class="bubtext"><p class="sub">פוצצו את הבועות עם האות</p><div class="hits" aria-label="${c.need} בועות לפוצץ">${hits}</div></div></div>
      <div class="arena" id="arena"></div>`;
  },
  build(c) {
    const slots = c.slots.map((ch, i) => `<span class="slot ${i < session.st.placed ? 'full' : ''}">${i < session.st.placed ? ch : ''}</span>`).join('');
    const tiles = c.tray.map((ch, i) => `<button class="tile ${session.st.picked === i ? 'retry' : ''}" data-tile="${i}" ${session.st.used.includes(i) ? 'hidden' : ''}>${ch}</button>`).join('');
    return `<div class="prompt"><p class="sub">בנו את המילה</p>
      <button class="pic" data-say aria-label="השמע שוב">${c.word.emoji}<small>🔊</small></button></div>
      <div class="slots">${slots}</div><div class="tray">${tiles}</div>`;
  },
  syllable(c) {
    const eaten = c.parts.slice(0, session.st.placed).map((p) => `<span class="chip">${esc(p)}</span>`).join('');
    const tiles = c.tray.map((p, i) => `<button class="tile wide ${session.st.picked === i ? 'retry' : ''}" data-tile="${i}" ${session.st.used.includes(i) ? 'hidden' : ''}>${esc(p)}</button>`).join('');
    return `<div class="prompt"><p class="sub">האכילו את המפלצת</p>
      <button class="pic" data-say aria-label="השמע שוב">${c.word.emoji}<small>🔊</small></button></div>
      <div class="monster"><span class="mon ${session.st.hit ? 'munch' : ''}">👾</span><div class="eaten">${eaten || '<span class="hint">הברה אחרי הברה</span>'}</div></div>
      <div class="tray">${tiles}</div>`;
  },
};

function footer(c) {
  if (session.answered) {
    const text = c.type === 'starts' ? `${c.target.he}! ${c.target.he} מתחיל ב־${c.letter}`
      : c.type === 'bubbles' ? `האות ${c.letter}!`
        : `${c.word.he}!`;
    return bannerGood(text);
  }
  return session.st.picked != null ? bannerTry : '';
}

// ---- screens ----
const screens = {
  home() {
    const rounds = progress.get().rounds;
    const dots = (m) => Math.min(3, rounds[m] || 0);
    const stn = (x, y, color, icon, name, go, mode) => `
      <button class="stn" style="left:${x}%;top:${y}%" data-go="${go}">
        <span class="b" style="background:${color}">${icon}<span class="dots">${[1, 2, 3].map((i) => `<i class="${i <= dots(mode) ? 'on' : ''}"></i>`).join('')}</span></span>
        <span class="n">${name}</span></button>`;
    return `
      <div class="top">${homeBtn(false)}${starsPill()}</div>
      <h1>עולם הקריאה</h1><p class="sub">בוא נשחק באותיות!</p>
      <div class="map">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M70 14 C 20 18, 90 32, 30 38 S 90 58, 32 64 S 80 90, 50 96" stroke="#fff" stroke-width="3" fill="none" stroke-dasharray="1.5 3" vector-effect="non-scaling-stroke" stroke-linecap="round"/></svg>
        ${stn(68, 14, '#ffd966', '<span class="abg">אבג</span>', 'מה מתחיל ב־…‏', 'starts', 'starts')}
        ${stn(30, 36, '#9fe3d0', '🫧', 'בועות האותיות', 'bubbles', 'bubbles')}
        ${stn(68, 58, '#ffb3a7', '🧩', 'בונים מילה', 'build', 'build')}
        ${stn(30, 78, '#c9b8ff', '👾', 'מפלצת ההברות', 'syllable', 'syllable')}
        ${stn(68, 93, '#ffa86b', '🐉', 'קרב הבוס', 'boss', 'boss')}
      </div>
      <button class="labbtn" data-go="lab">🧪 מעבדת המילים</button>${ttsNote()}`;
  },

  // All five games share this screen; the challenge decides what is drawn.
  play() {
    const c = session.cs[session.i];
    const boss = session.mode === 'boss';
    const left = session.cs.length - session.i - (session.answered ? 1 : 0);
    const head = boss
      ? `<div class="bosshead"><span class="boss ${session.st.hit ? 'hit' : ''}">🐉</span><div class="pips" aria-label="חיי הבוס">${session.cs.map((_, k) => `<i class="${k < left ? 'on' : ''}"></i>`).join('')}</div></div>`
      : '';
    const dotsRow = boss ? '' : `<div class="progressdots" aria-hidden="true">${session.cs.map((_, k) => `<i class="${k < session.i || (k === session.i && session.answered) ? 'on' : ''}"></i>`).join('')}</div>`;
    return `
      <div class="top">${homeBtn()}${starsPill()}</div>${head}${dotsRow}
      ${draw[c.type](c)}${footer(c)}`;
  },

  roundEnd() {
    const boss = session.mode === 'boss';
    return `
      <div class="top">${homeBtn()}${starsPill()}</div>
      <div class="center"><div class="big">${boss ? '🏆' : '🌟'}</div><h1>${boss ? 'ניצחת את הבוס!' : 'כל הכבוד!'}</h1>
        <p class="sub">הרווחת ${session.stars} כוכבים הפעם</p></div>
      <div class="stack"><button class="next static" data-go="${session.mode}">${boss ? 'עוד קרב' : 'עוד סבב'} ▶</button>
        <button class="labbtn" data-go="home">🗺 חזרה למפה</button></div>`;
  },

  lab() {
    const empty = lab.seq.length === 0;
    const chars = lab.seq.map((t, i) => `<span class="c ${i === lab.seq.length - 1 ? 'last' : ''}">${esc(t)}</span>`).join('');
    const shown = display(lab.seq);
    const p = lab.pending;
    const last = lab.seq[lab.seq.length - 1];
    const options = p
      ? [{ id: null, name: 'בלי ניקוד' }, ...VOWELS].map((v) => {
        const tok = makeToken(p, v.id);
        return `<button class="${tok === last ? 'on' : ''}" data-v="${v.id || ''}" aria-label="${v.name}">${esc(tok)}</button>`;
      }).join('')
      : '';
    const panel = p
      ? `<div class="vlab">בחרו ניקוד ל־${p}</div><div class="vow">${options}</div>`
      : `<div class="vhint">לחצו על אות ואז בחרו ניקוד</div>`;
    const keys = LETTERS.map((l) => `<button class="k" data-k="${l.ch}">${l.ch}</button>`).join('');
    return `
      <div class="top">${homeBtn()}<div class="pill">🧪 מעבדה</div></div>
      <div class="seqbox" aria-live="polite">${empty ? `<div class="ph">לחצו על אותיות<br>ובנו מה שבא לכם</div>` : chars + '<span class="cur"></span>'}</div>
      <div class="acts">
        <button class="act play ${empty ? 'off' : ''}" data-play ${empty ? 'disabled' : ''}>🔊 השמע</button>
        <button class="act ${empty ? 'off' : ''}" data-del aria-label="מחק אות" ${empty ? 'disabled' : ''}>⌫</button>
        <button class="act ${empty ? 'off' : ''}" data-clr aria-label="נקה הכול" ${empty ? 'disabled' : ''}>🗑</button></div>
      <div class="vpanel">${panel}</div>
      <div class="keys">${keys}</div>${ttsNote()}<span hidden id="shown">${esc(shown)}</span>`;
  },
};

// ---- routing ----
function current() { return (location.hash.slice(1) || 'home').split('?')[0]; }
function render() {
  if (stopArena) { stopArena(); stopArena = null; }
  const name = current();
  if (MODES.includes(name) && (!session || session.mode !== name || session.done)) startSession(name);
  const fn = MODES.includes(name) ? screens.play : (screens[name] || screens.home);
  app.innerHTML = fn();
  app.dataset.screen = name;
  app.classList.toggle('boss', name === 'boss');
  if (MODES.includes(name)) {
    const c = session.cs[session.i];
    if (c.type === 'bubbles' && !session.answered) mountArena(c);
    if (!session.answered && !session.spoken) { session.spoken = true; say(); }
  }
}
function mountArena(c) {
  stopArena = startArena(document.getElementById('arena'), c, {
    onTap: (l) => audio.play([[`letter-sound/${LETTER_ID[l]}`, l]]),
    onHit: (n) => {
      session.st.hits = n;
      document.querySelectorAll('.hits i').forEach((dot, k) => dot.classList.toggle('on', k < n));
    },
    onWrong: () => { session.misses++; },
    onDone: () => finishChallenge(),
  });
}
function go(name) {
  if (current() === name) render(); else location.hash = name;
}
window.addEventListener('hashchange', () => { audio.stop(); render(); });

// ---- games ----
function startSession(mode) {
  session = { mode, cs: buildSession(mode), i: 0, stars: 0, misses: 0, answered: false, done: false, spoken: false, st: freshState() };
}
function say() {
  const c = session.cs[session.i];
  const word = [`word/${c.word?.id}`, c.word?.he];
  const items = {
    starts: [['prompt/which-starts-with', 'איזו תמונה מתחילה בצליל'], [`letter-sound/${LETTER_ID[c.letter]}`, c.letter]],
    bubbles: [['prompt/pop-letter', 'פוצצו את הבועות עם האות'], [`letter-sound/${LETTER_ID[c.letter]}`, c.letter]],
    build: [['prompt/build-word', 'בנו את המילה'], word],
    syllable: [['prompt/feed-monster', 'האכילו את המפלצת'], word],
  }[c.type];
  audio.play(items);
}
function finishChallenge() {
  session.answered = true;
  session.st.hit = true;
  const c0 = session.cs[session.i];
  if (session.misses < (c0.type === 'bubbles' ? 3 : 2)) { session.stars++; progress.addStar(); }
  render();
  const c = session.cs[session.i];
  audio.play(c.word ? [[`word/${c.word.id}`, c.word.he], ['prompt/well-done', 'כל הכבוד']] : [['prompt/well-done', 'כל הכבוד']]);
}
// A wrong answer never ends in failure: after two misses the right answer is shown.
async function wrong(marker, speakItems) {
  session.misses++;
  session.st.picked = marker;
  audio.play(speakItems.concat([['prompt/try-again', 'כמעט! נסו שוב']]));
  render();
  await sleep(700);
  if (session && session.st.picked === marker && !session.answered) { session.st.picked = null; if (MODES.includes(current())) render(); }
}
function chooseOption(i) { // starts
  const c = session.cs[session.i], w = c.options[i];
  if (w === c.target) return finishChallenge();
  if (session.misses + 1 >= 2) { session.misses++; return finishChallenge(); }
  return wrong(i, [[`word/${w.id}`, w.he]]);
}
function tapTile(i) { // build and syllable
  const c = session.cs[session.i], st = session.st;
  const piece = c.tray[i];
  const ok = c.type === 'build' ? buildAccepts(c, st.placed, piece) : syllableAccepts(c, st.placed, piece);
  const say1 = c.type === 'build' ? [[`letter-sound/${LETTER_ID[piece]}`, piece]] : [[null, piece]];
  if (!ok) {
    if (session.misses + 1 >= 2) { // show the right tile instead of failing
      session.misses++;
      const right = c.tray.findIndex((t, k) => !st.used.includes(k) && (c.type === 'build' ? buildAccepts(c, st.placed, t) : syllableAccepts(c, st.placed, t)));
      return placeTile(right, c, st);
    }
    return wrong(i, say1);
  }
  return placeTile(i, c, st);
}
function placeTile(i, c, st) {
  st.used.push(i); st.placed++; st.picked = null;
  const total = c.type === 'build' ? c.slots.length : c.parts.length;
  if (st.placed >= total) return finishChallenge();
  audio.play(c.type === 'build' ? [[`letter-sound/${LETTER_ID[c.tray[i]]}`, c.tray[i]]] : [[null, c.tray[i]]]);
  render();
}
function next() {
  if (session.i + 1 >= session.cs.length) {
    session.done = true; progress.addRound(session.mode);
    audio.play([['prompt/well-done', 'כל הכבוד']]);
    app.innerHTML = screens.roundEnd(); app.dataset.screen = 'roundEnd';
    return;
  }
  session.i++; session.answered = false; session.misses = 0; session.spoken = false; session.st = freshState();
  render();
}

// ---- lab ----
function tapLetter(ch) {
  if (lab.seq.length >= MAX_TOKENS) return;
  lab.seq = addToken(lab.seq, ch);
  lab.pending = ch;
  audio.play([[`letter-sound/${LETTER_ID[ch]}`, ch]]);
  render();
}
function chooseVowel(vowelId) {
  if (!lab.pending) return;
  lab.seq = applyVowel(lab.seq, lab.pending, vowelId);
  const id = LETTER_ID[lab.pending];
  audio.play([[vowelId ? `syllable/${id}-${vowelId}` : `letter-sound/${id}`, lab.seq[lab.seq.length - 1]]]);
  render();
}
function playLab() {
  const parts = lab.seq.map((t) => {
    const letter = [...t][0];
    const vowel = VOWELS.find((v) => makeToken(letter, v.id) === t);
    return [vowel ? `syllable/${LETTER_ID[letter]}-${vowel.id}` : `letter-sound/${LETTER_ID[letter]}`, t];
  });
  audio.playSequence(parts, display(lab.seq));
}

// ---- events ----
app.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t || t.disabled) return;
  if (t.dataset.go) return go(t.dataset.go);
  if ('say' in t.dataset) return say();
  if ('opt' in t.dataset) return chooseOption(+t.dataset.opt);
  if ('tile' in t.dataset) return tapTile(+t.dataset.tile);
  if ('next' in t.dataset) return next();
  if ('k' in t.dataset) return tapLetter(t.dataset.k);
  if ('v' in t.dataset) return chooseVowel(t.dataset.v || null);
  if ('play' in t.dataset) return playLab();
  if ('del' in t.dataset) { lab.seq = removeLast(lab.seq); lab.pending = null; return render(); }
  if ('clr' in t.dataset) { lab.seq = []; lab.pending = null; audio.stop(); return render(); }
});
// iOS needs a user gesture before it will play anything.
document.addEventListener('pointerdown', () => { audio.state.unlocked = true; }, { once: true });

// Test hook: the state of the lab, for automated checks.
window.__lab = () => ({ seq: lab.seq, shown: display(lab.seq) });
window.__challenge = () => session && { mode: session.mode, i: session.i, c: session.cs[session.i], st: session.st };

audio.init().then(render);
render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
