// Makes the app's sound clips with ElevenLabs text to speech.
// Run it on your own computer; it needs your API key and the network.
//
//   export ELEVENLABS_API_KEY=...   VOICE_ID=...   MODEL_ID=...   (MODEL_ID defaults to eleven_v4)
//   node tools/generate-audio.mjs --only prompts,sounds --limit 6     (a small trial)
//   node tools/generate-audio.mjs                                     (everything)
//
// Clips that already exist are skipped, so you can delete one bad file and run it again.
// Afterwards: npm run audio-manifest
import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLIPS } from '../src/clip-list.js';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const value = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };

const only = value('only')?.split(',');
const limit = Number(value('limit')) || Infinity;
const stability = value('stability') !== undefined ? Number(value('stability')) : undefined;
const dry = flag('dry-run');
const force = flag('force');

const key = process.env.ELEVENLABS_API_KEY;
const voice = process.env.VOICE_ID;
const model = process.env.MODEL_ID || 'eleven_v4';
const language = process.env.LANGUAGE_CODE ?? 'he';
const base = process.env.ELEVENLABS_BASE_URL || 'https://api.elevenlabs.io';
const audioDir = process.env.AUDIO_DIR || join(root, 'audio');

if (!dry && (!key || !voice)) {
  console.error('Set ELEVENLABS_API_KEY and VOICE_ID first (see the top of this file).');
  process.exit(1);
}

const wanted = CLIPS.filter((c) => !only || only.includes(c.group)).filter((c) => force || !existsSync(join(audioDir, `${c.key}.mp3`)));
const todo = wanted.slice(0, limit);
console.log(`${todo.length} clip(s) to make (${wanted.length} missing, ${CLIPS.length} in total). Model ${model}, language ${language || 'auto'}.`);

async function request(text, withLanguage, withSettings) {
  const body = { text, model_id: model };
  if (withLanguage && language) body.language_code = language;
  if (withSettings && stability !== undefined) body.voice_settings = { stability };
  return fetch(`${base}/v1/text-to-speech/${voice}?output_format=mp3_44100_128`, {
    method: 'POST',
    headers: { 'xi-api-key': key, 'content-type': 'application/json', accept: 'audio/mpeg' },
    body: JSON.stringify(body),
  });
}

async function synth(text) {
  let withLanguage = true;
  let withSettings = true;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await request(text, withLanguage, withSettings);
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    const detail = (await res.text()).slice(0, 300);
    if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 1500 * attempt)); continue; }
    // Some models reject a language code; try once without it.
    if (withLanguage && language && res.status >= 400 && /language/i.test(detail)) { withLanguage = false; continue; }
    // A model may not accept a stability value; try once without it.
    if (withSettings && stability !== undefined && res.status >= 400 && /stability|voice_settings/i.test(detail)) { withSettings = false; console.warn('  (stability not accepted by this model, using its default)'); continue; }
    throw new Error(`${res.status} ${detail}`);
  }
  throw new Error('too many retries');
}

let made = 0;
const failed = [];
for (const clip of todo) {
  const file = join(audioDir, `${clip.key}.mp3`);
  if (dry) { console.log(`would make ${clip.key}  ←  ${clip.say}`); continue; }
  try {
    const audio = await synth(clip.say);
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, audio);
    made++;
    console.log(`ok   ${clip.key}  ←  ${clip.say}`);
  } catch (e) {
    failed.push(clip.key);
    console.error(`FAIL ${clip.key}: ${e.message}`);
  }
}
console.log(`\nDone: ${made} made, ${failed.length} failed.${failed.length ? ' Run again to retry: ' + failed.join(', ') : ''}`);
if (!dry && made) console.log('Next: npm run audio-manifest, then commit and push.');
process.exit(failed.length ? 1 : 0);
