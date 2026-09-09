import type { LLMChatSession, LLMChatSessionOptions, LLMModel, llm } from 'react-native-executorch';
import { scheduleOnRN } from 'react-native-worklets';

/** One independent batch per call, while keeping the expensive model weights loaded. */
function generateBatch(
  runner: llm.LLMRunner,
  prompt: llm.Prompt,
  config: llm.LLMGenerationConfig,
  eosToken: string,
  stopRegex?: RegExp,
  onToken?: (token: string) => void,
) {
  'worklet';
  let response = '';
  runner.reset();
  try {
    // generate() prefills this complete prompt before producing new tokens.
    const stats = runner.generate(prompt, config, (token) => {
      if (token === eosToken) return;
      response += token;
      if (onToken) scheduleOnRN(onToken, token);
      if (stopRegex) {
        stopRegex.lastIndex = 0;
        if (stopRegex.test(response)) runner.stop();
      }
    });
    return { response, stats };
  } finally {
    // Batch outputs never become context for an unrelated SMS batch.
    runner.reset();
  }
}

export async function createStatelessLlmSession(
  model: LLMModel,
  options: LLMChatSessionOptions = {},
): Promise<LLMChatSession> {
  // Keep native module evaluation behind the app's availability check.
  const { llm: nativeLlm, createResourceScope, wrapAsync, RnExecuTorchError } =
    require('react-native-executorch') as typeof import('react-native-executorch');
  const blob = (require('react-native-blob-util') as typeof import('react-native-blob-util')).default;
  if (options.toolOpts) {
    throw RnExecuTorchError('INVALID_ARGUMENT', 'Stateless extraction does not execute tools.');
  }

  const scope = createResourceScope();
  try {
    const rawConfig = await blob.fs.readFile(model.tokenizerConfigPath, 'utf8');
    const { chatTemplate, eosToken } = nativeLlm.parseTokenizerConfig(JSON.parse(rawConfig));
    const preprocessor = scope.track(nativeLlm.createChatPreprocessor({
      chatTemplate,
      modalities: model.modalities,
      preprocessorConfig: model.preprocessorConfig,
    }));
    const runner = scope.track(await wrapAsync(nativeLlm.createLLMRunner)(
      model.modelPath, model.tokenizerPath, model.modalities,
    ));
    const runBatch = wrapAsync(generateBatch);
    const initialMessages = [...(options.initialMessages ?? [])];
    let history: readonly llm.ChatMessage[] = initialMessages;
    let busy = false;
    let disposed = false;

    return {
      stop: () => { if (!disposed) runner.stop(); },
      dispose: () => {
        if (disposed) return;
        if (busy) throw RnExecuTorchError('INVALID_STATE', 'Wait for extraction to stop before disposing it.');
        scope.dispose();
        disposed = true;
      },
      getHistory: () => [...history],
      getKVCacheState: () => runner.getKVCacheState(),
      sendMessage: async (message, onToken, config) => {
        if (disposed || busy) {
          throw RnExecuTorchError('INVALID_STATE', disposed ? 'Extraction session is disposed.' : 'Extraction is already running.');
        }
        busy = true;
        history = initialMessages;
        try {
          const userMessage: llm.ChatMessage = { role: 'user', content: message };
          const input = [...initialMessages, userMessage];
          const prompt = preprocessor.process(input, input.length, { addGenPrompt: true });
          const result = await runBatch(runner, prompt, {
            echo: false,
            ignoreEos: false,
            temperature: 0,
            ...options.generationConfig,
            ...config,
          }, eosToken, options.stopRegex, onToken);
          const messages: llm.ChatMessage[] = [userMessage, { role: 'assistant', content: result.response }];
          history = [...initialMessages, ...messages];
          return { messages, stats: [result.stats], finishReason: 'stop' };
        } finally {
          // Release media tensors after native generation, including failed calls.
          busy = false;
          preprocessor.clear();
        }
      },
    };
  } catch (error) {
    scope.dispose();
    throw error;
  }
}
