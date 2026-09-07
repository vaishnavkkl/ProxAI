import { create } from 'zustand';

import { takeNewLedgerItems, uniqueLedgerItems, type LedgerItem } from '@/types/ledger';

type EventState = {
  items: LedgerItem[];
  replaceAll: (items: LedgerItem[]) => void;
  addMany: (items: LedgerItem[]) => void;
};

export const useEventStore = create<EventState>((set, get) => ({
  items: [],
  replaceAll: (items) => set({ items: uniqueLedgerItems(items) }),
  addMany: (incoming) => {
    const extra = takeNewLedgerItems(incoming, 'event', get().items);
    if (extra.length === 0) {
      return;
    }
    set({ items: [...extra, ...get().items] });
  },
}));

const loaded = useEventStore.getState().items;
if (loaded.length !== uniqueLedgerItems(loaded).length) {
  useEventStore.getState().replaceAll(loaded);
}
