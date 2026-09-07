import { create } from 'zustand';

import { takeNewLedgerItems, uniqueLedgerItems, type LedgerItem } from '@/types/ledger';

type TransactionState = {
  items: LedgerItem[];
  replaceAll: (items: LedgerItem[]) => void;
  addMany: (items: LedgerItem[]) => void;
};

export const useTransactionStore = create<TransactionState>((set, get) => ({
  items: [],
  replaceAll: (items) => set({ items: uniqueLedgerItems(items) }),
  addMany: (incoming) => {
    const extra = takeNewLedgerItems(incoming, 'transaction', get().items);
    if (extra.length === 0) {
      return;
    }
    set({ items: [...extra, ...get().items] });
  },
}));

const loaded = useTransactionStore.getState().items;
if (loaded.length !== uniqueLedgerItems(loaded).length) {
  useTransactionStore.getState().replaceAll(loaded);
}
