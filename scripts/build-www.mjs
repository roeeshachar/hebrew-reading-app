// Copies the web app into www/, the folder Capacitor packs into the iPhone app.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
const ITEMS = ['index.html', 'styles.css', 'manifest.webmanifest', 'src', 'assets', 'vendor', 'fonts', 'icons', 'audio'];
rmSync('www', { recursive: true, force: true });
mkdirSync('www');
for (const item of ITEMS) cpSync(item, `www/${item}`, { recursive: true });
console.log('www/ ready:', ITEMS.join(', '));
