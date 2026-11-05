// Offline shell. Bump VERSION when files change so phones pick up the new copy.
const VERSION = 'v14';
const ART = ['bubble-blue','bubble-pink','bubble-green','cannon-base','cannon-barrel','monster-happy','monster-oh','monster-sad','dragon','icon-starts','icon-bubbles','icon-build','icon-read','star','house','trophy'];
const WORD_ART = ['banana', 'bayit', 'gamal', 'gezer', 'glida', 'delet', 'dag', 'dov', 'halicopter', 'zebra', 'zman', 'chatul', 'chalon', 'tayil', 'yeled', 'yareach', 'kelev', 'kadur', 'limon', 'lev', 'mayim', 'mechonit', 'nachash', 'naal', 'sus', 'sefer', 'etz', 'anan', 'pil', 'perach', 'tsfardea', 'kof', 'kafe', 'rakevet', 'radio', 'shemesh', 'shualcha', 'tapuz', 'tut', 'arye', 'avatiach'];
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'src/app.js', 'src/audio.js', 'src/content.js', 'src/lab-logic.js', 'src/rounds.js', 'src/blend.js', 'src/progress.js', 'src/challenges.js', 'src/arena.js', 'src/match.js', 'src/listen.js',
  'vendor/gl3d.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png',
  ...ART.map((n) => `assets/${n}.webp`),
  ...WORD_ART.map((n) => `assets/words/${n}.webp`),
  ...[400, 700, 800].flatMap((w) => [`fonts/rubik-hebrew-${w}-normal.woff2`, `fonts/rubik-latin-${w}-normal.woff2`]),
];

// ---- the voice clips ----
// Clips are saved whole, once, and played from the phone afterwards (fast, and they work offline).
// Safari asks for audio in byte ranges, so a saved clip is answered with the slice it asked for.
const AUDIO = 'voice-clips';
async function slice(request, response) {
  const range = request.headers.get('range');
  const m = range && /bytes=(\d*)-(\d*)/.exec(range);
  if (!m) return response;
  const buf = await response.arrayBuffer();
  const size = buf.byteLength;
  const start = m[1] === '' ? Math.max(0, size - Number(m[2])) : Number(m[1]);
  const end = m[1] === '' || m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  if (start >= size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
  return new Response(buf.slice(start, end + 1), {
    status: 206, statusText: 'Partial Content',
    headers: { 'Content-Type': response.headers.get('Content-Type') || 'audio/mpeg', 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) },
  });
}
async function clip(request) {
  const cache = await caches.open(AUDIO);
  const url = new URL(request.url).pathname;
  let hit = await cache.match(url);
  if (!hit) {
    const res = await fetch(url); // the whole file, not the range
    if (!res.ok) return res;
    await cache.put(url, res.clone());
    hit = res;
  }
  return slice(request, hit);
}
// The page asks for every clip to be saved (in the background, once). A new manifest version
// means some clip changed, so the saved copies are dropped and fetched again.
async function saveAllClips() {
  try {
    const manifest = await (await fetch('audio/manifest.json', { cache: 'no-cache' })).json();
    const meta = await caches.open('voice-clips-meta');
    const had = await meta.match('version');
    if (had && (await had.text()) !== String(manifest.version)) await caches.delete(AUDIO);
    const cache = await caches.open(AUDIO);
    for (const key of manifest.clips) {
      const url = new URL(`audio/${key}.mp3`, self.registration.scope).pathname;
      if (!(await cache.match(url))) { try { await cache.add(url); } catch { /* try again next time */ } }
    }
    await meta.put('version', new Response(String(manifest.version)));
  } catch { /* offline or no manifest */ }
}
self.addEventListener('message', (e) => { if (e.data === 'save-clips') e.waitUntil(saveAllClips()); });

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// Shell: cache first. Audio and manifest: network first so new recordings show up, cached for offline.
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const path = new URL(req.url).pathname;
  if (path.endsWith('.mp3') && path.includes('/audio/')) { e.respondWith(clip(req).catch(() => fetch(req))); return; }
  if (path.endsWith('/audio/manifest.json')) {
    // network first, so new clips show up; the last copy is kept for offline play
    e.respondWith(fetch(req).then(async (res) => {
      if (res.ok) (await caches.open('voice-clips-meta')).put(path, res.clone());
      return res;
    }).catch(async () => (await (await caches.open('voice-clips-meta')).match(path)) || Response.error()));
    return;
  }
  e.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
});
