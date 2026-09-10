import { getLlmRuntime } from '@/services/llm-runtime';
import { useBudgetStore } from '@/store/budget-store';
import { useEventStore } from '@/store/event-store';
import { useLifeStore } from '@/store/life-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import { useTransactionStore } from '@/store/transaction-store';
import { useUiStore } from '@/store/ui-store';
import { agendaGroups } from '@/utils/life-agenda';
import { briefFactHash, dayBriefFacts, localHomeBrief, sanitizeDayBrief } from '@/utils/home-brief';
import { isInCurrentMonth } from '@/utils/month-finance';
import { regionalHolidays } from '@/utils/regional-holidays';
import { relevantEvents } from '@/utils/relevant-events';
import { confirmedRenewals } from '@/utils/renewals';

const BRIEF_ASK =
  'Write two or three warm sentences (max 40 words) about this person\'s day from the notes. Fill a short three-line home brief. Sound like a kind assistant, not a status report. No greeting. No list. No emoji. Do not say "needs a review", "quick review", or "items need".';

function currentBriefInput() {
  const now = new Date();
  const life = useLifeStore.getState();
  const events = useEventStore.getState().items;
  const subscriptions = useSubscriptionStore.getState().items;
  const transactions = useTransactionStore.getState().financeItems;
  const groups = agendaGroups(
    [
      ...life.items,
      ...relevantEvents([...events, ...regionalHolidays(now)], life.states, now),
      ...confirmedRenewals(subscriptions, life.states),
    ],
    life.states,
    now,
  );
  let spend = 0;
  for (const item of transactions) {
    if (item.category === 'income' || item.amount == null || !isInCurrentMonth(item.date, now)) {
      continue;
    }
    spend += item.amount;
  }
  const money = { spend };
  return {
    local: localHomeBrief(groups, money),
    facts: dayBriefFacts(groups, money),
  };
}

let running: Promise<string> | null = null;

export async function refreshHomeBrief(options?: { allowLoad?: boolean }) {
  if (running) {
    return running;
  }
  running = writeHomeBrief(options).finally(() => {
    running = null;
  });
  return running;
}

async function writeHomeBrief(options?: { allowLoad?: boolean }) {
  const input = currentBriefInput();
  const hash = briefFactHash(input.facts || input.local);
  const store = useUiStore.getState();
  if (store.homeBrief && store.homeBriefHash === hash) {
    return store.homeBrief;
  }
  store.setHomeBrief(input.local, hash);

  if (store.imageBusy) {
    return input.local;
  }

  const runtime = getLlmRuntime();
  const ram = runtime.getRamState();
  if (!ram.loaded && !options?.allowLoad) {
    return input.local;
  }

  try {
    const availability = await runtime.getAvailability();
    if (availability.status !== 'available') {
      return input.local;
    }
    if (!ram.loaded && !options?.allowLoad) {
      return input.local;
    }
    const raw = await runtime.askCoach(
      input.facts ? `${BRIEF_ASK}\n\nNotes:\n${input.facts}` : BRIEF_ASK,
      '',
      () => undefined,
      [],
    );
    const next = sanitizeDayBrief(raw, input.local);
    useUiStore.getState().setHomeBrief(next, hash);
    return next;
  } catch {
    return input.local;
  }
}
