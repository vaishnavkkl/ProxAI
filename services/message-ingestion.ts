import { persistParsedBatch } from '@/services/database';
import { readExtraction, writeExtraction } from '@/services/extraction-cache';
import { PARSER_VERSION } from '@/services/parser-revision';
import { useEventStore } from '@/store/event-store';
import { useLifeStore } from '@/store/life-store';
import { useProcessedStore } from '@/store/processed-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import { useTransactionStore } from '@/store/transaction-store';
import { countByType, toLedgerItem, uniqueLedgerItems } from '@/types/ledger';
import { isKeepableItem, type ParsedItem } from '@/types/llm-output';
import type { IncomingMessage } from '@/utils/bank-parsers';
import { collapseCardTwins } from '@/utils/card-sms';
import { isUpcomingPlan } from '@/utils/information';
import { hashMessage, hashMessageContent } from '@/utils/message-hash';
import { splitForLlm } from '@/utils/message-filter';
import { sanitizeParsedItem } from '@/utils/money-amount';
import { parseInbox } from '@/utils/parse-inbox';

type Infer = (messages: IncomingMessage[]) => Promise<ParsedItem[]>;

function sourceKey(value: unknown): string {
  return value == null || value === '' ? '' : String(value);
}

/** Map a model batch onto one SMS. undefined means do not cache (retry next Refresh). */
export function matchLlmItems(result: ParsedItem[], message: IncomingMessage, chunk: IncomingMessage[]): ParsedItem[] | undefined {
  const id = String(message.id);
  const tagged = result.filter((item) => sourceKey(item.sourceId) === id);
  if (tagged.length) {
    return tagged;
  }
  const index = chunk.findIndex((row) => String(row.id) === id);
  if (result.length === chunk.length && index >= 0 && !sourceKey(result[index]?.sourceId)) {
    const row = result[index];
    return row ? [row] : [];
  }
  if (result.length === 0) {
    return [];
  }
  const known = new Set(chunk.map((row) => String(row.id)));
  if (result.some((item) => known.has(sourceKey(item.sourceId)))) {
    return [];
  }
  return undefined;
}

/** Bounded to one inbox page. A failed batch is never marked processed. */
export async function ingestMessagePage(messages: IncomingMessage[], modelKey: string, infer?: Infer) {
  const processed = useProcessedStore.getState();
  const seen = new Set<string>();
  const fresh: { message: IncomingMessage; hash: string; content: string }[] = [];
  for (const message of messages) {
    const hash = await hashMessage(message), content = await hashMessageContent(message);
    if (processed.has(hash) || processed.has(content) || seen.has(content)) continue;
    seen.add(content); fresh.push({ message, hash, content });
  }
  const split = parseInbox(fresh.map((entry) => entry.message));
  if (!fresh.length) return { transactions: 0, events: 0, subscriptions: 0, life: 0, regex: 0, model: 0, dropped: 0, errors: 0, pending: 0, failureReason: undefined, llmRan: false };
  const parsed = [...split.parsed];
  const candidates = splitForLlm(split.unmatched).keep;
  const pending = new Set(candidates.map((message) => message.id));
  const queue: IncomingMessage[] = [];
  let failureReason: string | undefined;
  const keys = new Map<string, string>();
  let model = 0, errors = 0, llmRan = false;
  for (const message of candidates) {
    const entry = fresh.find((row) => row.message.id === message.id)!;
    const key = `llm:${PARSER_VERSION}:${modelKey}:${entry.hash}`;
    keys.set(message.id, key);
    const cached = await readExtraction<ParsedItem[]>(key);
    if (cached !== null) { parsed.push(...cached); model += cached.length; pending.delete(message.id); }
    else queue.push(message);
  }
  if (infer) {
    for (let index = 0; index < queue.length; index += 12) {
      const chunk = queue.slice(index, index + 12);
      try {
        const result = await infer(chunk);
        llmRan = true;
        for (const message of chunk) {
          const matched = matchLlmItems(result, message, chunk);
          if (matched === undefined) {
            continue;
          }
          const items = matched.filter(isKeepableItem)
            .map((item) => sanitizeParsedItem(item, [message.body])).filter((item): item is ParsedItem => item != null)
            .map((item) => ({ ...item, sourceId: message.id, sourceBody: message.body, sender: message.sender, receivedAt: message.receivedAt }));
          // Cache valid empty decisions too, so irrelevant rows do not starve later messages.
          await writeExtraction(keys.get(message.id)!, items);
          parsed.push(...items); model += items.length; pending.delete(message.id);
        }
      } catch (error) {
        errors++;
        const message = error instanceof Error ? error.message : '';
        // Known setup failures apply to every batch. Keep all remaining messages
        // pending, without repeatedly trying to load a model that cannot run.
        if (message.startsWith('Not enough free memory')) {
          failureReason = 'Not enough free memory for the selected model. Choose Qwen2.5 0.5B in Settings, then Refresh. Your saved items are kept.';
          break;
        }
        if (message === 'offline-cache-missing') {
          failureReason = 'The selected model is not downloaded. Choose an on-device model in Settings, then Refresh.';
          break;
        }
      }
    }
  }
  const known = [...useTransactionStore.getState().items, ...useEventStore.getState().items, ...useSubscriptionStore.getState().items, ...useLifeStore.getState().items];
  const clean = collapseCardTwins(parsed.filter(isKeepableItem), useTransactionStore.getState().items);
  const items = clean.map((item) => {
    const message = fresh.find((row) => row.message.id === item.sourceId)?.message;
    const next = toLedgerItem({
      ...item,
      sourceKind: message?.sourceKind ?? item.sourceKind,
      sourceUri: message?.sourceUri ?? item.sourceUri,
    }, item.sourceId);
    const previous = known.find((row) => row.type === item.type && row.sourceId === item.sourceId);
    return previous ? { ...next, id: previous.id } : next;
  }).filter((item) => isUpcomingPlan(item));
  const stale = clean.length - items.length;
  const done = fresh.filter((entry) => !pending.has(entry.message.id));
  await persistParsedBatch({ items, processed: done.flatMap((entry) => [entry.hash, entry.content].map((hash) => ({ hash, sourceId: entry.message.id, receivedAt: entry.message.receivedAt ?? 0, sender: entry.message.sender }))) });
  processed.markMany(done.flatMap((entry) => [entry.hash, entry.content]));
  for (const [type, state] of [['transaction', useTransactionStore.getState()], ['event', useEventStore.getState()], ['subscription', useSubscriptionStore.getState()]] as const) {
    state.replaceAll(uniqueLedgerItems([...items.filter((item) => item.type === type), ...state.items]));
  }
  useLifeStore.getState().addMany(items);
  return { ...countByType(items.filter((item) => !known.some((row) => row.id === item.id))), regex: split.parsed.length, model, dropped: split.dropped + parsed.length - clean.length + stale, errors, pending: pending.size, failureReason, llmRan };
}
