// Scans audio/ for .mp3 files and lists them in audio/manifest.json.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = join(fileURLToPath(import.meta.url), '..', '..', 'audio');
async function walk(d) {
  const out = [];
  for (const e of await readdir(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.name.endsWith('.mp3')) out.push(relative(dir, p).replace(/\.mp3$/, ''));
  }
  return out;
}
const clips = (await walk(dir)).sort();
// The version changes whenever a clip is added, replaced or removed, so phones refresh their saved copies.
const hash = createHash('sha1');
for (const c of clips) { hash.update(c); hash.update(await readFile(join(dir, c + '.mp3'))); }
const version = hash.digest('hex').slice(0, 12);
await writeFile(join(dir, 'manifest.json'), JSON.stringify({ version, clips }, null, 2) + '\n');
console.log(`audio/manifest.json: ${clips.length} clips`);
