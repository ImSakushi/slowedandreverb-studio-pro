import { mkdir, copyFile, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
const require = createRequire(import.meta.url);
const vendor = new URL('../extension/vendor/', import.meta.url);
await mkdir(vendor, { recursive: true });
const processor = require.resolve('@soundtouchjs/audio-worklet/processor');
await copyFile(processor, new URL('soundtouch-processor.js', vendor));
await copyFile(`${processor}.map`, new URL('soundtouch-processor.js.map', vendor));
await copyFile(join(dirname(processor), '..', 'LICENSE'), new URL('SOUNDTOUCH-LICENSE', vendor));
// Upstream's source map includes the exact TypeScript sources for the bundle.
const map = JSON.parse(await readFile(`${processor}.map`, 'utf8'));
if (!map.sourcesContent?.every(source => typeof source === 'string')) throw new Error('Missing corresponding upstream sources.');
await writeFile(new URL('SOURCE.json', vendor), JSON.stringify({ package: '@soundtouchjs/audio-worklet', version: '2.1.1', license: 'MPL-2.0', upstream: 'https://github.com/cutterbl/SoundTouchJS', sourceMap: 'soundtouch-processor.js.map', modified: false }, null, 2) + '\n');
for (const size of [16, 48, 128]) await sharp(new URL('../extension/art/mark.svg', import.meta.url).pathname).resize(size, size).png().toFile(new URL(`../extension/art/icon${size}.png`, import.meta.url).pathname);
console.log('Prepared extension/: icons, pinned audio worklet, license and corresponding source.');
