import type { LLMGenerationStats, LLMKVCacheState } from 'react-native-executorch/llm';

export type LlmReplyMetricsInput = {
  modelLabel: string;
  stats: readonly LLMGenerationStats[];
  requestStartedAtMs: number;
  firstTextAtMs?: number;
  context?: Pick<LLMKVCacheState, 'pos' | 'maxSeqLen'>;
};

export type LlmReplyMetrics = {
  modelLabel: string;
  firstTextMs: number | null;
  decodeTokensPerSecond: number | null;
  contextUsedTokens: number | null;
  contextCapacityTokens: number | null;
};

export function summarizeLlmReplyMetrics(input: LlmReplyMetricsInput): LlmReplyMetrics {
  let decodedTokens = 0;
  let decodeMs = 0;
  for (const stat of input.stats) {
    // Native timestamps use their own clock. Only subtract native from native.
    const elapsed = stat.inferenceEndMs - stat.firstTokenMs;
    const tokens = stat.numGeneratedTokens - 1;
    if (Number.isFinite(elapsed) && elapsed > 0 && Number.isFinite(tokens) && tokens > 0) {
      decodedTokens += tokens;
      decodeMs += elapsed;
    }
  }

  const firstTextMs = input.firstTextAtMs == null
    ? NaN
    : input.firstTextAtMs - input.requestStartedAtMs;
  const context = input.context;
  const hasContext = context != null
    && Number.isFinite(context.pos) && context.pos >= 0
    && Number.isFinite(context.maxSeqLen) && context.maxSeqLen > 0;

  return {
    modelLabel: input.modelLabel,
    firstTextMs: Number.isFinite(firstTextMs) && firstTextMs >= 0 ? firstTextMs : null,
    decodeTokensPerSecond: decodeMs > 0 ? decodedTokens * 1000 / decodeMs : null,
    contextUsedTokens: hasContext ? context.pos : null,
    contextCapacityTokens: hasContext ? context.maxSeqLen : null,
  };
}
