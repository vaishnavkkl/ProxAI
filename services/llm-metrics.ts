import { create } from 'zustand';

import {
  summarizeLlmReplyMetrics,
  type LlmReplyMetrics,
  type LlmReplyMetricsInput,
} from '@/utils/llm-metrics';

// One in-memory snapshot per reply. No sampling, history, or message content.
export const useLlmMetricsStore = create<{ lastReply: LlmReplyMetrics | null }>(() => ({
  lastReply: null,
}));

export function recordLlmReplyMetrics(input: LlmReplyMetricsInput) {
  useLlmMetricsStore.setState({ lastReply: summarizeLlmReplyMetrics(input) });
}
