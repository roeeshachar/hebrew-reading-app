// Plays every game with the REAL recordings (no fake voice) and reports:
//  - anything the device's own voice had to say (it should be nothing),
//  - how fast the screen answers a tap, and how long a clip takes to start.
// Run: CHROMIUM=... node test/prod-check.mjs   (needs: npm i -D playwright)
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const PORT = 8190;
const srv = spawn('node', ['tools/serve.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 600));
const base = `http://localhost:${PORT}/`;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
await ctx.addInitScript(() => {
  window.__asr = [];
  window.SpeechRecognition = window.webkitSpeechRecognition = class {
    start() { const next = window.__asr.shift() || { alts: [] }; setTimeout(() => { if (next.alts.length) this.onresult && this.onresult({ results: [next.alts.map((t) => ({ transcript: t }))] }); this.onend && this.onend(); }, 20); }
    stop() {}
  };
});
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && !/ERR_FAILED/.test(m.text()) && errors.push(m.text()));
await page.route('**/vendor/gl3d.js', (r) => r.abort()); // flat bubbles: software WebGL is too slow to measure taps
const report = { feedback: [], spoken: {}, missing: [] };
const spokenNow = () => page.evaluate(() => [...window.__audioState.spoken]);
const mark = async (label) => { report.spoken[label] = await spokenNow(); await page.evaluate(() => { window.__audioState.spoken.length = 0; }); };
const timed = async (label, fn, waitFor) => { // from the tap to the screen showing the answer
  const t0 = Date.now(); await fn(); await page.waitForSelector(waitFor, { timeout: 15000 }); report.feedback.push([label, Date.now() - t0]);
};
const base4 = { 'ך': 'כ', 'ם': 'מ', 'ן': 'נ', 'ף': 'פ', 'ץ': 'צ' };

await page.goto(base + '#home');
await page.waitForSelector('.map');
await page.waitForFunction(() => window.__audioState);
// every clip the app can ask for must exist on the server
const { CLIPS } = await import('../src/clip-list.js');
const man = await (await fetch(base + 'audio/manifest.json')).json();
report.missing = CLIPS.filter((c) => !man.clips.includes(c.key)).map((c) => c.key);

async function playMode(mode) {
  await page.goto(base + '#home'); await page.click(`[data-go=${mode}]`); await page.waitForSelector('.top');
  await page.waitForTimeout(400);
  for (let k = 0; k < 5; k++) {
    const { c } = await page.evaluate(() => window.__challenge());
    if (c.type === 'starts') {
      const i = c.options.findIndex((o) => o.id === c.target.id);
      await timed(`${mode}: tap a picture`, () => page.locator('.opt').nth(i).click(), '.banner.good');
    } else if (c.type === 'bubbles') {
      for (const letter of c.letters) {
        const pt = await page.waitForFunction((l) => { const a = document.querySelector('#arena').getBoundingClientRect(); const n = [...document.querySelectorAll('#arena .bub')].find((n) => { const r = n.getBoundingClientRect(); return n.dataset.letter === l && !/pop|bonk|shot/.test(n.className) && r.top > a.top + 8 && r.bottom < a.bottom - 90 && document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === n; }); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, letter, { timeout: 15000 }).then((h) => h.jsonValue());
        const before = await page.evaluate(() => window.__challenge().st.hits);
        const t0 = Date.now(); await page.mouse.click(pt.x, pt.y);
        await page.waitForFunction((n) => window.__challenge().st.hits > n || document.querySelector('.banner.good'), before, { timeout: 8000 });
        report.feedback.push([`${mode}: shoot a bubble`, Date.now() - t0]); await page.waitForTimeout(250);
      }
    } else {
      const total = c.type === 'build' ? c.slots.length : c.parts.length;
      for (let n = 0; n < total; n++) {
        const want = c.type === 'build' ? base4[c.slots[n]] || c.slots[n] : c.parts[n];
        const used = await page.evaluate(() => window.__challenge().st.used);
        const idx = c.tray.findIndex((t, j) => t === want && !used.includes(j));
        const t0 = Date.now(); await page.click(`[data-tile="${idx}"]`);
        if (n + 1 < total) await page.waitForFunction((m) => window.__challenge().st.placed > m, n, { timeout: 5000 }); else await page.waitForSelector('.banner.good', { timeout: 8000 });
        report.feedback.push([`${mode}: place a ${c.type === 'build' ? 'letter' : 'syllable'}`, Date.now() - t0]);
      }
    }
    await page.waitForSelector('.banner.good', { timeout: 15000 });
    await page.waitForTimeout(700); // let the praise play
    await page.click('[data-next]');
  }
  await mark(mode);
}

for (const mode of ['starts', 'bubbles', 'build', 'syllable']) await playMode(mode);

// reading aloud
await page.goto(base + '#read'); await page.waitForSelector('[data-consent], [data-listen]');
if (await page.locator('[data-consent]').count()) await page.click('[data-consent]');
await page.waitForSelector('[data-listen]');
for (let k = 0; k < 5; k++) {
  const { c } = await page.evaluate(() => window.__challenge());
  await page.evaluate((w) => window.__asr.push({ alts: [w] }), c.word.he);
  await timed('read: say a word', () => page.click('[data-listen]'), '.banner.good');
  await page.waitForTimeout(700); await page.click('[data-next]');
}
await mark('read');

// the word lab: letters, vowels, a blended syllable pair, and a known word
await page.goto(base + '#lab'); await page.waitForSelector('.keys');
await page.click('[data-k=ד]'); await page.waitForTimeout(500);
await page.click('[data-v=segol]'); await page.waitForTimeout(500);
await page.click('[data-k=ל]'); await page.click('[data-v=chirik]'); await page.waitForTimeout(500);
await page.click('[data-play]'); await page.waitForTimeout(1500);
await page.click('[data-clr]');
for (const [k, v] of [['ד', 'segol'], ['ל', 'segol']]) { await page.click(`[data-k=${k}]`); await page.click(`[data-v=${v}]`); }
await page.click('[data-k=ת]'); await page.click('[data-play]'); await page.waitForTimeout(1500);
await mark('lab');

await playMode('boss');
const lat = await page.evaluate(() => window.__audioState.latency);
const stat = (xs) => { const s = [...xs].sort((a, b) => a - b); return xs.length ? { n: xs.length, median: s[Math.floor(s.length / 2)], worst: s.at(-1) } : null; };
const byLabel = {};
for (const [l, ms] of report.feedback) (byLabel[l] ||= []).push(ms);
console.log('\n== Screen answer after a tap (ms) ==');
for (const [l, xs] of Object.entries(byLabel)) console.log(l.padEnd(34), JSON.stringify(stat(xs)));
console.log('\n== Clip start latency (ms) ==', JSON.stringify(stat(lat)));
console.log('\n== Clips the app asks for but the server lacks ==', report.missing.length ? report.missing : 'none');
console.log('\n== Spoken by the device voice (should be empty) ==');
let spokenTotal = 0;
for (const [l, xs] of Object.entries(report.spoken)) { spokenTotal += xs.length; console.log(l.padEnd(10), xs.length ? JSON.stringify([...new Set(xs)]) : 'none'); }
console.log('\nerrors:', errors.length ? errors : 'none');
await browser.close(); srv.kill();
process.exit(spokenTotal || report.missing.length || errors.length ? 1 : 0);
