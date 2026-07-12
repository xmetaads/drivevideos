import { copyFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const packageRoot = join(projectRoot, 'node_modules', 'streamsaver');
const vendorRoot = join(projectRoot, 'vendor', 'streamsaver', '2.0.6');

await mkdir(vendorRoot, { recursive: true });

for (const filename of ['StreamSaver.js', 'mitm.html', 'sw.js', 'LICENSE']) {
  await copyFile(join(packageRoot, filename), join(vendorRoot, filename));
}

console.log('StreamSaver 2.0.6 assets copied to vendor/streamsaver/2.0.6.');
