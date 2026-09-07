import { create } from 'zustand';

import { takeNewLedgerItems, uniqueLedgerItems, type LedgerItem } from '@/types/ledger';

type SubscriptionState = {
  items: LedgerItem[];
  replaceAll: (items: LedgerItem[]) => void;
  addMany: (items: LedgerItem[]) => void;
};

export const useSubscriptionStore = create<SubscriptionState>((set, get) => ({
  items: [],
  replaceAll: (items) => set({ items: uniqueLedgerItems(items) }),
  addMany: (incoming) => {
    const extra = takeNewLedgerItems(incoming, 'subscription', get().items);
    if (extra.length === 0) {
      return;
    }
    set({ items: [...extra, ...get().items] });
  },
}));

const loaded = useSubscriptionStore.getState().items;
if (loaded.length !== uniqueLedgerItems(loaded).length) {
  useSubscriptionStore.getState().replaceAll(loaded);
}
