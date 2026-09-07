import { uniqueLedgerItems, type LedgerItem } from '@/types/ledger';

export type LedgerSort = 'recent' | 'amount';

export function ledgerTime(item: LedgerItem): number {
  const value = Date.parse(item.date ?? '');
  return Number.isFinite(value) ? value : 0;
}

export function sortLedgerItems(items: LedgerItem[], sort: LedgerSort): LedgerItem[] {
  const next = uniqueLedgerItems(items);
  if (sort === 'amount') {
    next.sort((left, right) => (right.amount ?? 0) - (left.amount ?? 0));
    return next;
  }
  next.sort((left, right) => ledgerTime(right) - ledgerTime(left));
  return next;
}
