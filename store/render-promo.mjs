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
const marqueeLogo = readFileSync('store/assets/phasepal-icon-1024.png').toString('base64');
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
const wave = [28, 42, 76, 112, 62, 38, 92, 152, 202, 138, 74, 116, 168, 94, 48, 74, 116, 62, 32]
  .map((height, index) => `<rect x="${100 + index * 24}" y="${280 - height / 2}" width="8" height="${height}" rx="4" fill="#a5d1ff" opacity="${0.4 + index / 36}"/>`).join('');
const marquee = `<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="560" viewBox="0 0 1400 560">
<defs>
  <linearGradient id="bg" x2="1" y2="1"><stop stop-color="#0b0f16"/><stop offset="1" stop-color="#15375f"/></linearGradient>
  <radialGradient id="glow"><stop stop-color="#3485ed" stop-opacity=".25"/><stop offset="1" stop-color="#3485ed" stop-opacity="0"/></radialGradient>
</defs>
<rect width="1400" height="560" fill="url(#bg)"/>
<ellipse cx="700" cy="280" rx="560" ry="360" fill="url(#glow)"/>
<path d="M60 280h1280" stroke="#78b6ff" stroke-opacity=".12" stroke-width="2"/>
<circle cx="700" cy="280" r="230" fill="none" stroke="#3082eb" stroke-width="2" opacity=".2"/>
<circle cx="700" cy="280" r="205" fill="none" stroke="#3082eb" stroke-width="3" opacity=".35"/>
<circle cx="700" cy="280" r="180" fill="none" stroke="#4692f5" stroke-width="4" opacity=".5"/>
${wave}<g transform="translate(1400 0) scale(-1 1)">${wave}</g>
<rect x="556" y="136" width="288" height="288" rx="58" fill="#fff"/>
<image href="data:image/png;base64,${marqueeLogo}" x="572" y="152" width="256" height="256"/>
<g fill="#8dbdff">
  <path d="M220 118v34c0 13-26 17-26 4 0-10 15-14 20-10v-35l28-7v12z"/>
  <path d="M1174 392v34c0 13-26 17-26 4 0-10 15-14 20-10v-35l28-7v12z"/>
</g>
<g fill="#8dbdff" opacity=".45"><circle cx="344" cy="414" r="4"/><circle cx="1090" cy="140" r="5"/></g>
</svg>`;
writeFileSync(resolve(output, 'promo-marquee-1400x560.svg'), marquee);
await sharp(Buffer.from(marquee)).flatten({ background: '#0b0f16' }).png().toFile(resolve(output, 'promo-marquee-1400x560.png'));
console.log('Rendered 440x280 small and 1400x560 marquee promotional PNGs and editable SVGs; uses the unchanged company bunny icon.');
