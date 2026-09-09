import type { LLMChatSession, LLMChatSessionOptions, LLMModel, llm } from 'react-native-executorch';
import { scheduleOnRN } from 'react-native-worklets';

export type CoachLlmSession = LLMChatSession & {
  /** Clears conversation tokens while retaining model weights and tokenizer. */
  resetContext(): Promise<void>;
  /** Last reply tokens that will join KV when the next user turn is prefetched. */
  getPendingTokenCount(): number;
};

function resetRunner(runner: llm.LLMRunner, position = 0) {
  'worklet';
  runner.reset(position);
}

function generateReply(
  runner: llm.LLMRunner,
  prompt: llm.Prompt,
  config: llm.LLMGenerationConfig,
  endOfUser: number,
  eosToken: string,
  stopRegex?: RegExp,
  onToken?: (token: string) => void,
) {
  'worklet';
  let response = '';
  try {
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
    // Generated text needs its chat-template closing delimiters. Rewind now,
    // then commit the complete assistant message together with the next user.
    // This avoids a second prefill after every visible reply.
    runner.reset(endOfUser);
  }
}

/** Incremental chat with explicit context reset, independent of model lifetime. */
export async function createCoachLlmSession(
  model: LLMModel,
  options: LLMChatSessionOptions = {},
): Promise<CoachLlmSession> {
  const { llm: nativeLlm, createResourceScope, wrapAsync, RnExecuTorchError } =
    require('react-native-executorch') as typeof import('react-native-executorch');
  const blob = (require('react-native-blob-util') as typeof import('react-native-blob-util')).default;
  if (options.toolOpts) {
    throw RnExecuTorchError('INVALID_ARGUMENT', 'Coach sessions do not execute tools.');
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
    const prefill = wrapAsync(runner.prefill);
    const reset = wrapAsync(resetRunner);
    const generate = wrapAsync(generateReply);
    const initialMessages = [...(options.initialMessages ?? [])];
    const history: llm.ChatMessage[] = [...initialMessages];
    // Initial system context is prefetched with the first user prompt.
    let committed = 0;
    let pendingTokenCount = 0;
    let busy = false;
    let disposed = false;
    let stopVersion = 0;

    const assertIdle = () => {
      if (disposed || busy) {
        throw RnExecuTorchError('INVALID_STATE', disposed ? 'Coach session is disposed.' : 'Coach session is already running.');
      }
    };

    return {
      stop: () => {
        stopVersion += 1;
        if (!disposed) runner.stop();
      },
      dispose: () => {
        if (disposed) return;
        if (busy) throw RnExecuTorchError('INVALID_STATE', 'Wait for the coach session to stop before disposing it.');
        scope.dispose();
        disposed = true;
      },
      getHistory: () => [...history],
      getKVCacheState: () => runner.getKVCacheState(),
      getPendingTokenCount: () => pendingTokenCount,
      resetContext: async () => {
        assertIdle();
        busy = true;
        try {
          await reset(runner);
          history.splice(0, history.length, ...initialMessages);
          committed = 0;
          pendingTokenCount = 0;
        } finally {
          preprocessor.clear();
          busy = false;
        }
      },
      sendMessage: async (message, onToken, config) => {
        assertIdle();
        busy = true;
        const version = stopVersion;
        const previousCommitted = committed;
        const previousPendingTokenCount = pendingTokenCount;
        const previousPos = runner.getKVCacheState().pos;
        const turnStart = history.length;
        let resetForTurn = false;
        history.push({ role: 'user', content: message });
        try {
          if (options.resetOnTurn) {
            await reset(runner);
            committed = 0;
            resetForTurn = true;
          }
          const startedPrefill = Date.now();
          const userPrompt = preprocessor.process(history, history.length - committed, { addGenPrompt: false });
          await prefill(userPrompt);
          preprocessor.clear();
          if (version !== stopVersion) {
            throw RnExecuTorchError('INVALID_STATE', 'Coach generation stopped.');
          }
          const endOfUser = runner.getKVCacheState().pos;
          committed = history.length;
          pendingTokenCount = 0;
          const prompt = preprocessor.process(history, 0, { addGenPrompt: true });
          const prefillDurationMs = Date.now() - startedPrefill;
          const result = await generate(runner, prompt, {
            temperature: 0,
            ...options.generationConfig,
            ...config,
            // Prompt echo must never enter the conversation history.
            echo: false,
            ignoreEos: false,
          }, endOfUser, eosToken, options.stopRegex, onToken);
          history.push({ role: 'assistant', content: result.response });
          pendingTokenCount = result.stats.numGeneratedTokens + 16;
          return {
            messages: history.slice(turnStart),
            stats: [{ ...result.stats, prefillDurationMs }],
            finishReason: 'stop',
          };
        } catch (error) {
          history.length = turnStart;
          committed = resetForTurn ? 0 : previousCommitted;
          pendingTokenCount = previousPendingTokenCount;
          // A failed turn must not leave a user prefix or partial response in KV.
          await reset(runner, resetForTurn ? 0 : previousPos);
          throw error;
        } finally {
          preprocessor.clear();
          busy = false;
        }
      },
    };
  } catch (error) {
    scope.dispose();
    throw error;
  }
}
