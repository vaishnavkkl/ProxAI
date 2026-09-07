import { canUseNativeLlm } from '@/utils/app-runtime';

import { emptyRuntime, type LlmRuntime } from './llm-runtime-types';

export * from './llm-runtime-types';

export function getLlmRuntime(): LlmRuntime {
  if (!canUseNativeLlm()) {
    return emptyRuntime();
  }

  try {
    const loaded = require('./llm-runtime-executorch') as typeof import('./llm-runtime-executorch');
    return loaded.getLlmRuntime();
  } catch {
    return emptyRuntime();
  }
}
