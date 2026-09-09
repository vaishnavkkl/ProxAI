import { create } from 'zustand';

import { deleteCoachPin, saveCoachPin } from '@/services/database';
import { MAX_COACH_PINS, summarizeCoachPin, type CoachPin } from '@/utils/coach-pin';

export type CoachBubble = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  at: number;
};

type CoachState = {
  messages: CoachBubble[];
  pins: CoachPin[];
  busy: boolean;
  status: string;
  pendingAsk: string | null;
  epoch: number;
  append: (role: CoachBubble['role'], text: string) => CoachBubble;
  patch: (id: string, text: string) => void;
  setBusy: (busy: boolean) => void;
  setStatus: (status: string) => void;
  setPendingAsk: (pendingAsk: string | null) => void;
  startNewChat: () => void;
  startFreshAsk: (pendingAsk: string) => void;
  replacePins: (pins: CoachPin[]) => void;
  togglePin: (message: CoachBubble) => Promise<void>;
  removePin: (id: string) => Promise<void>;
};

let nextId = 1;
let nextPin = 1;

export const useCoachStore = create<CoachState>((set, get) => ({
  messages: [],
  pins: [],
  busy: false,
  status: '',
  pendingAsk: null,
  epoch: 0,
  append: (role, text) => {
    const bubble: CoachBubble = { id: `coach-${nextId}`, role, text, at: Date.now() };
    nextId += 1;
    set((state) => ({ messages: [...state.messages, bubble] }));
    return bubble;
  },
  patch: (id, text) => {
    set((state) => ({
      messages: state.messages.map((item) => (item.id === id ? { ...item, text } : item)),
    }));
  },
  setBusy: (busy) => set({ busy, status: busy ? 'Reading your ledger…' : '' }),
  setStatus: (status) => set({ status }),
  setPendingAsk: (pendingAsk) => set({ pendingAsk }),
  startNewChat: () => {
    set((state) => ({
      messages: [],
      busy: false,
      status: '',
      pendingAsk: null,
      epoch: state.epoch + 1,
    }));
  },
  startFreshAsk: (pendingAsk) => {
    set((state) => ({
      messages: [],
      busy: false,
      status: '',
      pendingAsk,
      epoch: state.epoch + 1,
    }));
  },
  replacePins: (pins) => set({ pins }),
  togglePin: async (message) => {
    const existing = get().pins.find((pin) => pin.messageId === message.id);
    if (existing) {
      await deleteCoachPin(existing.id);
      set({ pins: get().pins.filter((pin) => pin.id !== existing.id) });
      return;
    }
    const pin: CoachPin = {
      id: `pin-${nextPin}`,
      messageId: message.id,
      summary: summarizeCoachPin(message.text),
      at: Date.now(),
    };
    nextPin += 1;
    await saveCoachPin(pin);
    const next = [pin, ...get().pins];
    const kept = next.slice(0, MAX_COACH_PINS);
    const dropped = next.slice(MAX_COACH_PINS);
    for (const extra of dropped) {
      await deleteCoachPin(extra.id);
    }
    set({ pins: kept });
  },
  removePin: async (id) => {
    await deleteCoachPin(id);
    set({ pins: get().pins.filter((pin) => pin.id !== id) });
  },
}));
