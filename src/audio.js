// One place that makes sound. Recorded clips come first; the device's Hebrew
// voice (speechSynthesis) is the fallback. Clips are listed in audio/manifest.json,
// so adding a recording needs no code change.

let clips = new Set();
let current = null;
let runId = 0;
export const state = { ttsAvailable: true, unlocked: false };

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
export async function play(items) {
  stop();
  const id = runId;
  for (const [key, text] of items) {
    if (id !== runId) return;
    if (key && clips.has(key)) {
      try { await playClip(key); continue; } catch { /* use TTS below */ }
    }
    if (text) await speak(text);
  }
}

// Whole-sequence playback for the Word Lab: blend recorded syllables when every
// piece exists, otherwise let the device voice read the full text naturally.
export function playSequence(parts, fullText) {
  if (parts.length && parts.every(([key]) => clips.has(key))) return play(parts);
  return play([[null, fullText]]);
}
