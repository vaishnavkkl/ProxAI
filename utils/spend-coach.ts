import type { FixedExpenseRow, ItemState } from '@/services/database';
import type { LedgerItem } from '@/types/ledger';
import { detectCoachTopic } from '@/utils/coach-prompts';
import { formatLedgerWhen } from '@/utils/format-when';
import { informationTitle } from '@/utils/information';
import { localDay, parseLocalDate, isWithinUpcomingWindow } from '@/utils/message-date';
import { summarizeMonth } from '@/utils/month-finance';

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
  const { plan, events, life } = ledger;
  const upcoming = events.slice(0, 4).map((item) => {
    const day = (item.date ?? '').slice(0, 10) || 'soon';
    return `${day} ${(item.merchant ?? 'Event').slice(0, 28)}`;
  });
  const tasks = ofType(life, 'action', 6);
  const travel = ofType(life, 'travel', 4);
  const deliveries = ofType(life, 'delivery', 4);
  const security = ofType(life, 'security', 3);
  const dueBills = ofType(life, 'bill', 4);

  const lines = [`Month: ${plan.monthLabel}`];
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

export function fallbackCoachReply(_plan: SpendPlan, question = '', life: LedgerItem[] = [], now = new Date()): string {
  const visible = coachOpenLife(life, {}, now);
  const agenda =
    visible.length > 0
      ? `Coming up: ${visible.slice(0, 4).map(humanLifeLine).join('; ')}.`
      : 'Nothing upcoming in your plans. Add a task or refresh messages.';
  const finance = 'Money, spends, and leftover stay in Finance. I can help with plans and tasks here.';

  switch (detectCoachTopic(question)) {
    case 'today':
    case 'tasks':
    case 'travel':
    case 'delivery':
    case 'bills':
      return agenda;
    case 'security':
      return [
        'Treat unknown links and OTP requests as possible risk, not a confirmed scam.',
        'Open the official app or a number you already trust. Do not share codes.',
        agenda,
      ].join('\n');
    default:
      return finance;
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
