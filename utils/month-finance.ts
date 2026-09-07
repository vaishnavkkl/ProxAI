import type { FixedExpenseRow } from '@/services/database';
import type { LedgerItem } from '@/types/ledger';
import { emiStillOwed, monthlyFixedTotal } from '@/utils/money-plan';

export type CategoryTotal = {
  id: string;
  label: string;
  amount: number;
};

export const CATEGORY_LABELS: Record<string, string> = {
  grocery: 'Grocery',
  dining: 'Dining',
  bills: 'Bills',
  work: 'Work',
  income: 'Income',
  other: 'Other',
};

function monthPrefix(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export function isInCurrentMonth(date: string | null | undefined, now = new Date()) {
  if (!date) {
    return false;
  }
  return date.slice(0, 7) === monthPrefix(now);
}

export function summarizeMonth(
  items: LedgerItem[],
  salary: number,
  expenses: FixedExpenseRow[],
  now = new Date(),
) {
  const monthItems = items.filter((item) => isInCurrentMonth(item.date, now));
  let income = 0;
  let spend = 0;
  const buckets = new Map<string, number>();

  for (const item of monthItems) {
    if (item.amount == null) {
      continue;
    }
    if (item.category === 'income') {
      income += item.amount;
      continue;
    }
    spend += item.amount;
    buckets.set(item.category, (buckets.get(item.category) ?? 0) + item.amount);
  }

  const fixed = monthlyFixedTotal(expenses);
  const leftover = salary - fixed - spend + income;
  const categories: CategoryTotal[] = [...buckets.entries()]
    .map(([id, amount]) => ({ id, label: CATEGORY_LABELS[id] ?? id, amount }))
    .sort((left, right) => right.amount - left.amount);

  const reviews = monthItems.filter(
    (item) => item.important === 'high' || Boolean(item.review?.trim()) || Boolean(item.note && item.note !== 'regex'),
  ).slice(0, 5);

  return {
    income,
    spend,
    net: income - spend,
    leftover,
    fixed,
    emiOwed: emiStillOwed(expenses),
    categories,
    reviews,
    monthLabel: now.toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
  };
}

export function monthCategoryTotal(items: LedgerItem[], category: string, now = new Date()): number {
  let total = 0;
  for (const item of items) {
    if (item.category !== category || item.amount == null || !isInCurrentMonth(item.date, now)) {
      continue;
    }
    total += item.amount;
  }
  return total;
}
