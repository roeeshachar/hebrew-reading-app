import { LETTERS, LETTER_ID, VOWELS, WORDS } from './content.js';
import { MAX_TOKENS, makeToken, addToken, removeLast, applyVowel, display } from './lab-logic.js';
import { buildRound, ROUND_SIZE } from './rounds.js';
import * as audio from './audio.js';
import * as progress from './progress.js';

const app = document.getElementById('app');
const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- state ----
// pending: the letter just tapped, whose vowel can still be chosen.
let lab = { seq: [], pending: null };
let game = null; // { qs, i, stars, misses, answered, picked }

// ---- shared pieces ----
const homeBtn = (visible = true) =>
  `<button class="round" data-go="home" aria-label="הביתה" ${visible ? '' : 'style="visibility:hidden"'}>🏠</button>`;
const starsPill = () => `<div class="pill" aria-label="כוכבים">⭐ ${progress.get().stars}</div>`;
const ttsNote = () =>
  audio.state.ttsAvailable ? '' : `<div class="notice" role="status">🔇 אין קול עברי במכשיר. אפשר להמשיך לשחק.</div>`;

// ---- screens ----
const screens = {
  home() {
    const p = progress.get();
    const dots = Math.min(3, Math.floor(p.rounds / 2));
    const stn = (x, y, color, icon, name, opts = {}) => `
      <button class="stn ${opts.soon ? 'soon' : ''}" style="left:${x}%;top:${y}%" data-go="${opts.go || ''}" data-soon="${opts.soon ? 1 : ''}">
        <span class="b" style="background:${color}">${icon}${opts.dots != null ? `<span class="dots">${[1, 2, 3].map((i) => `<i class="${i <= opts.dots ? 'on' : ''}"></i>`).join('')}</span>` : ''}</span>
        <span class="n">${name}</span></button>`;
    return `
      <div class="top">${homeBtn(false)}${starsPill()}</div>
      <h1>עולם הקריאה</h1><p class="sub">בוא נשחק באותיות!</p>
      <div class="map">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M70 14 C 20 18, 90 32, 30 38 S 90 58, 32 64 S 80 90, 50 96" stroke="#fff" stroke-width="3" fill="none" stroke-dasharray="1.5 3" vector-effect="non-scaling-stroke" stroke-linecap="round"/></svg>
        ${stn(68, 14, '#ffd966', '🔤', 'מה מתחיל ב־…‏', { go: 'starts', dots })}
        ${stn(30, 36, '#9fe3d0', '🫧', 'בועות האותיות', { soon: 1 })}
        ${stn(68, 58, '#ffb3a7', '🧩', 'בונים מילה', { soon: 1 })}
        ${stn(30, 78, '#c9b8ff', '👾', 'מפלצת ההברות', { soon: 1 })}
        ${stn(68, 93, '#ffa86b', '🐉', 'קרב הבוס', { soon: 1 })}
      </div>
      <button class="labbtn" data-go="lab">🧪 מעבדת המילים</button>${ttsNote()}`;
  },

  starts() {
    const q = game.qs[game.i];
    const opts = q.options.map((w, i) => {
      let cls = 'opt';
      if (game.answered) cls += w === q.target ? ' ok' : ' dim';
      else if (game.picked === i) cls += ' retry';
      return `<button class="${cls}" data-opt="${i}" ${game.answered ? 'disabled' : ''}>${w.emoji}<span>${esc(w.he)}</span></button>`;
    }).join('');
    let banner = '';
    if (game.answered) banner = `<div class="banner good"><span class="e">🎉</span>${esc(q.target.he)}! ${esc(q.target.he)} מתחיל ב־${q.letter}</div><button class="next" data-next>${game.i + 1 === game.qs.length ? 'סיימנו ▶' : 'עוד אחת ▶'}</button>`;
    else if (game.picked != null) banner = `<div class="banner try"><span class="e">🤔</span>כמעט! בוא ננסה עוד פעם</div>`;
    return `
      <div class="top">${homeBtn()}${starsPill()}</div>
      <div class="prompt"><p class="sub">איזו תמונה מתחילה בצליל…</p>
        <button class="sound" data-say aria-label="השמע שוב">${q.letter}<small>🔊</small></button>
        <div class="progressdots" aria-hidden="true">${game.qs.map((_, i) => `<i class="${i < game.i || (i === game.i && game.answered) ? 'on' : ''}"></i>`).join('')}</div></div>
      <div class="opts">${opts}</div>${banner}`;
  },

  roundEnd() {
    const p = progress.get();
    return `
      <div class="top">${homeBtn()}${starsPill()}</div>
      <div class="center"><div class="big">🌟</div><h1>כל הכבוד!</h1>
        <p class="sub">הרווחת ${game.stars} כוכבים הפעם</p></div>
      <div class="stack"><button class="next static" data-go="starts">עוד סבב ▶</button>
        <button class="labbtn" data-go="lab">🧪 למעבדת המילים</button></div>${p.stars ? '' : ''}`;
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
  const name = current();
  if (name === 'starts' && (!game || game.done)) startRound();
  const fn = screens[name] || screens.home;
  app.innerHTML = fn();
  app.dataset.screen = name;
  if (name === 'starts' && !game.answered && game.picked == null && !game.spoken) { game.spoken = true; sayQuestion(); }
}
function go(name) {
  if (current() === name) render(); else location.hash = name;
}
window.addEventListener('hashchange', () => { audio.stop(); render(); });

// ---- games ----
function startRound() {
  game = { qs: buildRound(), i: 0, stars: 0, misses: 0, answered: false, picked: null, done: false, spoken: false };
}
function sayQuestion() {
  const q = game.qs[game.i];
  audio.play([['prompt/which-starts-with', 'איזו תמונה מתחילה בצליל'], [`letter-sound/${LETTER_ID[q.letter]}`, q.letter]]);
}
async function choose(i) {
  const q = game.qs[game.i];
  const w = q.options[i];
  if (w === q.target) {
    game.answered = true;
    if (game.misses < 2) game.stars++;
    if (game.misses < 2) progress.save({ stars: progress.get().stars + 1 });
    render();
    audio.play([[`word/${w.id}`, w.he], ['prompt/well-done', 'כל הכבוד']]);
  } else {
    game.misses++;
    game.picked = i;
    if (game.misses >= 2) { game.answered = true; render(); audio.play([[`word/${q.target.id}`, q.target.he]]); return; }
    render();
    audio.play([[`word/${w.id}`, w.he], ['prompt/try-again', 'כמעט! נסו שוב']]);
    await sleep(700);
    if (game && game.picked === i && !game.answered) { game.picked = null; if (current() === 'starts') render(); }
  }
}
function next() {
  if (game.i + 1 >= game.qs.length) {
    game.done = true; progress.save({ rounds: progress.get().rounds + 1 });
    audio.play([['prompt/well-done', 'כל הכבוד']]);
    app.innerHTML = screens.roundEnd(); app.dataset.screen = 'roundEnd';
    return;
  }
  game.i++; game.answered = false; game.picked = null; game.misses = 0; game.spoken = false;
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
  if (t.dataset.soon) { t.classList.remove('nap'); void t.offsetWidth; t.classList.add('nap'); return; }
  if (t.dataset.go) return go(t.dataset.go);
  if ('say' in t.dataset) return sayQuestion();
  if ('opt' in t.dataset) return choose(+t.dataset.opt);
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

audio.init().then(render);
render();
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
