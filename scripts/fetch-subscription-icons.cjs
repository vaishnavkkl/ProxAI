// Build-time download of the publishers' public Google Play app icons; no runtime network requests.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const catalog = fs.readFileSync(path.join(root, 'utils/subscription-apps.ts'), 'utf8');
const apps = [...catalog.matchAll(/\{ id: '([^']+)', name: '([^']+)', packageName: '([^']+)'/g)];
const dir = path.join(root, 'assets/subscription-icons');
fs.mkdirSync(dir, { recursive: true });
const sources = [];
async function main() {
  for (const [, id, name, pkg] of apps) {
    const page = `https://play.google.com/store/apps/details?id=${pkg}&hl=en&gl=IN`;
    try {
      const response = await fetch(page, { signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw new Error(`Listing ${response.status}`);
      const html = await response.text();
      const icon = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/)?.[1];
      if (!icon || !icon.startsWith('https://play-lh.googleusercontent.com/')) throw new Error('No publisher icon');
      const url = icon.replace(/=.+$/, '') + '=w128-h128-rw';
      const image = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!image.ok || !image.headers.get('content-type')?.startsWith('image/')) throw new Error('Invalid image');
      const buffer = Buffer.from(await image.arrayBuffer());
      const ext = buffer.toString('ascii', 8, 12) === 'WEBP' ? 'webp' : buffer[0] === 137 ? 'png' : 'jpg';
      fs.writeFileSync(path.join(dir, `${id}.${ext}`), buffer);
      sources.push({ id, name, page, icon: url, file: `${id}.${ext}` });
      console.log(`${id}: saved (${buffer.length} bytes)`);
    } catch (error) { console.log(`${id}: ${error.message}`); }
  }
  fs.writeFileSync(path.join(dir, 'sources.json'), JSON.stringify(sources, null, 2) + '\n');
  fs.writeFileSync(path.join(root, 'utils/subscription-icons.ts'), '// Publisher icons downloaded from Google Play. See assets/subscription-icons/sources.json.\nexport const SUBSCRIPTION_ICONS: Record<string, number> = {\n' + sources.map(s => `  '${s.id}': require('../assets/subscription-icons/${s.file}'),`).join('\n') + '\n};\n');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
