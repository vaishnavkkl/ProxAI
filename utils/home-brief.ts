import type { LedgerItem } from '@/types/ledger';
import { dayBrief } from '@/utils/life-agenda';

function groupItems(groups: Record<string, LedgerItem[] | undefined>, key: string) {
  return groups[key] ?? [];
}

function nameOf(item: LedgerItem, fallback: string) {
  const raw = (item.merchant || '').replace(/\s+/g, ' ').trim();
  if (!raw) {
    return fallback;
  }
  return raw.length > 24 ? `${raw.slice(0, 21).trim()}…` : raw;
}

export function dayBriefFacts(groups: Record<string, LedgerItem[] | undefined>, money?: { spend?: number }) {
  const lines: string[] = [];
  const today = groupItems(groups, 'Today').filter((item) => item.type !== 'transaction');
  const week = [...groupItems(groups, 'Tomorrow'), ...groupItems(groups, 'Next 7 days')].filter(
    (item) => item.type !== 'transaction',
  );
  const review = groupItems(groups, 'Important');
  const overdue = groupItems(groups, 'Overdue').filter((item) => item.type === 'bill' || item.type === 'action');

  for (const item of today.slice(0, 3)) {
    lines.push(`today: ${item.type} ${nameOf(item, item.type)}`);
  }
  for (const item of week.slice(0, 3)) {
    lines.push(`this week: ${item.type} ${nameOf(item, item.type)}`);
  }
  for (const item of review.slice(0, 2)) {
    lines.push(`review: ${nameOf(item, 'security')}`);
  }
  for (const item of overdue.slice(0, 2)) {
    lines.push(`waiting: ${item.type} ${nameOf(item, item.type)}`);
  }
  if (money?.spend && money.spend > 0) {
    lines.push(`month spend: ${Math.round(money.spend)}`);
  }
  return lines.join('\n');
}

export function briefFactHash(facts: string) {
  let hash = 0;
  for (let index = 0; index < facts.length; index += 1) {
    hash = (hash * 31 + facts.charCodeAt(index)) | 0;
  }
  return `${facts.length}:${hash}`;
}

export function sanitizeDayBrief(raw: string, fallback: string) {
  const cleaned = raw
    .replace(/```[\s\S]*```/g, ' ')
    .replace(/[*#_>`]/g, ' ')
    .replace(/\b(one item needs a quick review|items? need(?:s)? a(?: quick)? review)\b/gi, 'a security note is waiting')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) {
    return fallback;
  }
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 3);
  const words = sentences.join(' ').split(' ').filter(Boolean).slice(0, 42);
  let sentence = words.join(' ');
  if (!/[.!?]$/.test(sentence)) {
    sentence = `${sentence}.`;
  }
  return sentence.length > 220 ? `${sentence.slice(0, 217).trim()}…` : sentence;
}

export function localHomeBrief(groups: Record<string, LedgerItem[] | undefined>, money?: { spend?: number }) {
  return dayBrief(groups, money);
}
