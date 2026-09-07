import { clearBudgetTables, clearLedgerTables } from '@/services/database';
import { useBudgetStore } from '@/store/budget-store';
import { useEventStore } from '@/store/event-store';
import { useProcessedStore } from '@/store/processed-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import { useTransactionStore } from '@/store/transaction-store';

export async function resetLedgerData() {
  await clearLedgerTables();
  useTransactionStore.getState().replaceAll([]);
  useEventStore.getState().replaceAll([]);
  useSubscriptionStore.getState().replaceAll([]);
  useProcessedStore.getState().replaceAll([]);
}

export async function resetBudgetData() {
  await clearBudgetTables();
  useBudgetStore.getState().replaceAll(0, []);
}

export async function resetLocalData(includeBudget: boolean) {
  await resetLedgerData();
  if (includeBudget) {
    await resetBudgetData();
  }
}
