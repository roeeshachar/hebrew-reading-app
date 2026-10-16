// Runs tools/generate-audio.mjs against a fake ElevenLabs server.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function run(env, args) {
  return new Promise((resolve) => {
    const p = spawn('node', ['tools/generate-audio.mjs', ...args], { env: { ...process.env, ...env } });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { out += d; });
    p.on('close', (code) => resolve({ code, out }));
  });
}

test('generate-audio sends the voice, model and spoken text, and saves one file per clip', async () => {
  const seen = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      seen.push({ url: req.url, key: req.headers['xi-api-key'], body: JSON.parse(body) });
      res.writeHead(200, { 'content-type': 'audio/mpeg' }).end(Buffer.from('ID3fake'));
    });
  }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const dir = await mkdtemp(join(tmpdir(), 'audio-'));
  const env = { ELEVENLABS_API_KEY: 'k', VOICE_ID: 'v1', MODEL_ID: 'm1', ELEVENLABS_BASE_URL: `http://localhost:${server.address().port}`, AUDIO_DIR: dir };

  const first = await run(env, ['--only', 'sounds', '--limit', '3']);
  assert.equal(first.code, 0, first.out);
  assert.equal(seen.length, 3);
  assert.equal(seen[0].key, 'k');
  assert.match(seen[0].url, /^\/v1\/text-to-speech\/v1\?/);
  assert.equal(seen[0].body.model_id, 'm1');
  assert.equal(seen[0].body.language_code, 'he');
  assert.equal(seen[0].body.text, 'אַ', 'alef is spoken with a patach, not by name');
  assert.equal(seen[1].body.text, 'בְּ', 'a letter sound is the letter with a sheva');
  assert.deepEqual((await readdir(join(dir, 'letter-sound'))).sort(), ['alef.mp3', 'bet.mp3', 'gimel.mp3']);
  assert.equal((await readFile(join(dir, 'letter-sound', 'alef.mp3'))).toString(), 'ID3fake');

  // A second run only makes what is missing.
  seen.length = 0;
  const second = await run(env, ['--only', 'sounds', '--limit', '2']);
  assert.equal(second.code, 0, second.out);
  assert.equal(seen.length, 2);
  assert.equal(seen[0].body.text, 'דְּ', 'dalet comes next: skips the clips that exist');

  // Words are spoken with nikud.
  seen.length = 0;
  await run(env, ['--only', 'words', '--limit', '1']);
  assert.equal(seen[0].body.text, 'בָּנָנָה');

  const dry = await run({ ...env, ELEVENLABS_API_KEY: '', VOICE_ID: '' }, ['--dry-run', '--only', 'prompts']);
  assert.equal(dry.code, 0, dry.out);
  assert.match(dry.out, /would make prompt\/which-starts-with/);
  server.close();
});

test('the default model is v4, and a rejected stability value is retried without it', async () => {
  const seen = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => {
      const b = JSON.parse(body);
      seen.push(b);
      if (b.voice_settings) return res.writeHead(422).end('{"detail":"invalid voice_settings stability"}');
      res.writeHead(200, { 'content-type': 'audio/mpeg' }).end(Buffer.from('ID3'));
    });
  }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const dir = await mkdtemp(join(tmpdir(), 'audio-'));
  const env = { ELEVENLABS_API_KEY: 'k', VOICE_ID: 'v', MODEL_ID: '', ELEVENLABS_BASE_URL: `http://localhost:${server.address().port}`, AUDIO_DIR: dir };
  const r = await run(env, ['--only', 'prompts', '--limit', '1', '--stability', '1']);
  assert.equal(r.code, 0, r.out);
  assert.equal(seen[0].model_id, 'eleven_v4');
  assert.deepEqual(seen[0].voice_settings, { stability: 1 });
  assert.equal(seen[1].voice_settings, undefined, 'retried without stability');
  server.close();
});

test('settings can come from a .env file, and the real environment wins', async () => {
  const { writeFile, rm } = await import('node:fs/promises');
  const seen = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (d) => { body += d; });
    req.on('end', () => { seen.push({ url: req.url, key: req.headers['xi-api-key'], model: JSON.parse(body).model_id }); res.writeHead(200).end(Buffer.from('x')); });
  }).listen(0);
  await new Promise((r) => server.once('listening', r));
  const dir = await mkdtemp(join(tmpdir(), 'audio-'));
  await writeFile('.env', `# comment\nELEVENLABS_API_KEY="from-file"\nexport VOICE_ID='voice-file'\nMODEL_ID=model-file\n`);
  try {
    const env = { ELEVENLABS_API_KEY: '', VOICE_ID: '', ELEVENLABS_BASE_URL: `http://localhost:${server.address().port}`, AUDIO_DIR: dir };
    delete env.MODEL_ID;
    const clean = { ...process.env }; delete clean.ELEVENLABS_API_KEY; delete clean.VOICE_ID; delete clean.MODEL_ID;
    const run2 = (extra) => new Promise((resolve) => {
      const p = spawn('node', ['tools/generate-audio.mjs', '--only', 'prompts', '--limit', '1'], { env: { ...clean, ELEVENLABS_BASE_URL: env.ELEVENLABS_BASE_URL, AUDIO_DIR: dir, ...extra } });
      p.on('close', resolve);
    });
    assert.equal(await run2({}), 0);
    assert.deepEqual(seen[0], { url: '/v1/text-to-speech/voice-file?output_format=mp3_44100_128', key: 'from-file', model: 'model-file' });
    await rm(dir, { recursive: true });
    await mkdtemp(join(tmpdir(), 'audio-'));
    assert.equal(await run2({ VOICE_ID: 'voice-env' }), 0);
    assert.match(seen[1].url, /text-to-speech\/voice-env\?/, 'an exported variable overrides the file');
  } finally {
    await rm('.env', { force: true });
    server.close();
  }
});
