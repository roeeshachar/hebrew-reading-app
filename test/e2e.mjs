// End-to-end check in a real browser. Needs: npm i -D playwright, and a Chromium
// (set CHROMIUM=/path/to/chromium if Playwright's own is not installed).
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
import { LETTER_NAME } from '../src/content.js';
import { mkdir } from 'node:fs/promises';

const PORT = 8123;
const out = process.env.SHOTS || 'test/shots';
await mkdir(out, { recursive: true });
const srv = spawn('node', ['tools/serve.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const base = `http://localhost:${PORT}/`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
const errors = [];
let failed = false;
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  // The repository now holds real recordings; the test wants the fake voice so it can read what is said.
  await ctx.route('**/audio/manifest.json', (r) => r.fulfill({ json: { clips: [] } }));
  const page = await ctx.newPage();
  // This page plays with the flat pictures; software WebGL in a test browser is too slow to chase bubbles.
  await page.route('**/vendor/gl3d.js', (r) => r.abort());
  page.on('pageerror', (e) => errors.push(e.message));
  // (the 3D file is blocked on purpose on this page, which logs one failed load)
  page.on('console', (m) => m.type() === 'error' && !/ERR_FAILED/.test(m.text()) && errors.push(m.text()));
  // Spoken text is recorded instead of played, so the test can check what would be said.
  await page.addInitScript(() => {
    window.__said = [];
    window.speechSynthesis.speak = (u) => { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 0); };
    // Speech recognition: each listen() takes the next scripted outcome from window.__asr.
    window.__asr = [];
    window.SpeechRecognition = window.webkitSpeechRecognition = class {
      start() {
        const next = window.__asr.shift() || { alts: [] };
        setTimeout(() => {
          if (next.error) this.onerror && this.onerror({ error: next.error });
          else if (next.alts.length) this.onresult && this.onresult({ results: [next.alts.map((t) => ({ transcript: t }))] });
          this.onend && this.onend();
        }, 30);
      }
      stop() {}
    };
  });
  await page.goto(base);
  await page.waitForSelector('.map');
  assert.equal(await page.locator('h1').innerText(), 'עולם הקריאה');
  await page.screenshot({ path: `${out}/home.png` });

  // --- starts-with game ---
  await page.click('[data-go=starts]');
  await page.waitForSelector('.opts');
  assert.equal(await page.locator('.opt').count(), 4);
  await page.screenshot({ path: `${out}/question.png` });
  assert.ok((await page.evaluate(() => window.__said)).length >= 1, 'question is spoken');

  for (let round = 0; round < 5; round++) {
    // First answer wrong on question 1 to see the gentle retry.
    if (round === 0) {
      const wrong = await page.evaluate(() => {
        const w = [...document.querySelectorAll('.opt')];
        return w.map((b) => b.querySelector('span').textContent);
      });
      assert.equal(wrong.length, 4);
    }
    const q = await page.evaluate(() => ({ letter: document.querySelector('.sound').firstChild.textContent }));
    const idx = await page.evaluate((letter) => {
      const spans = [...document.querySelectorAll('.opt span')].map((s) => s.textContent);
      return spans.findIndex((t) => [...t][0] === letter);
    }, q.letter);
    assert.ok(idx >= 0, `correct option exists for ${q.letter}`);
    if (round === 0) {
      const other = idx === 0 ? 1 : 0;
      await page.locator('.opt').nth(other).click();
      await page.waitForSelector('.banner.try');
      await page.screenshot({ path: `${out}/try-again.png` });
      await page.waitForFunction(() => !document.querySelector('.banner.try'));
    }
    await page.locator('.opt').nth(idx).click();
    await page.waitForSelector('.banner.good');
    if (round === 0) await page.screenshot({ path: `${out}/correct.png` });
    await page.click('[data-next]');
  }
  await page.waitForSelector('.bigart');
  await page.screenshot({ path: `${out}/round-end.png` });
  assert.match(await page.locator('.pill').innerText(), /\d/);

  // --- every game can be played to the end, with one gentle mistake along the way ---
  async function solveCurrent(makeMistake) {
    const { c } = await page.evaluate(() => window.__challenge());
    if (c.type === 'starts') {
      if (makeMistake) {
        const wrong = c.options.findIndex((o) => o.id !== c.target.id);
        await page.locator('.opt').nth(wrong).click();
        await page.waitForSelector('.banner.try');
        await page.waitForFunction(() => !document.querySelector('.banner.try'));
      }
      await page.locator('.opt').nth(c.options.findIndex((o) => o.id === c.target.id)).click();
    } else if (c.type === 'bubbles') {
      // Pop the letters of the word in order; first shoot one wrong bubble.
      const tap = async (accept) => {
        const p = await page.waitForFunction((accept) => {
          const arena = document.querySelector('#arena').getBoundingClientRect();
          const b = [...document.querySelectorAll('#arena .bub')].find((n) => {
            const r = n.getBoundingClientRect();
            return !n.classList.contains('pop') && !n.classList.contains('bonk') && !n.classList.contains('shot')
              && (accept.is ? n.dataset.letter === accept.is : n.dataset.letter !== accept.not)
              && r.top > arena.top + 8 && r.bottom < arena.bottom - 90 && r.left > arena.left && r.right < arena.right
              && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === n; // not hidden behind another bubble
          });
          if (!b) return null;
          const r = b.getBoundingClientRect();
          return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        }, accept, { timeout: 12000 }).catch(async (err) => {
          const info = await page.evaluate(() => {
            const a = document.querySelector('#arena').getBoundingClientRect();
            return { hits: window.__challenge().st.hits, letters: window.__challenge().c.letters, arena: [a.x, a.y, a.width, a.height].map(Math.round),
              bubs: [...document.querySelectorAll('#arena .bub')].map((n) => { const q = n.getBoundingClientRect(); return [n.dataset.letter, Math.round(q.x), Math.round(q.y), n.className]; }) };
          });
          console.log('TAP FAIL', JSON.stringify(accept), JSON.stringify(info));
          throw err;
        });
        const { x, y } = await p.jsonValue();
        await page.mouse.click(x, y);
      };
      if (makeMistake) { await tap({ not: c.letters[0] }); await page.waitForTimeout(700); }
      for (const letter of c.letters) { await tap({ is: letter }); await page.waitForTimeout(450); }
    } else {
      const { st } = await page.evaluate(() => window.__challenge());
      void st;
      const total = c.type === 'build' ? c.slots.length : c.parts.length;
      const base = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };
      for (let k = 0; k < total; k++) {
        const want = c.type === 'build' ? base[c.slots[k]] || c.slots[k] : c.parts[k];
        const state = await page.evaluate(() => window.__challenge().st.used);
        const idx = c.tray.findIndex((t, n) => t === want && !state.includes(n));
        if (makeMistake && k === 0) {
          const bad = c.tray.findIndex((t, n) => t !== want && !state.includes(n));
          await page.click(`[data-tile="${bad}"]`);
          await page.waitForSelector('.banner.try');
          await page.waitForFunction(() => !document.querySelector('.banner.try'));
        }
        await page.click(`[data-tile="${idx}"]`);
      }
    }
    await page.waitForSelector('.banner.good');
    if (c.type === 'build' || c.type === 'syllable') {
      // The last letter or syllable is said, then the word, then the praise, in that order.
      const lastBase = ({ 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' })[c.slots?.at(-1)] || c.slots?.at(-1);
      const lastPiece = c.type === 'build' ? LETTER_NAME[lastBase] : c.parts.at(-1);
      await page.waitForFunction(() => window.__said.at(-1) === 'כל הכבוד');
      assert.deepEqual((await page.evaluate(() => window.__said)).slice(-3), [lastPiece, c.word.he, 'כל הכבוד'], `${c.type}: the last piece is read before the word`);
    }
  }
  for (const mode of ['bubbles', 'build', 'syllable', 'boss']) {
    await page.goto(base + '#home');
    await page.click(`[data-go=${mode}]`);
    await page.waitForSelector('.top');
    if (mode === 'bubbles') await page.screenshot({ path: `${out}/game-bubbles.png` });
    if (mode === 'build') await page.screenshot({ path: `${out}/game-build.png` });
    if (mode === 'syllable') await page.screenshot({ path: `${out}/game-syllable.png` });
    if (mode === 'boss') await page.screenshot({ path: `${out}/game-boss.png` });
    for (let k = 0; k < 5; k++) {
      await solveCurrent(k === 0);
      if (k === 0 && mode === 'build') await page.screenshot({ path: `${out}/game-build-done.png` });
      await page.click('[data-next]');
    }
    await page.waitForSelector('.bigart');
    if (mode === 'boss') await page.screenshot({ path: `${out}/boss-win.png` });
    await page.click('[data-go=home]');
    await page.waitForSelector('.map');
    assert.equal(await page.locator(`[data-go=${mode}] .dots i.on`).count(), 1, `${mode} shows one finished round`);
  }
  await page.screenshot({ path: `${out}/home-progress.png` });
  assert.equal(await page.locator('[data-go=starts] .ico').getAttribute('alt'), 'אבג', 'first station shows the Hebrew letter blocks');

  // --- read aloud: the monster listens ---
  await page.goto(base + '#home');
  await page.click('[data-go=read]');
  await page.waitForSelector('[data-consent]');
  await page.screenshot({ path: `${out}/read-consent.png` });
  await page.click('[data-consent]');
  await page.waitForSelector('[data-listen]');
  await page.screenshot({ path: `${out}/read-start.png` });
  const say = (...outcomes) => page.evaluate((o) => window.__asr.push(...o), outcomes);
  const wordNow = async () => (await page.evaluate(() => window.__challenge().c)).word.he;
  // 1: silence, then a wrong word (syllables appear), then the right word
  await say({ alts: [] });
  await page.click('[data-listen]');
  await page.waitForFunction(() => document.querySelector('.readmsg').textContent.includes('לא שמעתי'));
  await say({ alts: ['שלום'] });
  await page.click('[data-listen]');
  await page.waitForSelector('.chipsrow');
  await page.screenshot({ path: `${out}/read-scaffold.png` });
  await say({ alts: [await wordNow()] });
  await page.click('[data-listen]');
  await page.waitForSelector('.banner.good');
  await page.screenshot({ path: `${out}/read-correct.png` });
  await page.click('[data-next]');
  // 2: three wrong tries end with the monster reading along, no failure
  await say({ alts: ['אבא'] }, { alts: ['אמא'] }, { alts: ['סבתא'] });
  for (let k = 0; k < 3; k++) {
    await page.click('[data-listen]');
    if (k < 2) await page.waitForFunction((n) => document.querySelector('.readmsg').textContent.includes('כמעט') && true, k);
    else await page.waitForSelector('.banner.good');
    await page.waitForTimeout(80);
  }
  await page.click('[data-next]');
  // 3-5: right first time, with a sentence and a one-letter slip allowed
  for (let k = 0; k < 3; k++) {
    await say({ alts: ['זה ' + (await wordNow())] });
    await page.click('[data-listen]');
    await page.waitForSelector('.banner.good');
    await page.click('[data-next]');
  }
  await page.waitForSelector('.bigart');
  await page.click('[data-go=home]');
  await page.waitForSelector('.map');
  assert.equal(await page.locator('[data-go=read] .dots i.on').count(), 1, 'read shows one finished round');

  // Permission refused: the screen switches to parent mode and still works.
  await page.goto(base + '#read');
  await page.waitForSelector('[data-listen]');
  await say({ error: 'not-allowed' });
  await page.click('[data-listen]');
  await page.waitForSelector('[data-pok]');
  await page.screenshot({ path: `${out}/read-parent.png` });
  await page.click('[data-pok]');
  await page.waitForSelector('.banner.good');

  // --- lab ---
  await page.goto(base + '#lab');
  await page.waitForSelector('.keys');
  assert.equal(await page.locator('[data-play]').isDisabled(), true, 'play disabled when empty');
  await page.screenshot({ path: `${out}/lab-empty.png` });
  for (const ch of 'דלת') await page.click(`[data-k=${ch}]`);
  assert.equal((await page.evaluate(() => window.__lab())).shown, 'דלת');
  await page.screenshot({ path: `${out}/lab-word.png` });
  await page.click('[data-del]');
  assert.equal((await page.evaluate(() => window.__lab())).shown, 'דל');
  await page.click('[data-clr]');
  assert.equal((await page.evaluate(() => window.__lab())).shown, '');
  // The vowel panel is empty until a letter is tapped, then shows that letter with each vowel.
  assert.equal(await page.locator('.vow').count(), 0, 'no vowel panel before a letter');
  await page.click('[data-k=מ]');
  assert.equal(await page.locator('.vow button').count(), 8);
  assert.equal(await page.locator('.vow button').first().innerText(), 'מ');
  assert.equal((await page.evaluate(() => window.__lab())).shown, 'ם', 'final form while it is the last letter');
  assert.equal((await page.evaluate(() => window.__said)).at(-1), LETTER_NAME['מ'], 'tapping a letter in the lab says its name');
  await page.click('[data-v=kamatz]');
  assert.equal((await page.evaluate(() => window.__lab())).shown, 'ם\u05B8');
  assert.equal((await page.evaluate(() => window.__said)).at(-1), 'מָ', 'choosing a vowel says the syllable');
  await page.click('[data-v=""]');
  assert.equal((await page.evaluate(() => window.__said)).at(-1), LETTER_NAME['מ'], 'no vowel says the name again');
  await page.click('[data-v=kamatz]');
  await page.click('[data-v=chirik]'); // try another vowel on the same letter
  assert.equal((await page.evaluate(() => window.__lab())).seq.length, 1, 'vowel replaces, does not add');
  await page.click('[data-k=א]');
  assert.equal((await page.evaluate(() => window.__lab())).shown, 'מִא');
  await page.click('[data-del]');
  assert.equal((await page.evaluate(() => window.__lab()).then((l) => l.seq.length)), 1, 'delete removes the last letter');
  assert.equal(await page.locator('.vow').count(), 0, 'panel closes after delete');
  await page.click('[data-k=ב]'); await page.click('[data-v=shuruk]');
  await page.screenshot({ path: `${out}/lab-nikud.png` });
  await page.click('[data-play]');
  const said = await page.evaluate(() => window.__said);
  assert.ok(said.some((s) => s.includes('בוּ')), 'sequence read aloud');
  // Hammer the keys: nothing may throw and the length stays capped.
  for (let i = 0; i < 40; i++) await page.click('[data-k=ר]', { delay: 0 });
  assert.ok((await page.evaluate(() => window.__lab().seq.length)) <= 12);
  await page.click('[data-clr]'); await page.click('[data-play]', { force: true, timeout: 500 }).catch(() => {});

  // --- every screen fits a small phone without scrolling ---
  await page.setViewportSize({ width: 375, height: 667 });
  for (const route of ['home', 'starts', 'bubbles', 'build', 'syllable', 'read', 'boss', 'lab']) {
    await page.goto(base + '#' + route);
    await page.waitForTimeout(150);
    const over = await page.evaluate(() => {
      const bad = [...document.querySelectorAll('#app *')].filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width && (r.bottom > innerHeight + 1 || r.right > innerWidth + 1 || r.left < -1);
      }).map((el) => el.className || el.tagName);
      return { scroll: document.documentElement.scrollHeight > innerHeight, bad: bad.slice(0, 5) };
    });
    assert.deepEqual(over, { scroll: false, bad: [] }, `${route} fits 375x667`);
  }
  await page.setViewportSize({ width: 390, height: 844 });

  // --- small phone (iPhone SE) ---
  await page.setViewportSize({ width: 375, height: 667 });
  await page.screenshot({ path: `${out}/lab-small.png` });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight);
  assert.equal(overflow, false, 'no scrolling on a small phone');

  // --- no Hebrew voice: still works, shows a note ---
  const p2 = await ctx.newPage();
  await p2.addInitScript(() => { window.speechSynthesis.getVoices = () => [{ lang: 'en-US' }]; });
  await p2.goto(base);
  await p2.waitForSelector('.notice');

  // --- the live 3D layer: it appears, follows the bubbles and can be shot at ---
  const p5 = await ctx.newPage();
  await p5.goto(base + '#bubbles');
  await p5.waitForSelector('.arena.gl-on', { timeout: 20000 });
  assert.equal(await p5.locator('.arena canvas.gl').count(), 1, 'one 3D canvas in the arena');
  const gl = await p5.evaluate(() => { const c = document.querySelector('.arena canvas.gl'); return { w: c.clientWidth, h: c.clientHeight }; });
  assert.ok(gl.w > 200 && gl.h > 200, 'the canvas covers the arena');
  await p5.waitForTimeout(1500);
  await p5.screenshot({ path: `${out}/gl-bubbles.png` });
  await p5.close();
  const p6 = await ctx.newPage();
  await p6.goto(base + '#boss');
  await p6.waitForSelector('.bossgl canvas.gl', { timeout: 20000 });
  await p6.waitForTimeout(1500);
  await p6.screenshot({ path: `${out}/gl-boss.png` });
  await p6.close();

  // --- recorded syllables are blended into one sound; a known word plays from its own clip ---
  const wav = (() => { // 0.3 s of silence, 0.2 s of tone, 0.3 s of silence
    const rate = 8000, n = rate * 0.8, b = Buffer.alloc(44 + n * 2);
    b.write('RIFF', 0); b.writeUInt32LE(36 + n * 2, 4); b.write('WAVEfmt ', 8); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22);
    b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write('data', 36); b.writeUInt32LE(n * 2, 40);
    for (let i = 0; i < n; i++) { const t = i / rate; b.writeInt16LE(t > 0.3 && t < 0.5 ? Math.round(Math.sin(t * 2 * Math.PI * 440) * 12000) : 0, 44 + i * 2); }
    return b;
  })();
  const p7 = await ctx.newPage();
  const asked = [];
  await p7.route('**/audio/manifest.json', (r) => r.fulfill({ json: { clips: ['syllable/dalet-segol', 'syllable/lamed-segol', 'word/delet'] } }));
  await p7.route('**/audio/**/*.mp3', (r) => { asked.push(new URL(r.request().url()).pathname.split('/audio/')[1]); r.fulfill({ body: wav, contentType: 'audio/mpeg' }); });
  await p7.goto(base + '#lab');
  await p7.waitForSelector('.keys');
  await p7.click('[data-k=ד]'); await p7.click('[data-v=segol]');
  await p7.click('[data-k=ל]'); await p7.click('[data-v=segol]');
  asked.length = 0;
  await p7.click('[data-play]');
  await p7.waitForFunction(() => window.__audioState.lastBlend, null, { timeout: 8000 });
  const blend = await p7.evaluate(() => window.__audioState.lastBlend);
  assert.equal(blend.count, 2, 'two syllables were blended');
  assert.ok(blend.total < 2 * 0.6 - 0.03 + 0.1, `the pieces overlap and the silence is trimmed (${blend.total}s)`);
  // spell a word we have a recording of: דֶלֶת
  await p7.click('[data-clr]');
  await p7.click('[data-k=ד]'); await p7.click('[data-v=segol]');
  await p7.click('[data-k=ל]'); await p7.click('[data-v=segol]');
  await p7.click('[data-k=ת]');
  asked.length = 0;
  await p7.evaluate(() => { window.__audioState.lastBlend = null; });
  await p7.click('[data-play]');
  await p7.waitForTimeout(800);
  assert.ok(asked.some((a) => a.startsWith('word/delet')), `the whole-word clip is used (${asked})`);
  assert.equal(await p7.evaluate(() => window.__audioState.lastBlend), null, 'no blending for a known word');
  await p7.close();

  // --- the service worker saves the clips, answers byte ranges like Safari asks, and works offline ---
  const swctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
  const sp = await swctx.newPage();
  await sp.goto(base);
  await sp.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => true), null, { timeout: 15000 });
  await sp.evaluate(async () => { const reg = await navigator.serviceWorker.ready; reg.active.postMessage('save-clips'); });
  const total = await sp.evaluate(async () => (await (await fetch('audio/manifest.json')).json()).clips.length);
  await sp.waitForFunction(async (n) => (await (await caches.open('voice-clips')).keys()).length >= n, total, { timeout: 60000 });
  await sp.reload(); // now controlled by the service worker
  await sp.waitForFunction(() => navigator.serviceWorker.controller);
  await swctx.setOffline(true);
  const probe = await sp.evaluate(async () => {
    const whole = await fetch('audio/letter-name/alef.mp3');
    const part = await fetch('audio/letter-name/alef.mp3', { headers: { Range: 'bytes=0-9' } });
    const man = await fetch('audio/manifest.json');
    return { whole: whole.status, wholeBytes: (await whole.arrayBuffer()).byteLength, part: part.status, partBytes: (await part.arrayBuffer()).byteLength, range: part.headers.get('Content-Range'), manifest: man.status };
  });
  assert.equal(probe.whole, 200, 'a saved clip plays offline');
  assert.equal(probe.part, 206, 'a byte range is answered with 206, as Safari needs');
  assert.equal(probe.partBytes, 10);
  assert.match(probe.range, /^bytes 0-9\/\d+$/);
  assert.equal(probe.manifest, 200, 'the clip list is kept for offline use');
  await swctx.setOffline(false);
  await swctx.close();

  // --- a phone without WebGL still plays the bubbles with the flat pictures ---
  const p4 = await ctx.newPage();
  await p4.addInitScript(() => {
    const orig = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...r) { return /webgl/i.test(type) ? null : orig.call(this, type, ...r); };
  });
  await ctx.route('**/audio/manifest.json', (r) => r.fulfill({ json: { clips: [] } }));
  await p4.goto(base + '#bubbles');
  await p4.waitForSelector('#arena .bub');
  await p4.waitForTimeout(1500);
  assert.equal(await p4.locator('.arena.gl-on').count(), 0, 'no 3D layer without WebGL');
  assert.ok(await p4.locator('#arena .bub').count() >= 6, 'flat bubbles are there');
  await p4.screenshot({ path: `${out}/bubbles-flat.png` });
  await p4.close();

  // --- a browser with no speech recognition goes straight to parent mode ---
  const p3 = await ctx.newPage();
  await p3.addInitScript(() => { window.webkitSpeechRecognition = undefined; window.SpeechRecognition = undefined; });
  await p3.goto(base + '#read');
  await p3.waitForSelector('[data-listen]');
  await p3.click('[data-listen]');
  await p3.waitForSelector('[data-pok]');
  await p3.click('[data-pretry]');
  await p3.waitForSelector('.chipsrow');
  await p3.click('[data-pok]');
  await p3.waitForSelector('.banner.good');

  assert.deepEqual(errors, [], 'no console or page errors');
  console.log('e2e passed');
} catch (e) {
  failed = true; console.error(e); console.error('errors:', errors);
} finally {
  await browser.close(); srv.kill();
  process.exit(failed ? 1 : 0);
}
