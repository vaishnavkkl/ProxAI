/* global __dirname */
// Separate the original logo's two blue components for native UI animation.
const path = require('node:path');
const Jimp = require('jimp-compact');

async function main() {
  const folder = path.resolve(__dirname, '../assets/images');
  const source = await Jimp.read(path.join(folder, 'proxai-logo.jpeg'));
  const sx = source.bitmap.width / 1640;
  const sy = source.bitmap.height / 1536;
  const mark = source.clone().crop(Math.round(375 * sx), Math.round(295 * sy), Math.round(910 * sx), Math.round(630 * sy));
  const { width, height, data } = mark.bitmap;
  const mask = new Uint8Array(width * height);
  for (let i = 0; i < mask.length; i++) {
    mask[i] = data[i * 4 + 2] > 85 && data[i * 4 + 2] > data[i * 4] + 35 ? 1 : 0;
  }
  const components = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start]) continue;
    const pixels = [start];
    mask[start] = 0;
    let left = width, top = height, right = 0, bottom = 0;
    for (let head = 0; head < pixels.length; head++) {
      const i = pixels[head], x = i % width, y = Math.floor(i / width);
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
      for (const next of [x > 0 ? i - 1 : -1, x < width - 1 ? i + 1 : -1, i - width, i + width]) {
        if (next >= 0 && next < mask.length && mask[next]) { mask[next] = 0; pixels.push(next); }
      }
    }
    if (pixels.length > mask.length * 0.02) components.push({ pixels, left, top, right, bottom });
  }
  components.sort((a, b) => a.left - b.left);
  if (components.length !== 2) throw new Error('Expected two separate logo rings. Check the supplied artwork.');
  for (const [index, ring] of components.entries()) {
    const side = Math.max(ring.right - ring.left + 1, ring.bottom - ring.top + 1) + 16;
    const layer = new Jimp(side, side, 0x00000000);
    const offsetX = Math.floor((side - ring.right + ring.left - 1) / 2);
    const offsetY = Math.floor((side - ring.bottom + ring.top - 1) / 2);
    for (const i of ring.pixels) {
      const x = i % width, y = Math.floor(i / width);
      layer.setPixelColor(mark.getPixelColor(x, y), x - ring.left + offsetX, y - ring.top + offsetY);
    }
    await layer.resize(512, 512).writeAsync(path.join(folder, `splash-ring-${index === 0 ? 'left' : 'right'}.png`));
  }
  const wordmark = source.clone().crop(Math.round(335 * sx), Math.round(1015 * sy), Math.round(985 * sx), Math.round(235 * sy));
  wordmark.scan(0, 0, wordmark.bitmap.width, wordmark.bitmap.height, function (_x, _y, i) {
    if (this.bitmap.data[i + 2] < 85 || this.bitmap.data[i + 2] < this.bitmap.data[i] + 35) this.bitmap.data[i + 3] = 0;
  });
  await wordmark.resize(600, Jimp.AUTO).writeAsync(path.join(folder, 'splash-wordmark.png'));
  console.log('Prepared two original ring layers and the original wordmark.');
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
