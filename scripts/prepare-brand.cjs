/* global __dirname */
// Resize the supplied artwork without redrawing it. Run after replacing the JPEG.
const fs = require('node:fs');
const path = require('node:path');
const Jimp = require('jimp-compact');

async function main() {
  const root = path.resolve(__dirname, '..');
  const assets = path.join(root, 'assets/images');
  const source = await Jimp.read(path.join(assets, 'proxai-logo.jpeg'));
  const background = source.getPixelColor(20, 20);
  const hex = `#${background.toString(16).padStart(8, '0').slice(0, 6)}`;
  // JPEG introduces slight navy variations; flatten only the dark background
  // so its edge blends into the splash without altering the blue artwork.
  source.scan(0, 0, source.bitmap.width, source.bitmap.height, function (x, y, index) {
    if (this.bitmap.data[index] < 30 && this.bitmap.data[index + 2] < 65) this.setPixelColor(background, x, y);
  });
  // The supplied 1640 x 1536 artwork has its symbol above the wordmark.
  const sx = source.bitmap.width / 1640;
  const sy = source.bitmap.height / 1536;
  const mark = source.clone().crop(Math.round(375 * sx), Math.round(295 * sy), Math.round(910 * sx), Math.round(630 * sy));
  const square = new Jimp(1024, 1024, background);
  square.composite(mark.clone().resize(820, Jimp.AUTO), 102, Math.round((1024 - 820 * 630 / 910) / 2));
  await square.writeAsync(path.join(assets, 'icon.png'));
  await square.clone().resize(96, 96).writeAsync(path.join(assets, 'logo-loading.png'));
  await square.clone().resize(48, 48).writeAsync(path.join(assets, 'favicon.png'));
  const splash = source.clone().crop(Math.round(315 * sx), Math.round(280 * sy), Math.round(1010 * sx), Math.round(990 * sy)).background(background).contain(600, 600);
  await splash.writeAsync(path.join(assets, 'splash-icon.png'));
  const foreground = new Jimp(1024, 1024, background);
  foreground.composite(mark.clone().resize(600, Jimp.AUTO), 212, Math.round((1024 - 600 * 630 / 910) / 2));
  await foreground.writeAsync(path.join(assets, 'android-icon-foreground.png'));
  const mono = foreground.clone();
  mono.scan(0, 0, 1024, 1024, function (_x, _y, index) {
    const blue = this.bitmap.data[index + 2];
    this.bitmap.data[index] = 255;
    this.bitmap.data[index + 1] = 255;
    this.bitmap.data[index + 2] = 255;
    this.bitmap.data[index + 3] = Math.round(Math.max(0, Math.min(1, (blue - 65) / 120)) * 255);
  });
  await mono.writeAsync(path.join(assets, 'android-icon-monochrome.png'));
  const configPath = path.join(root, 'app.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  config.expo.android.adaptiveIcon.backgroundColor = hex;
  delete config.expo.android.adaptiveIcon.backgroundImage;
  const splashConfig = config.expo.plugins.find((plugin) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen')[1];
  splashConfig.backgroundColor = hex;
  splashConfig.dark = { backgroundColor: hex };
  fs.writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  fs.writeFileSync(path.join(root, 'styles/brand.ts'), `export const BRAND_BACKGROUND = '${hex}';\n`);
  const res = path.join(root, 'android/app/src/main/res');
  if (fs.existsSync(res)) {
    for (const [density, scale] of [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]]) {
      const folder = path.join(res, `mipmap-${density}`);
      for (const [name, img, size] of [
        ['ic_launcher', square, 48], ['ic_launcher_round', square, 48],
        ['ic_launcher_foreground', foreground, 108], ['ic_launcher_monochrome', mono, 108],
        ['ic_launcher_background', new Jimp(8, 8, background), 108],
      ]) {
        await img.clone().resize(size * scale, size * scale).writeAsync(path.join(folder, `${name}.png`));
        const old = path.join(folder, `${name}.webp`);
        if (fs.existsSync(old)) fs.unlinkSync(old);
      }
      const nativeSplash = new Jimp(288 * scale, 288 * scale, background);
      nativeSplash.composite(splash.clone().resize(200 * scale, 200 * scale), 44 * scale, 44 * scale);
      await nativeSplash.writeAsync(path.join(res, `drawable-${density}`, 'splashscreen_logo.png'));
    }
    for (const name of ['values', 'values-night']) {
      const file = path.join(res, name, 'colors.xml');
      if (fs.existsSync(file)) fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace(/(<color name="(?:splashscreen_background|iconBackground)">)[^<]+/g, `$1${hex}`));
    }
  }
  console.log(`Prepared icon, splash, loading mark and Android resources; background ${hex}`);
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
