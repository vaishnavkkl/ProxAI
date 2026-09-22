/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const babel = require('@babel/core');

const filename = path.resolve(__dirname, '../services/stateless-llm-session.ts');
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const model = { modelPath: '/model.pte', tokenizerPath: '/tokenizer.json', tokenizerConfigPath: '/config.json' };

test('Expo Babel compiles native batch execution as a background worklet', () => {
  const result = babel.transformFileSync(filename, {
    configFile: false, babelrc: false, presets: ['babel-preset-expo'],
  });
  assert.match(result.code, /__workletHash/);
});

function fixture({ loadFails = false } = {}) {
  const calls = { creates: 0, prompts: [], configs: [], resets: 0, clears: 0, disposed: [], preprocessorConfig: null };
  let position = 0;
  const runner = {
    reset() { calls.resets++; position = 0; },
    stop() {},
    dispose() { calls.disposed.push('runner'); },
    getKVCacheState() { return { pos: position, remainingTokens: 2048 - position, maxSeqLen: 2048, usageRatio: position / 2048 }; },
    generate(prompt, config, callback) {
      calls.prompts.push(prompt);
      calls.configs.push(config);
      position = 100;
      if (prompt.includes('FAIL_BATCH')) throw new Error('generation failed');
      callback('{"items":[]}');
      callback('<eos>');
      return { numPromptTokens: 20, numGeneratedTokens: 5 };
    },
  };
  const api = {
    RnExecuTorchError: (errorCode, message) => Object.assign(new Error(message), { code: errorCode }),
    createResourceScope() {
      const resources = [];
      return { track(value) { resources.push(value); return value; }, dispose() { for (const item of resources.splice(0).reverse()) item.dispose(); } };
    },
    wrapAsync: (fn) => (...args) => Promise.resolve().then(() => fn(...args)),
    llm: {
      parseTokenizerConfig: () => ({ chatTemplate: 'native-template', eosToken: '<eos>' }),
      createChatPreprocessor(config) {
        calls.preprocessorConfig = config;
        return {
          process(messages, count, options) {
            assert.equal(count, messages.length);
            assert.equal(options.addGenPrompt, true);
            return JSON.stringify(messages);
          },
          clear() { calls.clears++; },
          dispose() { calls.disposed.push('preprocessor'); },
        };
      },
      createLLMRunner() { calls.creates++; if (loadFails) throw new Error('load failed'); return runner; },
    },
  };
  const exports = {};
  vm.runInNewContext(code, {
    exports,
    require(name) {
      if (name === 'react-native-executorch') return api;
      if (name === 'react-native-blob-util') return { default: { fs: { readFile: async () => '{}' } } };
      if (name === 'react-native-worklets') return { scheduleOnRN: (fn, ...args) => fn(...args) };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  }, { filename });
  return { create: exports.createStatelessLlmSession, calls };
}

test('independent batches reuse weights without retaining prior prompts or assistant output', async () => {
  const { create, calls } = fixture();
  const session = await create(model, { initialMessages: [{ role: 'system', content: 'Extract JSON.' }], generationConfig: { maxNewTokens: 700 } });
  const tokens = [];
  const first = await session.sendMessage('FIRST_BATCH', (token) => tokens.push(token));
  await session.sendMessage('SECOND_BATCH', undefined, { maxNewTokens: 900 });
  assert.equal(calls.creates, 1);
  assert.equal(calls.prompts.length, 2);
  assert.match(calls.prompts[1], /Extract JSON\./);
  assert.match(calls.prompts[1], /SECOND_BATCH/);
  assert.doesNotMatch(calls.prompts[1], /FIRST_BATCH|items/);
  assert.equal(tokens.join(''), '{"items":[]}');
  assert.equal(first.messages[1].content, '{"items":[]}');
  assert.equal(calls.configs[0].echo, false);
  assert.equal(calls.configs[0].maxNewTokens, 700);
  assert.equal(calls.configs[1].maxNewTokens, 900);
  assert.equal(session.getKVCacheState().pos, 0);
  assert.equal(session.getHistory().length, 3);
  assert.equal(calls.clears, 2);
  session.dispose();
  session.dispose();
  assert.deepEqual(calls.disposed, ['runner', 'preprocessor']);
  await assert.rejects(session.sendMessage('AFTER_DISPOSE'), /disposed/);
});

test('failed batch resets native context and allows the next batch; active disposal is rejected', async () => {
  const { create, calls } = fixture();
  const session = await create(model);
  const failed = session.sendMessage('FAIL_BATCH');
  assert.throws(() => session.dispose(), /Wait for extraction/);
  await assert.rejects(session.sendMessage('CONCURRENT'), /already running/);
  await assert.rejects(failed, /generation failed/);
  assert.equal(session.getKVCacheState().pos, 0);
  await session.sendMessage('RECOVERED_BATCH');
  assert.doesNotMatch(calls.prompts[1], /FAIL_BATCH/);
  assert.equal(calls.configs[1].maxNewTokens, undefined);
  assert.equal(calls.clears, 2);
  session.dispose();
});

test('construction failure releases preprocessing resources and multimodal options are preserved', async () => {
  const failure = fixture({ loadFails: true });
  await assert.rejects(failure.create(model), /load failed/);
  assert.deepEqual(failure.calls.disposed, ['preprocessor']);
  const { create, calls } = fixture();
  const mediaConfig = { image: { targetShape: [3, 224, 224] } };
  const session = await create({ ...model, modalities: ['image'], preprocessorConfig: mediaConfig });
  assert.equal(calls.preprocessorConfig.preprocessorConfig, mediaConfig);
  assert.equal(calls.preprocessorConfig.modalities[0], 'image');
  await session.sendMessage(['Read this image', { kind: 'image', image: 'test-buffer' }]);
  assert.match(calls.prompts[0], /test-buffer/);
  session.dispose();
});
