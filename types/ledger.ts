import type { ParsedItem } from '@/types/llm-output';
import { withAccount } from '@/utils/bank-account';

export type LedgerItem = ParsedItem & {
  id: string;
};

function idToken(value: string) {
  return value.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';
}

export function toLedgerItem(item: ParsedItem, unique = ''): LedgerItem {
  const note = item.review?.trim() || item.note;
  const day = (item.date ?? '').slice(0, 10);
  const source = unique || item.sourceId || '';
  // A carrier update belongs to the same delivery even when its date/title changes.
  if (item.type === 'delivery' && item.reference) {
    return { ...item, note, id: `delivery|${idToken(item.sender ?? 'unknown')}|${idToken(item.reference)}` };
  }
  const id = [
    item.type,
    day || 'undated',
    idToken(item.merchant ?? 'unknown'),
    item.amount == null ? 'na' : String(item.amount),
    idToken(source || note || 'row'),
  ].join('|');
  return withAccount({ ...item, note, id });
}

export function uniqueLedgerItems(items: LedgerItem[]): LedgerItem[] {
  const seen = new Set<string>();
  const out: LedgerItem[] = [];
  for (const item of items) {
    if (seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

export function takeNewLedgerItems(
  incoming: LedgerItem[],
  type: LedgerItem['type'],
  existing: LedgerItem[],
): LedgerItem[] {
  const seen = new Set(existing.map((item) => item.id));
  const extra: LedgerItem[] = [];
  for (const item of incoming) {
    if (item.type !== type || seen.has(item.id)) {
      continue;
    }
    seen.add(item.id);
    extra.push(item);
  }
  return extra;
}

export function countByType(items: ParsedItem[]) {
  return {
    transactions: items.filter((item) => item.type === 'transaction').length,
    events: items.filter((item) => item.type === 'event').length,
    subscriptions: items.filter((item) => item.type === 'subscription').length,
    life: items.filter(isLifeItem).length,
  };
}

export function isLifeItem(item: ParsedItem): boolean {
  return !['transaction', 'event', 'subscription'].includes(item.type);
}
