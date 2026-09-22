/* global __dirname */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');
const babel = require('@babel/core');

const filename = path.resolve(__dirname, '../services/coach-llm-session.ts');
const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const model = { modelPath: '/model.pte', tokenizerPath: '/tokenizer.json', tokenizerConfigPath: '/config.json' };

function fixture({ loadFails = false } = {}) {
  const calls = { creates: 0, prefills: [], generations: [], configs: [], resets: [], stops: 0, clears: 0, disposed: [], preprocess: null };
  let position = 0;
  let failGeneration = false;
  const runner = {
    reset(pos = 0) { calls.resets.push(pos); position = pos; },
    stop() { calls.stops++; },
    dispose() { calls.disposed.push('runner'); },
    getKVCacheState() { return { pos: position, remainingTokens: 4096 - position, maxSeqLen: 4096, usageRatio: position / 4096 }; },
    prefill(prompt) {
      calls.prefills.push(prompt);
      position += prompt.length;
      failGeneration = prompt.includes('FAIL_TURN');
    },
    generate(prompt, config, onToken) {
      calls.generations.push(prompt);
      calls.configs.push(config);
      position += prompt.length + 12;
      if (failGeneration) throw new Error('generation failed');
      onToken('A useful reply.');
      onToken('<eos>');
      return { numPromptTokens: prompt.length, numGeneratedTokens: 12 };
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
        calls.preprocess = config;
        return {
          process(messages, count, options) {
            const added = count ? messages.slice(-count) : [];
            return added.map(({ role, content }) => `<${role}>${typeof content === 'string' ? content : JSON.stringify(content)}</${role}>`).join('') + (options.addGenPrompt ? '<assistant>' : '');
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
  return { create: exports.createCoachLlmSession, calls, runner };
}

test('Expo Babel compiles coach generation and context reset as background worklets', () => {
  const result = babel.transformFileSync(filename, { configFile: false, babelrc: false, presets: ['babel-preset-expo'] });
  assert.equal((result.code.match(/__workletHash/g) ?? []).length, 2);
});

test('two chat turns reuse weights and commit each assistant once with the next user', async () => {
  const { create, calls } = fixture();
  const session = await create(model, { initialMessages: [{ role: 'system', content: 'Be helpful.' }] });
  const tokens = [];
  const first = await session.sendMessage('FIRST', (token) => tokens.push(token), { maxNewTokens: 256, echo: true });
  assert.equal(calls.prefills.length, 1, 'no second prefill after visible output');
  assert.equal(session.getKVCacheState().pos, calls.prefills[0].length, 'generated tokens are rewound to end of user');
  assert.equal(first.messages[1].content, 'A useful reply.');
  assert.equal(tokens.join(''), 'A useful reply.');
  assert.equal(session.getPendingTokenCount(), 28);
  await session.sendMessage('SECOND');
  assert.equal(calls.creates, 1);
  assert.equal(calls.prefills[1], '<assistant>A useful reply.</assistant><user>SECOND</user>');
  assert.deepEqual(calls.generations, ['<assistant>', '<assistant>']);
  assert.equal(calls.configs[0].echo, false);
  assert.equal(calls.configs[0].maxNewTokens, 256);
  assert.equal(session.getHistory().length, 5);
  assert.deepEqual(calls.disposed, []);
  session.dispose();
  session.dispose();
  assert.deepEqual(calls.disposed, ['runner', 'preprocessor']);
  await assert.rejects(session.sendMessage('DISPOSED'), /disposed/);
});

test('new conversation resets only context and retains weights and system instructions', async () => {
  const { create, calls } = fixture();
  const session = await create(model, { initialMessages: [{ role: 'system', content: 'Be helpful.' }] });
  await session.sendMessage('OLD_CHAT');
  await session.resetContext();
  assert.equal(session.getKVCacheState().pos, 0);
  assert.equal(session.getPendingTokenCount(), 0);
  assert.equal(session.getHistory().length, 1);
  await session.sendMessage('NEW_CHAT');
  assert.equal(calls.prefills[1], '<system>Be helpful.</system><user>NEW_CHAT</user>');
  assert.equal(calls.creates, 1);
  assert.deepEqual(calls.disposed, []);
  session.dispose();
});

test('failed turn rolls back history and KV, while concurrent calls and active disposal are rejected', async () => {
  const { create, calls } = fixture();
  const session = await create(model);
  await session.sendMessage('FIRST');
  const previousPos = session.getKVCacheState().pos;
  const failed = session.sendMessage('FAIL_TURN');
  assert.throws(() => session.dispose(), /Wait for the coach session/);
  await assert.rejects(session.sendMessage('CONCURRENT'), /already running/);
  await assert.rejects(session.resetContext(), /already running/);
  await assert.rejects(failed, /generation failed/);
  assert.equal(session.getKVCacheState().pos, previousPos);
  assert.equal(session.getHistory().length, 2);
  assert.equal(session.getPendingTokenCount(), 28);
  await session.sendMessage('RECOVERED');
  assert.equal(calls.prefills[2], '<assistant>A useful reply.</assistant><user>RECOVERED</user>');
  assert.equal(calls.creates, 1);
  session.dispose();
});

test('Stop during prefill prevents decoding and a later turn can still run', async () => {
  const { create, calls } = fixture();
  const session = await create(model);
  const pending = session.sendMessage('CANCELLED');
  session.stop();
  await assert.rejects(pending, /stopped/);
  assert.equal(calls.generations.length, 0);
  assert.equal(session.getHistory().length, 0);
  assert.equal(session.getKVCacheState().pos, 0);
  await session.sendMessage('NEXT');
  assert.equal(calls.generations.length, 1);
  session.dispose();
});

test('load failure releases resources and multimodal preprocessing options remain intact', async () => {
  const failure = fixture({ loadFails: true });
  await assert.rejects(failure.create(model), /load failed/);
  assert.deepEqual(failure.calls.disposed, ['preprocessor']);
  const { create, calls } = fixture();
  const mediaConfig = { image: { targetShape: [3, 224, 224] } };
  const session = await create({ ...model, modalities: ['image'], preprocessorConfig: mediaConfig });
  assert.equal(calls.preprocess.preprocessorConfig, mediaConfig);
  assert.equal(calls.preprocess.modalities[0], 'image');
  await session.sendMessage(['Read this image', { kind: 'image', image: 'test-buffer' }]);
  assert.match(calls.prefills[0], /test-buffer/);
  session.dispose();
  await assert.rejects(create(model, { toolOpts: {} }), /do not execute tools/);
});
