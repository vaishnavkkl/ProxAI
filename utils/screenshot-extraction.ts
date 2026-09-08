import type { NativeScreenshot } from '@/modules/finlife-native';
import { toLedgerItem } from '@/types/ledger';
import { parseInbox } from '@/utils/parse-inbox';
import { localDay } from '@/utils/message-date';
import type { ParsedItem } from '@/types/llm-output';

function hasClearEvidence(item: ParsedItem): boolean {
  if (item.type === 'security') return true;
  if (item.type === 'transaction') return item.amount != null && item.amount > 0;
  if (item.type === 'bill') return Boolean(item.date) && item.amount != null && item.amount > 0;
  if (item.type === 'delivery' || item.type === 'travel') return Boolean(item.reference || item.date);
  return Boolean(item.date);
}

export function screenshotMessage(asset: NativeScreenshot, hash: string, text: string) {
  return { id: `shot-${hash.slice(0, 24)}`, sender: 'Screenshot', body: text.trim(),
    date: localDay(new Date(asset.capturedAt)), receivedAt: asset.capturedAt };
}

export function extractScreenshot(asset: NativeScreenshot, hash: string, text: string) {
  // Never re-import the organizer's own cards, or turn menu labels into fictional plans.
  if (/your day at a glance/i.test(text) && /highlights|all items|needs attention/i.test(text)) return [];
  if (/quick access/i.test(text) && /dashboard|preferences|performance/i.test(text)) return [];
  const message = screenshotMessage(asset, hash, text);
  return parseInbox([{ ...message, body: message.body.replace(/\s+/g, ' ') }]).parsed.filter(hasClearEvidence).map((item) => toLedgerItem({
    ...item, sourceBody: message.body, sourceKind: 'screenshot', sourceUri: asset.uri,
  }, message.id));
}
