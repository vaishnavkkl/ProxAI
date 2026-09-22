import { create } from 'zustand';

import {
  summarizeLlmReplyMetrics,
  type LlmReplyMetrics,
  type LlmReplyMetricsInput,
} from '@/utils/llm-metrics';

// Current runtime usage and throttled decode speed; no message content is stored.
export const useLlmMetricsStore = create<{
  lastReply: LlmReplyMetrics | null;
  context: { used: number; capacity: number; estimated: boolean } | null;
  liveTokensPerSecond: number | null;
  generating: boolean;
}>(() => ({
  lastReply: null,
  context: null,
  liveTokensPerSecond: null,
  generating: false,
}));

export function updateChatContext(used: number, capacity: number, estimated = false) {
  if (!Number.isFinite(used) || !Number.isFinite(capacity) || capacity <= 0) return;
  useLlmMetricsStore.setState({ context: { used: Math.max(0, Math.round(used)), capacity, estimated } });
}

export function clearChatMetrics() {
  useLlmMetricsStore.setState({ context: null, lastReply: null, liveTokensPerSecond: null, generating: false });
}

export function recordLlmReplyMetrics(input: LlmReplyMetricsInput) {
  useLlmMetricsStore.setState({ lastReply: summarizeLlmReplyMetrics(input) });
}
