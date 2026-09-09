import type { FixedExpenseRow, ItemState } from '@/services/database';
import type { LedgerItem } from '@/types/ledger';
import { detectCoachTopic } from '@/utils/coach-prompts';
import { listBankAccounts } from '@/utils/bank-account';
import { formatInr } from '@/utils/format-inr';
import { formatLedgerWhen } from '@/utils/format-when';
import { informationTitle } from '@/utils/information';
import { localDay, parseLocalDate, isWithinUpcomingWindow } from '@/utils/message-date';
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
  life: LedgerItem[];
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

function lifeLine(item: LedgerItem): string {
  const day = (item.date ?? '').slice(0, 10) || 'undated';
  const name = (item.merchant ?? item.type).replace(/\s+/g, ' ').trim().slice(0, 28);
  return `${item.type} ${day} ${name}`;
}

function humanLifeLine(item: LedgerItem): string {
  const title = informationTitle(item).replace(/\s+/g, ' ').trim().slice(0, 42);
  return item.date ? `${title} · ${formatLedgerWhen(item.date)}` : title;
}

export function coachOpenLife(items: LedgerItem[], states: Record<string, ItemState>, now = new Date()): LedgerItem[] {
  return items.filter((item) => {
    if (item.type === 'transaction') {
      return false;
    }
    if (states[item.id]?.status && states[item.id].status !== 'open') {
      return false;
    }
    if (item.type === 'event' || item.type === 'travel') {
      return isWithinUpcomingWindow(item.date, now);
    }
    if (item.type === 'bill' || item.type === 'subscription' || item.type === 'document' || item.type === 'purchase') {
      const parsed = parseLocalDate(item.date ?? '');
      if (!Number.isFinite(parsed.getTime())) {
        return true;
      }
      return localDay(parsed) >= localDay(now);
    }
    return true;
  });
}

function ofType(items: LedgerItem[], type: LedgerItem['type'], limit: number) {
  return items.filter((item) => item.type === type).slice(0, limit).map(lifeLine);
}

export function coachSnapshot(ledger: CoachLedger): string {
  const { plan, categories, transactions, expenses, subscriptions, events, life } = ledger;
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
  const tasks = ofType(life, 'action', 6);
  const travel = ofType(life, 'travel', 4);
  const deliveries = ofType(life, 'delivery', 4);
  const security = ofType(life, 'security', 3);
  const dueBills = ofType(life, 'bill', 4);

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
  if (tasks.length > 0) {
    lines.push(`Tasks: ${tasks.join('; ')}`);
  }
  if (travel.length > 0) {
    lines.push(`Travel: ${travel.join('; ')}`);
  }
  if (deliveries.length > 0) {
    lines.push(`Deliveries: ${deliveries.join('; ')}`);
  }
  if (dueBills.length > 0) {
    lines.push(`Due bills: ${dueBills.join('; ')}`);
  }
  if (security.length > 0) {
    lines.push(`Security to review: ${security.join('; ')}`);
  }
  const rest = life
    .filter((item) => !['action', 'travel', 'delivery', 'bill', 'security', 'transaction'].includes(item.type))
    .slice(0, 4)
    .map(lifeLine);
  if (rest.length > 0) {
    lines.push(`Other plans: ${rest.join('; ')}`);
  }
  return lines.join('\n');
}

export function fallbackCoachReply(plan: SpendPlan, question = '', life: LedgerItem[] = [], now = new Date()): string {
  const visible = coachOpenLife(life, {}, now);
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
  const agenda =
    visible.length > 0
      ? `Coming up: ${visible.slice(0, 4).map(humanLifeLine).join('; ')}.`
      : 'Nothing upcoming in your plans. Add a task or refresh messages.';

  switch (detectCoachTopic(question)) {
    case 'today':
    case 'tasks':
      return [agenda, daily, compare].join('\n');
    case 'travel':
    case 'delivery':
      return [agenda, `You have ${formatInr(plan.remaining)} uncommitted this month.`, save].join('\n');
    case 'security':
      return [
        'Treat unknown links and OTP requests as possible risk, not a confirmed scam.',
        'Open the official app or a number you already trust. Do not share codes.',
        agenda,
      ].join('\n');
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

export function coachDisplayedReply(reply: string, fallback: string, available: boolean, reason = ''): string {
  if (reply.trim()) {
    return reply;
  }
  if (!available) {
    return (
      reason ||
      'The on-device model is not on this phone yet. Open Settings, pick a model, and tap Download in the engine sheet.'
    );
  }
  return `I could not get a model reply just now.\n\n${fallback}`;
}
