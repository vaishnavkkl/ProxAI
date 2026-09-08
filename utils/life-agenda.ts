import type { ItemState } from '@/services/database';
import type { LedgerItem } from '@/types/ledger';
import { localDay, parseLocalDate } from '@/utils/message-date';
import { deduplicateInformation, informationTitle, isUsefulInformation } from '@/utils/information';

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
      const actionable = ['action', 'bill', 'subscription', 'document', 'purchase', 'delivery'].includes(item.type);
      groups[actionable ? 'Overdue' : 'History'].push(item);
    } else if (day === today) groups.Today.push(item);
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

export function dashboardHighlights(groups: Record<string, LedgerItem[]>): LedgerItem[] {
  const upcoming = [...groups.Today, ...groups.Tomorrow, ...groups['Next 7 days']].filter((item) => item.type !== 'transaction');
  const overdue = [...groups.Overdue].sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));
  const priority = [...groups.Important.slice(0, 2), ...overdue.slice(0, 2), ...upcoming];
  const seen = new Set<string>();
  return [...priority, ...groups.Important, ...overdue].filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  }).slice(0, 6);
}
