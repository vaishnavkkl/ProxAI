import type { NativeScreenshot } from '@/modules/finlife-native';
import { toLedgerItem } from '@/types/ledger';
import { parseInbox } from '@/utils/parse-inbox';
import { localDay } from '@/utils/message-date';
import type { IncomingMessage } from '@/utils/bank-parsers';
import type { ParsedItem } from '@/types/llm-output';
import type { LedgerItem } from '@/types/ledger';

function hasClearEvidence(item: ParsedItem): boolean {
  if (item.type === 'security') return true;
  if (item.type === 'transaction') return item.amount != null && item.amount > 0;
  if (item.type === 'bill') return Boolean(item.date) && item.amount != null && item.amount > 0;
  if (item.type === 'delivery' || item.type === 'travel') return Boolean(item.reference || item.date);
  return Boolean(item.date);
}

export function screenshotMessage(asset: NativeScreenshot, hash: string, text: string): IncomingMessage {
  return {
    id: `shot-${hash.slice(0, 24)}`,
    sender: 'Screenshot',
    body: text.trim(),
    date: localDay(new Date(asset.capturedAt)),
    receivedAt: asset.capturedAt,
    sourceKind: 'screenshot',
    sourceUri: asset.uri,
  };
}

export type ScreenshotExtract = {
  items: LedgerItem[];
  unmatched: IncomingMessage[];
  message: IncomingMessage;
};

export function extractScreenshotResult(asset: NativeScreenshot, hash: string, text: string): ScreenshotExtract {
  const message = screenshotMessage(asset, hash, text);
  // Never re-import the organizer's own cards, or turn menu labels into fictional plans.
  if (/your day at a glance/i.test(text) && /highlights|all items|needs attention/i.test(text)) {
    return { items: [], unmatched: [], message };
  }
  if (/quick access/i.test(text) && /dashboard|preferences|performance/i.test(text)) {
    return { items: [], unmatched: [], message };
  }
  const split = parseInbox([{ ...message, body: message.body.replace(/\s+/g, ' ') }]);
  return {
    message,
    unmatched: split.unmatched,
    items: split.parsed.filter(hasClearEvidence).map((item) => toLedgerItem({
      ...item, sourceBody: message.body, sourceKind: 'screenshot', sourceUri: asset.uri,
    }, message.id)),
  };
}

export function extractScreenshot(asset: NativeScreenshot, hash: string, text: string) {
  return extractScreenshotResult(asset, hash, text).items;
}
