// Local progress only. Everything is optional: if storage is blocked the app still works.
const KEY = 'reading-world-v1';
let mem = { stars: 0, rounds: 0 };

function load() {
  try { return { ...mem, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return mem; }
}
export function get() { return (mem = load()); }
export function save(patch) {
  mem = { ...get(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch { /* ignore */ }
  return mem;
}
