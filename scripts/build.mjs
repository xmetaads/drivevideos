import { copyFile, cp, mkdir, rm } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const filename of ['index.html', 'styles.css', 'config.js', 'app.js']) {
  await copyFile(join(root, filename), join(dist, filename));
}

await cp(join(root, 'vendor'), join(dist, 'vendor'), { recursive: true });

console.log('Static deployment assembled in dist/.');
