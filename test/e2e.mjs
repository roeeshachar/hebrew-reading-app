// End-to-end check in a real browser. Needs: npm i -D playwright, and a Chromium
// (set CHROMIUM=/path/to/chromium if Playwright's own is not installed).
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
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
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  // Spoken text is recorded instead of played, so the test can check what would be said.
  await page.addInitScript(() => {
    window.__said = [];
    window.speechSynthesis.speak = (u) => { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 0); };
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
  await page.waitForSelector('.big');
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
      if (makeMistake) {
        await page.click(`[data-bub="${c.options.find((l) => l !== c.letter)}"]`, { force: true });
        await page.waitForSelector('.banner.try');
        await page.waitForFunction(() => !document.querySelector('.banner.try'));
      }
      await page.click(`[data-bub="${c.letter}"]`, { force: true });
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
    await page.waitForSelector('.big');
    if (mode === 'boss') await page.screenshot({ path: `${out}/boss-win.png` });
    await page.click('[data-go=home]');
    await page.waitForSelector('.map');
    assert.equal(await page.locator(`[data-go=${mode}] .dots i.on`).count(), 1, `${mode} shows one finished round`);
  }
  await page.screenshot({ path: `${out}/home-progress.png` });
  assert.equal(await page.locator('.abg').innerText(), 'אבג', 'first station shows Hebrew letters');

  // --- lab ---
  await page.click('[data-go=lab]');
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
  await page.click('[data-v=kamatz]');
  assert.equal((await page.evaluate(() => window.__lab())).shown, 'ם\u05B8');
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
  for (const route of ['home', 'starts', 'bubbles', 'build', 'syllable', 'boss', 'lab']) {
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

  assert.deepEqual(errors, [], 'no console or page errors');
  console.log('e2e passed');
} catch (e) {
  failed = true; console.error(e); console.error('errors:', errors);
} finally {
  await browser.close(); srv.kill();
  process.exit(failed ? 1 : 0);
}
