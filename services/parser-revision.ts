import { clearSmsDerivedLedger, getScanMeta, loadEvents, loadSubscriptions, setScanMeta } from '@/services/database';
import { markLookbackExpanded } from '@/services/scan-window';
import { useEventStore } from '@/store/event-store';
import { useProcessedStore } from '@/store/processed-store';
import { useSettingsStore } from '@/store/settings-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import { useTransactionStore } from '@/store/transaction-store';

export const PARSER_VERSION = '10';

export async function ensureParserRevision(): Promise<boolean> {
  const current = await getScanMeta('parser_version');
  if (current === PARSER_VERSION) {
    return false;
  }

  await clearSmsDerivedLedger();
  useTransactionStore.getState().replaceAll([]);
  useSubscriptionStore.getState().replaceAll(await loadSubscriptions());
  useEventStore.getState().replaceAll(await loadEvents());
  useProcessedStore.getState().replaceAll([]);
  await markLookbackExpanded(useSettingsStore.getState().scanLookbackMonths);
  await setScanMeta('parser_version', PARSER_VERSION);
  return true;
}
