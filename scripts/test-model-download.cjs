/* global __dirname */
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../services/model-download.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
function load(download, cleanup) {
  const output = {};
  const modules = {
    '@/services/finlife-native': { getFinlifeNative: () => ({ cancelModelDownloads: cleanup }) },
    '@/store/model-download-store': { stopModelDownload() {} },
    'react-native-executorch': { download },
  };
  vm.runInNewContext(code, { exports: output, require: (name) => modules[name], AbortController });
  return output;
}

test('file failure aborts sibling downloads and waits for Android removal before returning', async () => {
  const removed = deferred();
  let cleanupCalls = 0, attemptSignal, siblingRunning = false, lateProgress;
  const progress = [];
  const api = load(async (_, options) => {
    attemptSignal = options.signal;
    siblingRunning = true;
    lateProgress = options.onProgress;
    options.signal.addEventListener('abort', () => { siblingRunning = false; });
    throw new Error('tokenizer download failed');
  }, () => ++cleanupCalls === 1 ? Promise.resolve(2) : removed.promise);
  let settled = false;
  const pending = api.downloadModelResources({ model: 'https://test/model', tokenizer: 'https://test/tokenizer' }, { onProgress: (p) => progress.push(p) });
  const rejected = assert.rejects(pending, /tokenizer download failed/).then(() => { settled = true; });
  await new Promise(setImmediate);
  assert.equal(attemptSignal.aborted, true);
  assert.equal(siblingRunning, false);
  assert.equal(cleanupCalls, 2);
  assert.equal(settled, false, 'UI owner must stay pending until native removal completes');
  lateProgress(0.7);
  assert.deepEqual(progress, [], 'Cancelled siblings cannot restore stale progress');
  removed.resolve(1);
  await rejected;
});

test('Stop cancels the whole attempt and removes OS transfers; a later download uses a fresh signal', async () => {
  let cleanups = 0, calls = 0;
  const signals = [];
  const api = load((source, options) => {
    calls++;
    signals.push(options.signal);
    if (calls > 1) return Promise.resolve(source);
    return new Promise((_, reject) => options.signal.addEventListener('abort', () => reject(new Error('DOWNLOAD_ABORTED'))));
  }, async () => { cleanups++; return 1; });
  const controller = new AbortController();
  const stopped = api.downloadModelResources('https://test/model', { signal: controller.signal });
  const rejection = assert.rejects(stopped, /DOWNLOAD_ABORTED/);
  await new Promise(setImmediate);
  controller.abort();
  await rejection;
  assert.equal(signals[0].aborted, true);
  assert.equal(cleanups, 2);
  assert.equal(calls, 1, 'Cancellation never retries the transfer');
  await api.downloadModelResources('https://test/model');
  assert.equal(signals[1].aborted, false);
  assert.equal(cleanups, 2, 'Startup recovery runs once, not during a healthy transfer');
});

test('Stop while startup recovery is pending never starts a network transfer', async () => {
  const recovery = deferred();
  let calls = 0;
  const api = load(async () => { calls++; }, () => recovery.promise);
  const controller = new AbortController();
  const pending = api.downloadModelResources('https://test/model', { signal: controller.signal });
  const rejection = assert.rejects(pending, /DOWNLOAD_ABORTED/);
  controller.abort();
  recovery.resolve(1);
  await rejection;
  assert.equal(calls, 0);
});

test('failed startup cleanup blocks a new transfer and can be retried', async () => {
  let calls = 0, cleanups = 0;
  const api = load(async (source) => { calls++; return source; }, async () => {
    if (++cleanups === 1) throw new Error('DownloadManager unavailable');
    return 0;
  });
  await assert.rejects(api.downloadModelResources('https://test/model'), /DownloadManager unavailable/);
  assert.equal(calls, 0);
  assert.equal(await api.downloadModelResources('https://test/model'), 'https://test/model');
  assert.equal(calls, 1);
});
