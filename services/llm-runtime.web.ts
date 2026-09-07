import { emptyRuntime, type LlmRuntime } from './llm-runtime-types';

export function getLlmRuntime(): LlmRuntime {
  return emptyRuntime();
}
