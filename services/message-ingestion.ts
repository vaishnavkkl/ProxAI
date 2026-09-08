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
import { hashMessage, hashMessageContent } from '@/utils/message-hash';
import { splitForLlm } from '@/utils/message-filter';
import { sanitizeParsedItem } from '@/utils/money-amount';
import { parseInbox } from '@/utils/parse-inbox';

type Infer = (messages: IncomingMessage[]) => Promise<ParsedItem[]>;

/** Bounded to one inbox page. A failed batch is never marked processed. */
export async function ingestMessagePage(messages: IncomingMessage[], modelKey: string, infer?: Infer) {
  const processed = useProcessedStore.getState();
  const seen = new Set<string>();
  const fresh = [];
  for (const message of messages) {
    const hash = await hashMessage(message), content = await hashMessageContent(message);
    if (processed.has(hash) || processed.has(content) || seen.has(content)) continue;
    seen.add(content); fresh.push({ message, hash, content });
  }
  const split = parseInbox(fresh.map((entry) => entry.message));
  if (!fresh.length) return { transactions: 0, events: 0, subscriptions: 0, life: 0, regex: 0, model: 0, dropped: 0, errors: 0, pending: 0, failureReason: undefined };
  const parsed = [...split.parsed];
  const candidates = splitForLlm(split.unmatched).keep;
  const pending = new Set(candidates.map((message) => message.id));
  const queue: IncomingMessage[] = [];
  let failureReason: string | undefined;
  const keys = new Map<string, string>();
  let model = 0, errors = 0;
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
        for (const message of chunk) {
          const items = result.filter((item) => item.sourceId === message.id && isKeepableItem(item))
            .map((item) => sanitizeParsedItem(item, [message.body])).filter((item): item is ParsedItem => item != null)
            .map((item) => ({ ...item, sourceBody: message.body, sender: message.sender, receivedAt: message.receivedAt }));
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
    const next = toLedgerItem(item, item.sourceId);
    const previous = known.find((row) => row.type === item.type && row.sourceId === item.sourceId);
    return previous ? { ...next, id: previous.id } : next;
  });
  const done = fresh.filter((entry) => !pending.has(entry.message.id));
  await persistParsedBatch({ items, processed: done.flatMap((entry) => [entry.hash, entry.content].map((hash) => ({ hash, sourceId: entry.message.id, receivedAt: entry.message.receivedAt ?? 0, sender: entry.message.sender }))) });
  processed.markMany(done.flatMap((entry) => [entry.hash, entry.content]));
  for (const [type, state] of [['transaction', useTransactionStore.getState()], ['event', useEventStore.getState()], ['subscription', useSubscriptionStore.getState()]] as const) {
    state.replaceAll(uniqueLedgerItems([...items.filter((item) => item.type === type), ...state.items]));
  }
  useLifeStore.getState().addMany(items);
  return { ...countByType(items.filter((item) => !known.some((row) => row.id === item.id))), regex: split.parsed.length, model, dropped: split.dropped + parsed.length - clean.length, errors, pending: pending.size, failureReason };
}
