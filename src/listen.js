// Listens once through the device's speech recognition.
// On iPhone the audio goes to Apple for transcription and is not kept by this app.
// Resolves with { alternatives: string[], error: string|null }; it never rejects.

const Recognition = () => window.SpeechRecognition || window.webkitSpeechRecognition;
// Inside the iPhone app the web view has no speech recognition, so the native plugin listens instead.
const native = () => (window.Capacitor?.isNativePlatform?.() ? window.Capacitor.registerPlugin('Speech') : null);
export const canListen = () => !!native() || !!Recognition();

async function listenNative(plugin, lang, timeoutMs) {
  try {
    const out = await plugin.listen({ lang, timeoutMs });
    return { alternatives: out.alternatives || [], error: out.error || null };
  } catch {
    return { alternatives: [], error: 'error' };
  }
}

export function listenOnce({ lang = 'he-IL', timeoutMs = 8000 } = {}) {
  const plugin = native();
  if (plugin) return listenNative(plugin, lang, timeoutMs);
  return new Promise((resolve) => {
    const R = Recognition();
    if (!R) return resolve({ alternatives: [], error: 'unsupported' });
    const rec = new R();
    rec.lang = lang;
    rec.interimResults = false;
    rec.continuous = false;
    rec.maxAlternatives = 5;
    const alternatives = [];
    let error = null;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve({ alternatives, error });
    };
    rec.onresult = (e) => {
      for (const result of e.results) for (const alt of result) alternatives.push(alt.transcript);
    };
    rec.onerror = (e) => { error = e.error || 'error'; };
    rec.onend = finish;
    const timer = setTimeout(() => { try { rec.stop(); } catch { /* already stopped */ } setTimeout(finish, 600); }, timeoutMs);
    try { rec.start(); } catch { error = 'error'; finish(); }
  });
}
