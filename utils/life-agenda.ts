import type { ItemState } from '@/services/database';
import type { LedgerItem } from '@/types/ledger';
import { formatInr } from '@/utils/format-inr';
import { deduplicateInformation, informationTitle, isUsefulInformation } from '@/utils/information';
import { localDay, parseLocalDate, upcomingDayLimit } from '@/utils/message-date';

export const MODULES = [
  { type: 'action', label: 'Actions', icon: 'checkbox-outline' },
  { type: 'event', label: 'Events', icon: 'calendar-outline' },
  { type: 'travel', label: 'Travel', icon: 'airplane-outline' },
  { type: 'delivery', label: 'Deliveries', icon: 'cube-outline' },
  { type: 'bill', label: 'Bills', icon: 'receipt-outline' },
  { type: 'security', label: 'Security', icon: 'shield-checkmark-outline' },
  { type: 'subscription', label: 'Renewals', icon: 'repeat-outline' },
  { type: 'document', label: 'Expiry', icon: 'document-text-outline' },
  { type: 'purchase', label: 'Purchases', icon: 'bag-outline' },
  { type: 'transaction', label: 'Finance', icon: 'wallet-outline' },
] as const;

export function effectiveItem(item: LedgerItem, states: Record<string, ItemState>): LedgerItem {
  const state = states[item.id];
  return { ...item, merchant: state?.title ?? informationTitle(item), date: state?.date !== undefined ? state.date : item.date };
}

export function agendaGroups(items: LedgerItem[], states: Record<string, ItemState>, now = new Date()) {
  const today = localDay(now);
  const tomorrowDate = new Date(now); tomorrowDate.setDate(now.getDate() + 1);
  const tomorrow = localDay(tomorrowDate);
  const end = new Date(now); end.setDate(now.getDate() + 7);
  const weekEnd = localDay(end);
  const groups: Record<string, LedgerItem[]> = { Important: [], Overdue: [], Today: [], Tomorrow: [], 'Next 7 days': [], Later: [], 'Date needed': [], History: [], Completed: [] };
  const sorted = deduplicateInformation(items.filter(isUsefulInformation), states).map((item) => effectiveItem(item, states)).sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
  for (const item of sorted) {
    if (states[item.id]?.status && states[item.id].status !== 'open') { groups.Completed.push(item); continue; }
    if (item.type === 'security') { groups.Important.push(item); continue; }
    if (item.trackingStatus === 'delivered' || item.trackingStatus === 'cancelled') { groups.History.push(item); continue; }
    // Installed apps are suggestions, not confirmed recurring bills.
    if (item.id.startsWith('app-') || item.note === 'app') continue;
    const parsed = parseLocalDate(item.date ?? '');
    const day = Number.isFinite(parsed.getTime()) ? localDay(parsed) : '';
    if (!day) { groups['Date needed'].push(item); continue; }
    if (day < today) {
      if (item.type === 'event' || item.type === 'travel') continue;
      const actionable = ['action', 'bill', 'subscription', 'document', 'purchase', 'delivery'].includes(item.type);
      groups[actionable ? 'Overdue' : 'History'].push(item);
    } else if ((item.type === 'event' || item.type === 'travel') && day > upcomingDayLimit(now)) continue;
    else if (day === today) groups.Today.push(item);
    else if (day === tomorrow) groups.Tomorrow.push(item);
    else if (day <= weekEnd) groups['Next 7 days'].push(item);
    else groups.Later.push(item);
  }
  return groups;
}

export function dailyDigest(items: LedgerItem[]): string {
  if (!items.length) return 'No dated items for today. Scan messages or add something to get started.';
  return MODULES.map((module) => {
    const count = items.filter((item) => item.type === module.type).length;
    const labels: Record<string, [string, string]> = {
      action: ['task', 'tasks'], event: ['event', 'events'], travel: ['journey', 'journeys'],
      delivery: ['delivery', 'deliveries'], bill: ['payment', 'payments'], security: ['security review', 'security reviews'],
      subscription: ['renewal', 'renewals'], document: ['expiry', 'expiries'], purchase: ['purchase', 'purchases'], transaction: ['transaction', 'transactions'],
    };
    return count ? `${count} ${labels[module.type][count === 1 ? 0 : 1]}` : '';
  }).filter(Boolean).join(' · ');
}

function groupItems(groups: Record<string, LedgerItem[] | undefined>, key: string) {
  return groups[key] ?? [];
}

function briefName(item: LedgerItem, fallback: string) {
  const raw = (item.merchant || '').replace(/\s+/g, ' ').trim();
  if (!raw) {
    return fallback;
  }
  return raw.length > 28 ? `${raw.slice(0, 25).trim()}…` : raw;
}

function briefSentence(items: string[]) {
  if (!items.length) {
    return '';
  }
  const body =
    items.length === 1 ? items[0] : items.length === 2 ? `${items[0]}, and ${items[1]}` : `${items[0]}, ${items[1]}, and ${items[2]}`;
  return `${body.charAt(0).toUpperCase()}${body.slice(1)}.`;
}

function joinBrief(parts: string[]) {
  if (!parts.length) {
    return 'Your week looks calm — nothing needs you right now. Add a plan or refresh messages whenever you like.';
  }
  return [briefSentence(parts.slice(0, 2)), briefSentence(parts.slice(2, 5))].filter(Boolean).join(' ');
}

export function dayBrief(groups: Record<string, LedgerItem[] | undefined>, money?: { spend?: number }) {
  const today = groupItems(groups, 'Today').filter((item) => item.type !== 'transaction');
  const week = [...groupItems(groups, 'Tomorrow'), ...groupItems(groups, 'Next 7 days')].filter((item) => item.type !== 'transaction');
  const upcoming = [...today, ...week];
  const review = groupItems(groups, 'Important').length;
  const dueBills = [...groupItems(groups, 'Overdue'), ...upcoming].filter((item) => item.type === 'bill').length;
  const parts: string[] = [];

  const todayEvents = today.filter((item) => item.type === 'event' || item.type === 'travel');
  const weekEvents = week.filter((item) => item.type === 'event' || item.type === 'travel');
  if (todayEvents.length === 1) {
    parts.push(`${briefName(todayEvents[0], 'an event')} is on today`);
  } else if (todayEvents.length > 1) {
    parts.push(`${todayEvents.length} things are on today`);
  } else if (weekEvents.length === 1) {
    parts.push(`${briefName(weekEvents[0], 'an event')} is coming up this week`);
  } else if (weekEvents.length > 1) {
    parts.push(`${weekEvents.length} things to look forward to this week`);
  }

  const renewals = upcoming.filter((item) => item.type === 'subscription');
  if (renewals.length === 1) {
    parts.push(`${briefName(renewals[0], 'a subscription')} renews soon`);
  } else if (renewals.length > 1) {
    parts.push(`${renewals.length} renewals are due this week`);
  }

  if (dueBills) {
    parts.push(dueBills === 1 ? 'a bill is waiting when you have a moment' : `${dueBills} bills are waiting when you have a moment`);
  } else if (money?.spend && money.spend > 0) {
    parts.push(`this month you have spent ${formatInr(money.spend)} so far`);
  }

  if (review === 1) {
    parts.push('a security note is waiting when you have a moment');
  } else if (review > 1) {
    parts.push(`${review} security notes are waiting`);
  }

  return joinBrief(parts);
}

export function glanceStatus(today: number, review: number) {
  if (today > 0) {
    return today === 1 ? '1 today' : `${today} today`;
  }
  if (review > 0) {
    return review === 1 ? '1 to review' : `${review} to review`;
  }
  return 'Caught up';
}

export function glanceWhen(item: LedgerItem, now = new Date()) {
  const parsed = parseLocalDate(item.date ?? '');
  if (!item.date || Number.isNaN(parsed.getTime())) {
    return 'Time not set';
  }
  const clock = !/^\d{4}-\d{2}-\d{2}$/.test(item.date)
    ? parsed.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
    : '';
  const day = localDay(parsed);
  const today = localDay(now);
  const tomorrowDate = new Date(now);
  tomorrowDate.setDate(now.getDate() + 1);
  const tomorrow = localDay(tomorrowDate);
  if (day === today) {
    return clock ? `Today · ${clock}` : 'Today';
  }
  if (day === tomorrow) {
    return clock ? `Tomorrow · ${clock}` : 'Tomorrow';
  }
  const date = parsed.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  return clock ? `${date} · ${clock}` : date;
}

export function dashboardHighlights(groups: Record<string, LedgerItem[]>): LedgerItem[] {
  const upcoming = [...groups.Today, ...groups.Tomorrow, ...groups['Next 7 days']].filter((item) => item.type !== 'transaction');
  const overdue = groups.Overdue.filter((item) => item.type !== 'bill' && item.type !== 'subscription').sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const priority = [...groups.Important.slice(0, 2), ...overdue.slice(0, 2), ...upcoming];
  const seen = new Set<string>();
  return [...priority, ...groups.Important, ...overdue].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, 6);
}
