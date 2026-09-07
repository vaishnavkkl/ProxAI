import { create } from 'zustand';

export type CoachBubble = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

type CoachState = {
  messages: CoachBubble[];
  busy: boolean;
  status: string;
  append: (role: CoachBubble['role'], text: string) => void;
  setBusy: (busy: boolean) => void;
  setStatus: (status: string) => void;
  clear: () => void;
};

let nextId = 1;

export const useCoachStore = create<CoachState>((set) => ({
  messages: [],
  busy: false,
  status: '',
  append: (role, text) => {
    const id = `coach-${nextId}`;
    nextId += 1;
    set((state) => ({ messages: [...state.messages, { id, role, text }] }));
  },
  setBusy: (busy) => set({ busy, status: busy ? 'Reading your ledger…' : '' }),
  setStatus: (status) => set({ status }),
  clear: () => set({ messages: [], busy: false, status: '' }),
}));
