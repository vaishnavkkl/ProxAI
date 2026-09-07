import { persistParsedBatch } from '@/services/database';
import { importGoogleSources } from '@/services/device-calendar';
import { importInstalledSubscriptions } from '@/services/installed-apps';
import { getCatalogModel } from '@/services/model-catalog';
import { saveScanSummary } from '@/services/scan-summary';
import { useEventStore } from '@/store/event-store';
import { useProcessedStore } from '@/store/processed-store';
import { useSettingsStore } from '@/store/settings-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import { useTransactionStore } from '@/store/transaction-store';
import { countByType, toLedgerItem } from '@/types/ledger';
import { isKeepableItem, type ParsedItem } from '@/types/llm-output';
import { type IncomingMessage } from '@/utils/bank-parsers';
import { collapseCardTwins } from '@/utils/card-sms';
import { parseInbox } from '@/utils/parse-inbox';
import { isUsageAlert, isUsageNoiseText, splitForLlm } from '@/utils/message-filter';
import { hashMessage, hashMessageContent } from '@/utils/message-hash';
import { withAccount } from '@/utils/bank-account';
import { sanitizeParsedItem } from '@/utils/money-amount';

import { getLlmRuntime } from './llm-runtime';
import type { BatchResult, CoachTurn, LlmAvailability, ProgressFn } from './llm-runtime-types';
import { ensureParserRevision } from './parser-revision';
import { collectInboxPage, rememberInboxPage, type InboxResult } from './sms-inbox';

const DEMO_MESSAGES: IncomingMessage[] = [
  {
    id: 'demo-1',
    sender: 'HDFCBK',
    body: 'HDFC Bank: Rs.450.00 debited from A/c XX1234 on 03-Sep-26 at SWIGGY. Avl Bal Rs.12000',
    date: '2026-09-03',
    receivedAt: Date.parse('2026-09-03T10:00:00Z'),
  },
  {
    id: 'demo-2',
    sender: 'ICICIB',
    body: 'ICICI: Your a/c XX99 is credited with INR 25000.00 on 01-Sep-26. Info: SALARY',
    date: '2026-09-01',
    receivedAt: Date.parse('2026-09-01T10:00:00Z'),
  },
  {
    id: 'demo-3',
    sender: 'AMAZON',
    body: 'Your Prime membership will renew on 15-Sep-26 for INR 1499. Confirm subscription charge.',
    date: '2026-09-02',
    receivedAt: Date.parse('2026-09-02T10:00:00Z'),
  },
  {
    id: 'demo-4',
    sender: 'COLLEGE',
    body: 'Reminder: Physics exam on 10-Sep-2026 at 9 AM in Hall B.',
    date: '2026-09-02',
    receivedAt: Date.parse('2026-09-02T11:00:00Z'),
  },
  {
    id: 'demo-5',
    sender: 'HDFCBK',
    body: 'HDFC Bank: Rs.8000.00 debited from A/c XX1234 on 03-Sep-26 towards HDFC CREDIT CARD. Avl Bal Rs.4000',
    date: '2026-09-03',
    receivedAt: Date.parse('2026-09-03T12:00:00Z'),
  },
  {
    id: 'demo-6',
    sender: 'HDFC-CC',
    body: 'Payment of Rs.8000.00 received on your HDFC Credit Card XX1234. Total Amt Due Rs.0. Avl limit Rs.50000',
    date: '2026-09-03',
    receivedAt: Date.parse('2026-09-03T12:05:00Z'),
  },
];

const MAX_PAGES = 40;
const MAX_LLM = 48;
const LLM_CHUNK = 12;

type Hashed = {
  message: IncomingMessage;
  hash: string;
  content: string;
};

function commitItems(items: ReturnType<typeof toLedgerItem>[]) {
  useTransactionStore.getState().addMany(items);
  useEventStore.getState().addMany(items);
  useSubscriptionStore.getState().addMany(items);
}

function asProcessed(entries: Hashed[]) {
  return entries.flatMap((entry) => [
    {
      hash: entry.hash,
      sourceId: entry.message.id,
      receivedAt: entry.message.receivedAt ?? Date.now(),
      sender: entry.message.sender,
    },
    {
      hash: entry.content,
      sourceId: entry.message.id,
      receivedAt: entry.message.receivedAt ?? Date.now(),
      sender: entry.message.sender,
    },
  ]);
}

function keepableParsed(items: ParsedItem[], bodies: string[] = []) {
  return items
    .map((item) => (bodies.length > 0 ? sanitizeParsedItem(item, bodies) : item))
    .filter(
      (item): item is ParsedItem =>
        item != null &&
        isKeepableItem(item) &&
        !isUsageNoiseText([item.merchant, item.note, item.review].filter(Boolean).join(' ')),
    );
}

async function hashIncoming(messages: IncomingMessage[]): Promise<Hashed[]> {
  return Promise.all(
    messages.map(async (message) => ({
      message,
      hash: await hashMessage(message),
      content: await hashMessageContent(message),
    })),
  );
}

export async function getModelAvailability(): Promise<LlmAvailability> {
  return getLlmRuntime().getAvailability();
}

export async function downloadSelectedModel(onProgress: ProgressFn): Promise<void> {
  return getLlmRuntime().downloadSelectedModel(onProgress);
}

export async function unloadModelFromMemory(): Promise<boolean> {
  return getLlmRuntime().unloadFromMemory();
}

export function getModelRamState() {
  return getLlmRuntime().getRamState();
}

export async function askCoach(
  question: string,
  snapshot: string,
  onProgress: ProgressFn,
  history: CoachTurn[] = [],
): Promise<string> {
  return getLlmRuntime().askCoach(question, snapshot, onProgress, history);
}

export async function loadCoachSession(onProgress: ProgressFn): Promise<void> {
  return getLlmRuntime().acquireCoachSession(onProgress);
}

export async function unloadCoachSession(): Promise<void> {
  return getLlmRuntime().releaseCoachSession();
}

export async function processRefreshMessages(
  onProgress: ProgressFn,
  options: { skipMail?: boolean } = {},
): Promise<BatchResult> {
  const empty: BatchResult = {
    transactions: 0,
    events: 0,
    subscriptions: 0,
    errors: 0,
    skipped: 0,
    read: 0,
    calendar: 0,
    mail: 0,
  };

  try {
    const runtime = getLlmRuntime();
    const processed = useProcessedStore.getState();
    try {
      const rewalk = await ensureParserRevision();
      if (rewalk) {
        onProgress(0.04, 'Re-reading inbox with the updated money filter…');
      }
    } catch {
      onProgress(0.04, 'Continuing scan without a ledger reset…');
    }

    onProgress(0.06, 'Collecting messages…');
    const parsed: ParsedItem[] = [];
    const llmQueue: IncomingMessage[] = [];
    const llmEntries: Hashed[] = [];
    const verifyQueue: IncomingMessage[] = [];
    const handled: Hashed[] = [];
    let skipped = 0;
    let dropped = 0;
    let regexKept = 0;
    let moreHistory = false;
    let usedDemo = false;
    let lastInbox: InboxResult | null = null;
    let afterId = 0;
    let dateCursor = 0;
    let read = 0;
    let skipReason: string | undefined;
    const seenIds = new Set<string>();

    for (let page = 0; page < MAX_PAGES; page += 1) {
      let inbox: InboxResult;
      try {
        inbox = await collectInboxPage(afterId, dateCursor);
      } catch {
        skipReason = 'Could not open the SMS inbox. Calendar and Gmail are still checked.';
        break;
      }
      lastInbox = inbox;
      if (inbox.source === 'denied') {
        skipReason = 'SMS is off. Allow messages, then tap Refresh again.';
        break;
      }
      usedDemo = inbox.source === 'unavailable' && __DEV__;
      const incoming = (usedDemo ? DEMO_MESSAGES : inbox.messages).filter((message) => {
        if (seenIds.has(message.id)) {
          return false;
        }
        seenIds.add(message.id);
        return true;
      });
      if (!usedDemo && incoming.length === 0 && inbox.fetched > 0) {
        moreHistory = false;
        break;
      }
      read += incoming.length;
      if (inbox.lastNativeId > afterId) {
        afterId = inbox.lastNativeId;
      }
      let newest = 0;
      for (const message of incoming) {
        if ((message.receivedAt ?? 0) > newest) {
          newest = message.receivedAt ?? 0;
        }
      }
      if (newest > dateCursor) {
        dateCursor = newest;
      }
      const hashed = await hashIncoming(incoming);
      const fresh = hashed.filter((entry) => !processed.has(entry.hash) && !processed.has(entry.content));
      moreHistory = inbox.source === 'sms' && inbox.fetched >= inbox.limit;

      if (fresh.length === 0) {
        await rememberInboxPage(inbox);
        if (usedDemo || !moreHistory) {
          break;
        }
        onProgress(0.08 + page * 0.02, `Read ${read} SMS, skipping ones already parsed…`);
        continue;
      }

      onProgress(
        Math.min(0.7, 0.1 + page * 0.02),
        usedDemo ? 'Parsing sample bank SMS…' : `Reading SMS page ${page + 1} · ${read} so far…`,
      );

      const usable = fresh.filter((entry) => !isUsageAlert(entry.message));
      skipped += fresh.length - usable.length;
      const split = parseInbox(usable.map((entry) => entry.message));
      dropped += split.dropped;
      regexKept += split.parsed.length;
      parsed.push(...split.parsed);
      verifyQueue.push(...split.verify);
      const { keep, drop } = splitForLlm(split.unmatched);
      skipped += drop.length;

      const room = Math.max(0, MAX_LLM - llmQueue.length);
      const queued = keep.slice(0, room);
      const overflow = keep.slice(room);
      llmQueue.push(...queued);
      const queuedIds = new Set(queued.map((message) => message.id));
      const overflowIds = new Set(overflow.map((message) => message.id));
      llmEntries.push(...fresh.filter((entry) => queuedIds.has(entry.message.id)));
      const finished = fresh.filter(
        (entry) => !queuedIds.has(entry.message.id) && !overflowIds.has(entry.message.id),
      );

      handled.push(...finished);
      processed.markMany(finished.flatMap((entry) => [entry.hash, entry.content]));
      await rememberInboxPage(inbox);

      if (usedDemo || !moreHistory) {
        break;
      }
    }

    let availability: LlmAvailability = { status: 'unavailable', reason: 'Model not checked' };
    try {
      availability = await runtime.getAvailability();
    } catch {
      availability = { status: 'unavailable', reason: 'On-device model is not ready.' };
    }
    let fromModel: ParsedItem[] = [];
    let errors = 0;

    if (llmQueue.length > 0 && availability.status === 'available') {
      try {
        for (let index = 0; index < llmQueue.length; index += LLM_CHUNK) {
          const chunk = llmQueue.slice(index, index + LLM_CHUNK);
          onProgress(0.74, 'Reading leftover money messages…');
          const rawItems = await runtime.inferUnmatched(chunk, onProgress);
          const tagged = rawItems.map((item, itemIndex) => {
            const message = chunk[itemIndex];
            return withAccount(
              { ...item, sourceId: item.sourceId ?? message?.id },
              message?.sender ?? '',
              message?.body ?? '',
            );
          });
          fromModel.push(...keepableParsed(tagged, chunk.map((message) => message.body)));
        }
        handled.push(...llmEntries);
        processed.markMany(llmEntries.flatMap((entry) => [entry.hash, entry.content]));
      } catch (error) {
        errors = 1;
        skipReason =
          error instanceof Error && error.message === 'offline-cache-missing'
            ? 'Model files are not on this phone. Open Settings and tap Download model once.'
            : skipReason;
      }
    } else if (llmQueue.length > 0) {
      skipped += llmQueue.length;
      skipReason = skipReason ?? availability.reason;
    }

    if (verifyQueue.length > 0 && availability.status === 'available') {
      try {
        onProgress(0.86, 'Checking card copies…');
        const flags = await runtime.verifyMoneyMoves(verifyQueue.slice(0, 12), onProgress);
        const reject = new Set(
          verifyQueue.filter((_, index) => flags[index] === false).map((message) => message.id),
        );
        dropped += reject.size;
        for (let index = parsed.length - 1; index >= 0; index -= 1) {
          if (parsed[index].sourceId && reject.has(parsed[index].sourceId as string)) {
            parsed.splice(index, 1);
          }
        }
      } catch {
        // Keep regex hits if the card check fails.
      }
    }

    const beforeCollapse = keepableParsed([...parsed, ...fromModel]);
    const cleaned = collapseCardTwins(beforeCollapse, useTransactionStore.getState().items);
    dropped += beforeCollapse.length - cleaned.length;
    const items = cleaned.map((item, index) => toLedgerItem(item, item.sourceId ?? `sms-${index}`));
    if (items.length > 0 || handled.length > 0) {
      try {
        await persistParsedBatch({
          items,
          processed: asProcessed(handled),
        });
      } catch {
        skipReason = skipReason ?? 'Saved this batch in memory. SQLite skipped a row.';
      }
      commitItems(items);
    } else if (lastInbox) {
      try {
        await rememberInboxPage(lastInbox);
      } catch {
        // Cursor write is optional.
      }
    }

    onProgress(0.9, 'Reading Google Calendar…');
    let calendar = 0;
    let mail = 0;
    if (!options.skipMail) {
      try {
        const google = await importGoogleSources();
        calendar = google.events;
        mail = google.mail;
      } catch {
        calendar = 0;
        mail = 0;
      }
    }

    onProgress(0.95, 'Checking subscription apps on this phone…');
    let apps = 0;
    try {
      apps = await importInstalledSubscriptions();
    } catch {
      apps = 0;
    }

    onProgress(1, 'Done');
    const counts = countByType(items);
    const catalog = getCatalogModel(useSettingsStore.getState().modelId);
    try {
      await saveScanSummary({
        at: Date.now(),
        modelLabel: catalog.label,
        usedModel: availability.status === 'available' && (fromModel.length > 0 || verifyQueue.length > 0),
        transactions: counts.transactions + mail,
        events: counts.events + calendar,
        subscriptions: counts.subscriptions + apps,
        regex: regexKept,
        model: fromModel.length,
        dropped,
      });
    } catch {
      // Summary is optional.
    }
    return {
      ...counts,
      transactions: counts.transactions + mail,
      events: counts.events + calendar,
      subscriptions: counts.subscriptions + apps,
      errors,
      skipped,
      read,
      calendar,
      mail,
      skipReason,
      moreHistory,
    };
  } catch {
    onProgress(1, 'Done');
    return { ...empty, skipReason: 'Scan hit a device error. SMS already found is kept. Tap Refresh again.' };
  }
}
