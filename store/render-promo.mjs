// Render the existing company icon in code-native SVG artwork. No generated logo.
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const sharpPath = process.argv[2];
if (!sharpPath) throw new Error('Pass the path to an installed sharp module; no dependency is downloaded.');
const { default: sharp } = await import(pathToFileURL(resolve(sharpPath)).href);
const version = JSON.parse(readFileSync('public/manifest.json', 'utf8')).version;
const output = resolve('BuildArtifacts/chrome-web-store', version);
mkdirSync(output, { recursive: true });
const logo = readFileSync('public/icons/icon-128.png').toString('base64');
const bars = [20, 40, 64, 40, 22].map((height, index) => `<rect x="${53 + index * 15}" y="${140 - height / 2}" width="7" height="${height}" rx="3.5" fill="#a5d1ff"/>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280">
<defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="#0b0f16"/><stop offset="1" stop-color="#15375f"/></linearGradient></defs>
<rect width="440" height="280" fill="url(#bg)"/>
<circle cx="220" cy="140" r="112" fill="none" stroke="#3082eb" stroke-width="2" opacity=".3"/>
<circle cx="220" cy="140" r="94" fill="none" stroke="#4692f5" stroke-width="3" opacity=".5"/>
<rect x="145" y="65" width="150" height="150" rx="32" fill="#fff"/>
<image href="data:image/png;base64,${logo}" x="156" y="76" width="128" height="128"/>
${bars}<g transform="translate(245 0)">${bars}</g>
<path d="M344 62v34c0 13-26 17-26 4 0-10 15-14 20-10V55l28-7v12z" fill="#8dbdff"/>
<path d="M102 206v23c0 10-20 13-20 3 0-8 11-11 15-8v-27l20-5v9z" fill="#8dbdff"/>
</svg>`;
writeFileSync(resolve(output, 'promo-small-440x280.svg'), svg);
await sharp(Buffer.from(svg)).flatten({ background: '#0b0f16' }).png().toFile(resolve(output, 'promo-small-440x280.png'));
console.log('Rendered 440x280 promotional PNG and editable SVG; uses the unchanged company bunny icon.');
