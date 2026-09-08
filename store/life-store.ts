import { create } from 'zustand';
import { saveItemState, type ItemState } from '@/services/database';
import { isLifeItem, uniqueLedgerItems, type LedgerItem } from '@/types/ledger';

export const useLifeStore = create<{
  items: LedgerItem[];
  states: Record<string, ItemState>;
  replaceAll: (items: LedgerItem[], states?: Record<string, ItemState>) => void;
  addMany: (items: LedgerItem[]) => void;
  update: (id: string, change: ItemState) => Promise<void>;
}>((set, get) => ({
  items: [], states: {},
  replaceAll: (items, states = {}) => set({ items: uniqueLedgerItems(items), states }),
  addMany: (items) => {
    const merged = new Map(get().items.map((item) => [item.id, item]));
    for (const item of items.filter(isLifeItem)) {
      const existing = merged.get(item.id);
      if (!existing || (item.receivedAt ?? 0) >= (existing.receivedAt ?? 0)) merged.set(item.id, item);
    }
    set({ items: [...merged.values()] });
  },
  update: async (id, change) => {
    const next = { ...get().states[id], ...change };
    await saveItemState(id, next);
    set({ states: { ...get().states, [id]: next } });
  },
}));
