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

  // A station that is not built yet reacts but does not navigate.
  await page.locator('.stn.soon').first().click();
  assert.equal(await page.locator('.map').count(), 1);

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
  await page.click('[data-v=kamatz]');
  await page.click('[data-k=מ]');
  assert.equal((await page.evaluate(() => window.__lab())).shown, 'םָ', 'final form with vowel');
  await page.click('[data-k=א]');
  assert.equal((await page.evaluate(() => window.__lab())).shown, 'מָאָ', 'the chosen vowel stays selected');
  await page.click('[data-del]');
  assert.equal((await page.evaluate(() => window.__lab()).then((l) => l.seq.length)), 1, 'delete removes letter and vowel');
  await page.click('[data-v=shuruk]'); await page.click('[data-k=ב]');
  await page.screenshot({ path: `${out}/lab-nikud.png` });
  await page.click('[data-play]');
  const said = await page.evaluate(() => window.__said);
  assert.ok(said.some((s) => s.includes('בוּ')), 'sequence read aloud');
  // Hammer the keys: nothing may throw and the length stays capped.
  for (let i = 0; i < 40; i++) await page.click('[data-k=ר]', { delay: 0 });
  assert.ok((await page.evaluate(() => window.__lab().seq.length)) <= 12);
  await page.click('[data-clr]'); await page.click('[data-play]', { force: true, timeout: 500 }).catch(() => {});

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
