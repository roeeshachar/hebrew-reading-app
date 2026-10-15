// Local progress only. Everything is optional: if storage is blocked the app still works.
const KEY = 'reading-world-v1';
let mem = { stars: 0, rounds: {}, readConsent: false };

function normalise(d) {
  const rounds = typeof d.rounds === 'number' ? { starts: d.rounds } : { ...(d.rounds || {}) };
  return { stars: Number(d.stars) || 0, rounds, readConsent: !!d.readConsent };
}
function load() {
  try { return normalise({ ...mem, ...JSON.parse(localStorage.getItem(KEY) || '{}') }); } catch { return normalise(mem); }
}
function write(d) {
  mem = d;
  try { localStorage.setItem(KEY, JSON.stringify(d)); } catch { /* ignore */ }
  return d;
}
export function get() { return (mem = load()); }
export function addStar() { const d = get(); return write({ ...d, stars: d.stars + 1 }); }
export function addRound(mode) { const d = get(); return write({ ...d, rounds: { ...d.rounds, [mode]: (d.rounds[mode] || 0) + 1 } }); }
export function giveReadConsent() { return write({ ...get(), readConsent: true }); }
