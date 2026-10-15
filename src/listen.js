// Listens once through the device's speech recognition.
// On iPhone the audio goes to Apple for transcription and is not kept by this app.
// Resolves with { alternatives: string[], error: string|null }; it never rejects.

const Recognition = () => window.SpeechRecognition || window.webkitSpeechRecognition;
export const canListen = () => !!Recognition();

export function listenOnce({ lang = 'he-IL', timeoutMs = 8000 } = {}) {
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
