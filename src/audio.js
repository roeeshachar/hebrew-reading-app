// One place that makes sound. Recorded clips come first; the device's Hebrew
// voice (speechSynthesis) is the fallback. Clips are listed in audio/manifest.json,
// so adding a recording needs no code change.

import { trimBounds, blendPlan } from './blend.js';

let clips = new Set();
let current = null;
let runId = 0;
export const state = { ttsAvailable: true, unlocked: false, lastBlend: null };

export async function init() {
  try {
    const res = await fetch('audio/manifest.json', { cache: 'no-cache' });
    if (res.ok) clips = new Set((await res.json()).clips || []);
  } catch { /* offline or no manifest: fall back to TTS */ }
  checkVoices();
  try { speechSynthesis.onvoiceschanged = checkVoices; } catch { /* no TTS */ }
}

function hebrewVoice() {
  try {
    return speechSynthesis.getVoices().find((v) => /^(he|iw)(-|_|$)/i.test(v.lang)) || null;
  } catch { return null; }
}

function checkVoices() {
  try {
    const voices = speechSynthesis.getVoices();
    // iOS fills the voice list late; an empty list is not proof there is no voice.
    state.ttsAvailable = voices.length === 0 ? 'speechSynthesis' in window : !!hebrewVoice();
  } catch { state.ttsAvailable = false; }
}

export const hasClip = (key) => clips.has(key);

export function stop() {
  runId++;
  for (const s of blendSources) { try { s.stop(); } catch { /* already done */ } }
  blendSources = [];
  if (current) { current.pause(); current = null; }
  try { speechSynthesis.cancel(); } catch { /* ignore */ }
}

function playClip(key) {
  return new Promise((resolve, reject) => {
    const a = new Audio(`audio/${key}.mp3`);
    current = a;
    a.onended = () => resolve();
    a.onerror = () => reject(new Error('clip failed'));
    a.play().catch(reject);
  });
}

function speak(text) {
  return new Promise((resolve) => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      const v = hebrewVoice();
      if (v) u.voice = v;
      u.lang = v ? v.lang : 'he-IL';
      u.rate = 0.8;
      u.onend = u.onerror = () => resolve();
      speechSynthesis.speak(u);
    } catch { resolve(); }
  });
}

// items: [[clipKey, fallbackText], ...] played in order. A newer call cancels this one.
let running = Promise.resolve();

// By default a new call cuts off whatever is playing. With { queue: true } it waits
// for the current sound to finish first, so the last syllable is never skipped.
// A later non-queued call still cancels everything, queued or not.
export function play(items, { queue = false } = {}) {
  if (!queue) stop();
  const id = runId;
  const before = queue ? running : Promise.resolve();
  const run = before.then(async () => {
    for (const [key, text] of items) {
      if (id !== runId) return;
      if (key && clips.has(key)) {
        try { await playClip(key); continue; } catch { /* use TTS below */ }
      }
      if (text) await speak(text);
    }
  });
  running = run;
  return run;
}

// ---- running recorded syllables together ----
let ctx = null;
let blendSources = [];
const decoded = new Map(); // clip key -> { buf, start, end }

async function loadForBlend(key) {
  if (decoded.has(key)) return decoded.get(key);
  const res = await fetch(`audio/${key}.mp3`);
  if (!res.ok) throw new Error('missing clip');
  const buf = await ctx.decodeAudioData(await res.arrayBuffer());
  const [start, end] = trimBounds(buf.getChannelData(0), buf.sampleRate);
  const item = { buf, start, end };
  decoded.set(key, item);
  return item;
}

// Plays the clips as one flowing sound: silence trimmed, pieces overlapping slightly, soft edges.
async function playBlend(keys) {
  stop();
  const id = runId;
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') await ctx.resume();
  const items = await Promise.all(keys.map(loadForBlend));
  if (id !== runId) return;
  const durs = items.map((i) => i.end - i.start);
  const plan = blendPlan(durs);
  const t0 = ctx.currentTime + 0.04;
  items.forEach((it, i) => {
    const src = ctx.createBufferSource();
    const g = ctx.createGain();
    const t = t0 + plan.starts[i], d = durs[i], fade = Math.min(0.02, d / 3);
    src.buffer = it.buf;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + fade);
    g.gain.setValueAtTime(1, t + d - fade);
    g.gain.linearRampToValueAtTime(0, t + d);
    src.connect(g).connect(ctx.destination);
    src.start(t, it.start, d);
    blendSources.push(src);
  });
  state.lastBlend = { count: items.length, total: plan.total };
  await new Promise((r) => setTimeout(r, (plan.total + 0.08) * 1000));
}

// Whole-sequence playback for the Word Lab: blend recorded syllables when every piece
// exists (a known word is played from its own clip by the caller), otherwise let the
// device voice read the full text.
export function playSequence(parts, fullText) {
  if (parts.length && parts.every(([key]) => clips.has(key))) {
    const keys = parts.map(([key]) => key);
    return playBlend(keys).catch(() => play(parts));
  }
  return play([[null, fullText]]);
}
