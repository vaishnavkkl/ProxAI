/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function fixture(overrides = {}) {
  const calls = [];
  const native = {
    beginChatOcr: async () => { calls.push('begin'); },
    endChatOcr: async () => { calls.push('end'); },
    recognizeChatImage: async (uri, ml) => { calls.push(['ocr', uri, ml]); return 'Extracted text'; },
    ...overrides.native,
  };
  const modules = {
    'expo-image': { Image: { clearMemoryCache: async () => { calls.push('trim'); } } },
    '@/services/finlife-native': { getFinlifeNative: () => native },
    '@/services/image-ocr': { pickImageUri: overrides.pick ?? (async () => { calls.push('pick'); return 'file://photo.jpg'; }) },
    '@/store/settings-store': { useSettingsStore: { getState: () => ({ ocrLanguage: 'ml' }) } },
  };
  const filename = path.resolve(__dirname, '../services/chat-ocr.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: (name) => {
    assert.ok(modules[name], `Unexpected dependency: ${name}`);
    return modules[name];
  } });
  return { capture: exports.captureChatText, calls };
}

test('chat OCR protects the picker first, clears images, returns only text and stops protection', async () => {
  const { capture, calls } = fixture();
  assert.equal(await capture('gallery', () => true), 'Extracted text');
  assert.deepEqual(calls, ['begin', 'trim', 'pick', ['ocr', 'file://photo.jpg', true], 'end']);
  calls.length = 0;
  assert.equal(await capture('camera', () => true), 'Extracted text');
  assert.deepEqual(calls, ['begin', 'trim', 'pick', ['ocr', 'file://photo.jpg', true], 'end']);
});

test('cancel and unmount stop protection without running OCR', async () => {
  const cancelled = fixture({ pick: async () => null });
  assert.equal(await cancelled.capture('gallery', () => true), null);
  assert.deepEqual(cancelled.calls, ['begin', 'trim', 'end']);
  const unmounted = fixture();
  assert.equal(await unmounted.capture('camera', () => false), null);
  assert.deepEqual(unmounted.calls, ['begin', 'trim', 'end']);
  let active = true;
  const leftDuringPicker = fixture({ pick: async () => { active = false; return 'file://photo.jpg'; } });
  assert.equal(await leftDuringPicker.capture('gallery', () => active), null);
  assert.deepEqual(leftDuringPicker.calls, ['begin', 'trim', 'end']);
});

test('OCR and picker errors release protection, and a failed startup never opens the picker', async () => {
  for (const overrides of [
    { native: { recognizeChatImage: async () => { throw new Error('ocr failed'); } } },
    { pick: async () => { throw new Error('picker failed'); } },
    { native: { beginChatOcr: async () => { throw new Error('start failed'); } } },
  ]) {
    const { capture, calls } = fixture(overrides);
    await assert.rejects(capture('gallery', () => true), /failed/);
    assert.equal(calls.at(-1), 'end');
    if (overrides.native?.beginChatOcr) assert.deepEqual(calls, ['end']);
  }
});

test('overlapping scans cannot allocate a second OCR image', async () => {
  let finishPicker;
  const { capture, calls } = fixture({ pick: () => new Promise((resolve) => { finishPicker = resolve; }) });
  const first = capture('gallery', () => true);
  assert.equal(await capture('camera', () => true), null);
  await new Promise((resolve) => setImmediate(resolve));
  finishPicker('file://photo.jpg');
  await first;
  assert.equal(calls.filter((call) => Array.isArray(call) && call[0] === 'ocr').length, 1);
});

test('old native builds do not launch the unsafe chat OCR path', async () => {
  const { capture, calls } = fixture({ native: { recognizeChatImage: undefined } });
  await assert.rejects(capture('camera', () => true), /updated Android build/);
  assert.deepEqual(calls, []);
});
