// Render the real card and chart through Babel and React, with native views stubbed.
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const babel = require('@babel/core');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const cache = new Map();
const shades = new Proxy({}, { get: () => '#000000' });
function NativeView({ children }) { return React.createElement('div', null, children); }
function load(relative) {
  if (cache.has(relative)) return cache.get(relative);
  const filename = path.resolve(__dirname, '..', relative);
  const { code } = babel.transformFileSync(filename, {
    configFile: false, babelrc: false,
    presets: ['babel-preset-expo'],
    plugins: ['babel-plugin-react-compiler'],
  });
  const exports = {};
  cache.set(relative, exports);
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name === 'react-native') return { View: NativeView, Text: NativeView, StyleSheet: { create: (styles) => styles, absoluteFill: {} } };
      if (name === '@/styles') return { colors: { neutral: shades, primary: shades }, borderRadius: { lg: 12 }, spacing: { lg: 16, sm: 8 }, typography: {} };
      if (name.startsWith('@/')) return load(name.slice(2) + (name.includes('format-bytes') ? '.ts' : '.tsx'));
      return require(name);
    },
  }, { filename });
  return exports;
}

const { formatBytes } = load('utils/format-bytes.ts');
assert.equal(typeof formatBytes, 'function');
const { MemoryUsageCard } = load('components/memory-usage-card.tsx');
for (const samples of [[], [64], [64, 80, 72]]) {
  const html = renderToStaticMarkup(React.createElement(MemoryUsageCard, {
    modelMb: 32, usedMb: 64, availMb: 192, totalMb: 256,
    diskMb: 1_640_000_000 / (1024 * 1024), samples,
    deviceUsedMb: 4096, deviceTotalMb: 8192, deviceSamples: samples,
  }));
  assert.match(html, /App heap/);
  assert.match(html, /Device RAM/);
  assert.match(html, /1\.53 GB/);
}
console.log('Memory card renders with empty, first, and multiple samples; byte formatter is callable.');
