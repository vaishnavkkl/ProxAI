import type { ParsedItem } from '@/types/llm-output';
import type { IncomingMessage } from '@/utils/bank-parsers';

export type LlmAvailability = {
  status: 'unavailable' | 'available';
  reason: string;
};

export type BatchResult = {
  transactions: number;
  events: number;
  subscriptions: number;
  errors: number;
  skipped: number;
  read?: number;
  calendar?: number;
  mail?: number;
  skipReason?: string;
  moreHistory?: boolean;
};

export type ProgressFn = (progress: number, label: string) => void;

export type CoachTurn = {
  role: 'user' | 'assistant';
  text: string;
};

export type LlmRamState = {
  loaded: boolean;
};

export type LlmRuntime = {
  getAvailability: () => Promise<LlmAvailability>;
  inferUnmatched: (messages: IncomingMessage[], onProgress: ProgressFn) => Promise<ParsedItem[]>;
  verifyMoneyMoves: (messages: IncomingMessage[], onProgress: ProgressFn) => Promise<boolean[]>;
  askCoach: (
    question: string,
    snapshot: string,
    onProgress: ProgressFn,
    history?: CoachTurn[],
  ) => Promise<string>;
  acquireCoachSession: (onProgress: ProgressFn) => Promise<void>;
  releaseCoachSession: () => Promise<void>;
  downloadSelectedModel: (onProgress: ProgressFn) => Promise<void>;
  unloadFromMemory: () => Promise<boolean>;
  getRamState: () => LlmRamState;
};

export const UNAVAILABLE_WEB: LlmAvailability = {
  status: 'unavailable',
  reason: 'On-device model is off in Expo Go. Use a development build for ExecuTorch.',
};

export function emptyRuntime(): LlmRuntime {
  return {
    getAvailability: async () => UNAVAILABLE_WEB,
    inferUnmatched: async () => [],
    verifyMoneyMoves: async (messages) => messages.map(() => true),
    askCoach: async () => '',
    acquireCoachSession: async () => undefined,
    releaseCoachSession: async () => undefined,
    downloadSelectedModel: async () => {
      throw new Error('unavailable');
    },
    unloadFromMemory: async () => false,
    getRamState: () => ({ loaded: false }),
  };
}
