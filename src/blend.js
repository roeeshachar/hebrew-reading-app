// Helpers for playing recorded syllables so they run together like a word.
// Pure functions, so they can be tested without a browser.

// Where the sound starts and ends in a clip, in seconds, ignoring the silence the
// recording left at both ends. A few milliseconds are kept so nothing is clipped.
export function trimBounds(samples, rate, { threshold = 0.012, pad = 0.012 } = {}) {
  let s = 0;
  while (s < samples.length && Math.abs(samples[s]) < threshold) s++;
  if (s === samples.length) return [0, samples.length / rate]; // all quiet: leave it alone
  let e = samples.length - 1;
  while (e > s && Math.abs(samples[e]) < threshold) e--;
  return [Math.max(0, s / rate - pad), Math.min(samples.length / rate, (e + 1) / rate + pad)];
}

// When each piece starts, given how long each lasts. Each piece begins a little before the
// previous one ends, which is what makes the sounds join instead of being heard one by one.
export function blendPlan(durations, overlap = 0.03) {
  const starts = [];
  let t = 0;
  durations.forEach((d) => { starts.push(t); t += Math.max(0.05, d - overlap); });
  return { starts, total: durations.length ? starts[starts.length - 1] + durations[durations.length - 1] : 0 };
}
