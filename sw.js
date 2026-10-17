// Offline shell. Bump VERSION when files change so phones pick up the new copy.
const VERSION = 'v6';
const SHELL = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'src/app.js', 'src/audio.js', 'src/content.js', 'src/lab-logic.js', 'src/rounds.js', 'src/progress.js', 'src/challenges.js', 'src/arena.js', 'src/match.js', 'src/listen.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-180.png',
  ...[400, 700, 800].flatMap((w) => [`fonts/rubik-hebrew-${w}-normal.woff2`, `fonts/rubik-latin-${w}-normal.woff2`]),
];

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
  const fresh = req.url.includes('/audio/');
  e.respondWith(
    fresh
      ? fetch(req).then((r) => { const copy = r.clone(); if (r.ok) caches.open(VERSION).then((c) => c.put(req, copy)); return r; }).catch(() => caches.match(req))
      : caches.match(req).then((hit) => hit || fetch(req)),
  );
});
