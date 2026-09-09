import {
  deleteTransactionsByIds,
  loadEvents,
  loadFixedExpenses,
  loadProcessedHashes,
  loadSalary,
  loadSubscriptions,
  loadTransactions,
  loadLifeItems,
  loadItemStates,
  loadCoachPins,
} from '@/services/database';
import { loadScanSummary } from '@/services/scan-summary';
import { loadAppSettings } from '@/services/settings-persist';
import { useBudgetStore } from '@/store/budget-store';
import { useCoachStore } from '@/store/coach-store';
import { useEventStore } from '@/store/event-store';
import { useLifeStore } from '@/store/life-store';
import { useProcessedStore } from '@/store/processed-store';
import { useScanSummaryStore } from '@/store/scan-summary-store';
import { useSettingsStore } from '@/store/settings-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import { useTransactionStore } from '@/store/transaction-store';
import { isUpcomingPlan } from '@/utils/information';
import { isUsageNoiseText } from '@/utils/message-filter';

export async function hydrateApp() {
  const [transactions, events, subscriptions, hashes, salary, expenses, settings, scanSummary, life, states, pins] =
    await Promise.all([
      loadTransactions(),
      loadEvents(),
      loadSubscriptions(),
      loadProcessedHashes(),
      loadSalary(),
      loadFixedExpenses(),
      loadAppSettings(),
      loadScanSummary(),
      loadLifeItems(),
      loadItemStates(),
      loadCoachPins(),
    ]);

  const noiseIds = new Set(
    transactions
      .filter((item) => isUsageNoiseText([item.merchant, item.note].filter(Boolean).join(' ')))
      .map((item) => item.id),
  );
  if (noiseIds.size > 0) {
    await deleteTransactionsByIds([...noiseIds]);
  }
  useTransactionStore.getState().replaceAll(transactions.filter((item) => !noiseIds.has(item.id)));
  useEventStore.getState().replaceAll(events.filter((item) => isUpcomingPlan(item)));
  useLifeStore.getState().replaceAll(life, states);
  useSubscriptionStore.getState().replaceAll(subscriptions.filter((item) => item.id !== 'app-drive'));
  useProcessedStore.getState().replaceAll(hashes);
  useBudgetStore.getState().replaceAll(salary, expenses);
  useSettingsStore.getState().replaceAll(settings);
  useScanSummaryStore.getState().replace(scanSummary);
  useCoachStore.getState().replacePins(pins);
}
