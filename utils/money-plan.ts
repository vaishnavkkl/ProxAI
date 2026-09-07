import type { FixedExpenseRow } from '@/services/database';

export function monthsLeft(expense: FixedExpenseRow): number | null {
  if (expense.kind !== 'emi' || expense.monthsTotal == null) {
    return null;
  }
  return Math.max(0, expense.monthsTotal - (expense.monthsPaid ?? 0));
}

export function isEmiDone(expense: FixedExpenseRow): boolean {
  const left = monthsLeft(expense);
  return left != null && left === 0;
}

export function monthlyFixedTotal(expenses: FixedExpenseRow[]): number {
  let total = 0;
  for (const expense of expenses) {
    if (isEmiDone(expense)) {
      continue;
    }
    total += expense.amount;
  }
  return total;
}

export function emiStillOwed(expenses: FixedExpenseRow[]): number {
  let total = 0;
  for (const expense of expenses) {
    const left = monthsLeft(expense);
    if (left == null || left === 0) {
      continue;
    }
    total += expense.amount * left;
  }
  return total;
}
