import { create } from 'zustand';

import { takeNewLedgerItems, uniqueLedgerItems, type LedgerItem } from '@/types/ledger';
import { isFinanceTransaction } from '@/utils/finance-visibility';
import { deduplicateInformation } from '@/utils/information';

type TransactionState = {
  items: LedgerItem[];
  financeItems: LedgerItem[];
  replaceAll: (items: LedgerItem[]) => void;
  addMany: (items: LedgerItem[]) => void;
};

export const useTransactionStore = create<TransactionState>((set, get) => ({
  items: [],
  financeItems: [],
  replaceAll: (incoming) => {
    const items = uniqueLedgerItems(incoming);
    set({ items, financeItems: deduplicateInformation(items.filter(isFinanceTransaction)) });
  },
  addMany: (incoming) => {
    const extra = takeNewLedgerItems(incoming, 'transaction', get().items);
    if (extra.length === 0) {
      return;
    }
    const visible = extra.filter(isFinanceTransaction);
    set({
      items: [...extra, ...get().items],
      financeItems: visible.length ? deduplicateInformation([...visible, ...get().financeItems]) : get().financeItems,
    });
  },
}));

const loaded = useTransactionStore.getState().items;
if (loaded.length !== uniqueLedgerItems(loaded).length) {
  useTransactionStore.getState().replaceAll(loaded);
}
