import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const sourceOnly = process.argv.includes('--source-only');

const requiredFiles = [
  'index.html',
  'styles.css',
  'config.js',
  'app.js',
  'vercel.json',
  's3-cors.example.json'
];

const vendorFiles = [
  'vendor/streamsaver/2.0.6/StreamSaver.js',
  'vendor/streamsaver/2.0.6/mitm.html',
  'vendor/streamsaver/2.0.6/sw.js',
  'vendor/streamsaver/2.0.6/LICENSE'
];

await Promise.all(requiredFiles.map((filename) => access(join(root, filename))));

if (!sourceOnly) {
  await Promise.all(vendorFiles.map((filename) => access(join(root, filename))));
}

const [html, app, config] = await Promise.all([
  readFile(join(root, 'index.html'), 'utf8'),
  readFile(join(root, 'app.js'), 'utf8'),
  readFile(join(root, 'config.js'), 'utf8')
]);

const forbiddenPatterns = [
  /Google Drive/i,
  /Download Video/i,
  /secureId/i,
  /createElement\(['"]iframe/i,
  /edge-stream/i,
  /bypass/i,
  /stealth/i
];

for (const pattern of forbiddenPatterns) {
  if (pattern.test(`${html}\n${app}\n${config}`)) {
    throw new Error(`Forbidden legacy pattern found: ${pattern}`);
  }
}

const requiredPatterns = [
  /DriveVideoSetup-x64-0\.7\.0\.exe/,
  /event\.isTrusted/,
  /createWriteStream/,
  /DecompressionStream/,
  /AbortController/,
  /pipeTo/,
  /Content-Length/
];

for (const pattern of requiredPatterns) {
  if (!pattern.test(`${html}\n${app}\n${config}`)) {
    throw new Error(`Required implementation pattern missing: ${pattern}`);
  }
}

JSON.parse(await readFile(join(root, 'vercel.json'), 'utf8'));
JSON.parse(await readFile(join(root, 's3-cors.example.json'), 'utf8'));

console.log(
  sourceOnly
    ? 'Source checks passed; vendor assets are checked after npm install.'
    : 'Static transparency and StreamSaver checks passed.'
);
