import type { FixedExpenseRow } from '@/services/database';
import type { LedgerItem } from '@/types/ledger';
import { detectCoachTopic } from '@/utils/coach-prompts';
import { listBankAccounts } from '@/utils/bank-account';
import { formatInr } from '@/utils/format-inr';
import { monthsLeft } from '@/utils/money-plan';
import { isInCurrentMonth, summarizeMonth } from '@/utils/month-finance';

export type SpendPlan = {
  monthLabel: string;
  salary: number;
  spend: number;
  income: number;
  fixed: number;
  leftover: number;
  remaining: number;
  daily: number;
  saveMonthly: number;
  daysLeft: number;
  daysInMonth: number;
  topCategory: string | null;
  merchants: string[];
};

export function buildSpendPlan(
  items: LedgerItem[],
  salary: number,
  expenses: FixedExpenseRow[],
  now = new Date(),
): SpendPlan {
  const summary = summarizeMonth(items, salary, expenses, now);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const daysLeft = Math.max(1, daysInMonth - now.getDate() + 1);
  const remaining = Math.max(0, summary.leftover);
  const afterBills = Math.max(0, salary - summary.fixed + summary.income);
  const saveMonthly = salary > 0 ? Math.min(remaining, Math.round(afterBills * 0.2)) : 0;
  const merchants = items
    .filter((item) => item.category !== 'income' && item.merchant)
    .slice(0, 8)
    .map((item) => item.merchant as string);

  return {
    monthLabel: summary.monthLabel,
    salary,
    spend: summary.spend,
    income: summary.income,
    fixed: summary.fixed,
    leftover: summary.leftover,
    remaining,
    daily: Math.floor(remaining / daysLeft),
    saveMonthly,
    daysLeft,
    daysInMonth,
    topCategory: summary.categories[0]?.label ?? null,
    merchants,
  };
}

export type CoachLedger = {
  plan: SpendPlan;
  categories: { label: string; amount: number }[];
  transactions: LedgerItem[];
  expenses: FixedExpenseRow[];
  subscriptions: LedgerItem[];
  events: LedgerItem[];
};

function moneyLine(item: LedgerItem): string {
  const day = (item.date ?? '').slice(0, 10) || 'undated';
  const name = (item.merchant ?? 'Unknown').replace(/\s+/g, ' ').trim().slice(0, 28);
  const amount = item.amount == null ? '—' : formatInr(item.amount);
  return `${day} ${name} ${item.category} ${amount}`;
}

function takeMonth(items: LedgerItem[], category: 'income' | 'spend', limit: number) {
  return items
    .filter((item) => {
      if (!isInCurrentMonth(item.date)) {
        return false;
      }
      if (item.amount == null) {
        return false;
      }
      return category === 'income' ? item.category === 'income' : item.category !== 'income';
    })
    .slice(0, limit);
}

export function coachSnapshot(ledger: CoachLedger): string {
  const { plan, categories, transactions, expenses, subscriptions, events } = ledger;
  const inflows = plan.salary + plan.income;
  const outflows = plan.fixed + plan.spend;
  const spends = takeMonth(transactions, 'spend', 8).map(moneyLine);
  const credits = takeMonth(transactions, 'income', 4).map(moneyLine);
  const bills = expenses.slice(0, 6).map((row) => {
    const left = monthsLeft(row);
    const emi = left != null ? ` · ${left} EMI left` : '';
    return `${row.label} ${formatInr(row.amount)}${emi}`;
  });
  const subs = subscriptions.slice(0, 5).map((item) => {
    const amount = item.amount == null ? 'amount unknown' : formatInr(item.amount);
    return `${(item.merchant ?? 'Subscription').slice(0, 28)} ${amount}`;
  });
  const upcoming = events.slice(0, 4).map((item) => {
    const day = (item.date ?? '').slice(0, 10) || 'soon';
    return `${day} ${(item.merchant ?? 'Event').slice(0, 28)}`;
  });

  const lines = [
    'Currency: INR rupees. Write ₹ or Rs. Never write $ or USD.',
    `Month: ${plan.monthLabel}`,
    `Paycheck: ${plan.salary > 0 ? formatInr(plan.salary) : 'not set'}`,
    `Extra income from ledger: ${formatInr(plan.income)}`,
    `Total inflow: ${formatInr(inflows)}`,
    `Fixed bills: ${formatInr(plan.fixed)}`,
    `Variable spend: ${formatInr(plan.spend)}`,
    `Total outflow: ${formatInr(outflows)}`,
    `Income minus expenditure: ${formatInr(inflows - outflows)}`,
    `Left after bills and spends: ${formatInr(plan.leftover)}`,
    `Days left: ${plan.daysLeft} of ${plan.daysInMonth}`,
    `Safe spend per remaining day: ${formatInr(plan.daily)}`,
    `Suggested save this month: ${formatInr(plan.saveMonthly)}`,
  ];
  const accounts = listBankAccounts(transactions);
  if (accounts.length > 0) {
    lines.push(
      `Bank accounts (${accounts.length}): ${accounts
        .map((account) => `${account.name} in ${formatInr(account.income)} out ${formatInr(account.spend)}`)
        .join('; ')}`,
    );
  }
  if (categories.length > 0) {
    lines.push(
      `Spend by category: ${categories
        .slice(0, 5)
        .map((item) => `${item.label} ${formatInr(item.amount)}`)
        .join(', ')}`,
    );
  }
  if (bills.length > 0) {
    lines.push(`Bills: ${bills.join('; ')}`);
  }
  if (credits.length > 0) {
    lines.push(`Income rows: ${credits.join('; ')}`);
  }
  if (spends.length > 0) {
    lines.push(`Spend rows: ${spends.join('; ')}`);
  }
  if (subs.length > 0) {
    lines.push(`Subscriptions: ${subs.join('; ')}`);
  }
  if (upcoming.length > 0) {
    lines.push(`Upcoming events: ${upcoming.join('; ')}`);
  }
  return lines.join('\n');
}

export function fallbackCoachReply(plan: SpendPlan, question = ''): string {
  const inflow = plan.salary + plan.income;
  const outflow = plan.fixed + plan.spend;
  const gap = inflow - outflow;
  const compare = `${plan.monthLabel}: inflow ${formatInr(inflow)} vs outflow ${formatInr(outflow)} (${gap >= 0 ? 'ahead' : 'over'} by ${formatInr(Math.abs(gap))}).`;
  const daily =
    plan.salary > 0
      ? `Safe pace is ${formatInr(plan.daily)} a day for the next ${plan.daysLeft} days, leftover ${formatInr(plan.remaining)}.`
      : 'Set your paycheck in Finance so I can cap daily spend from real income.';
  const cut = plan.topCategory
    ? `${plan.topCategory} is the largest variable bucket. Pause one repeat merchant there this week.`
    : 'Refresh messages so more spends land in Finance.';
  const save =
    plan.saveMonthly > 0
      ? `Park ${formatInr(plan.saveMonthly)} now — about 20% of income after bills.`
      : 'Set paycheck and bills to get a monthly save target.';

  switch (detectCoachTopic(question)) {
    case 'compare':
    case 'income':
      return [compare, daily, cut, save].join('\n');
    case 'daily':
      return [daily, compare, cut, save].join('\n');
    case 'save':
      return [save, compare, cut, daily].join('\n');
    case 'cut':
      return [cut, compare, daily, save].join('\n');
    case 'bills':
      return [
        `Fixed bills are ${formatInr(plan.fixed)} against paycheck ${plan.salary > 0 ? formatInr(plan.salary) : 'not set'}.`,
        compare,
        cut,
        save,
      ].join('\n');
    case 'afford':
      return [
        `You have ${formatInr(plan.remaining)} uncommitted this month.`,
        `A purchase above ${formatInr(plan.daily)} uses more than one safe day.`,
        compare,
        save,
      ].join('\n');
    default:
      return [compare, daily, cut, save].join('\n');
  }
}
