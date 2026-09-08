import { create } from 'zustand';

export type ScanSummary = {
  at: number;
  modelLabel: string;
  usedModel: boolean;
  transactions: number;
  events: number;
  subscriptions: number;
  life?: number;
  regex: number;
  model: number;
  dropped: number;
};

type ScanSummaryState = {
  summary: ScanSummary | null;
  replace: (summary: ScanSummary | null) => void;
};

export const useScanSummaryStore = create<ScanSummaryState>((set) => ({
  summary: null,
  replace: (summary) => set({ summary }),
}));
