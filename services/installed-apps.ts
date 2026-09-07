import { persistParsedBatch } from '@/services/database';
import { getFinlifeNative } from '@/services/finlife-native';
import { useSubscriptionStore } from '@/store/subscription-store';
import type { LedgerItem } from '@/types/ledger';
import { isUtilitySubId, kindLabel, SUBSCRIPTION_APPS, subscriptionAppPackages } from '@/utils/subscription-apps';

function todayIso() {
  return new Date().toISOString();
}

export async function importInstalledSubscriptions(): Promise<number> {
  if (process.env.EXPO_OS !== 'android') {
    return 0;
  }
  const native = getFinlifeNative();
  if (!native?.filterInstalledPackages) {
    return 0;
  }

  let installed: string[] = [];
  try {
    installed = await native.filterInstalledPackages(subscriptionAppPackages());
  } catch {
    return 0;
  }

  const current = useSubscriptionStore.getState().items.filter((item) => !isUtilitySubId(item.id));
  if (current.length !== useSubscriptionStore.getState().items.length) {
    useSubscriptionStore.getState().replaceAll(current);
  }

  const found = new Set(installed);
  const items: LedgerItem[] = SUBSCRIPTION_APPS.filter((app) => found.has(app.packageName)).map((app) => ({
    id: `app-${app.id}`,
    type: 'subscription',
    amount: null,
    merchant: app.name,
    date: todayIso(),
    category: 'other',
    note: 'app',
    review: `${kindLabel(app.kind)} · installed on this phone`,
    valid: true,
    important: 'normal',
  }));

  if (items.length === 0) {
    return 0;
  }

  const known = new Set(useSubscriptionStore.getState().items.map((item) => item.id));
  const fresh = items.filter((item) => !known.has(item.id));
  if (fresh.length === 0) {
    return 0;
  }

  try {
    await persistParsedBatch({ items: fresh, processed: [] });
  } catch {
    // List them even if SQLite skips a row.
  }
  useSubscriptionStore.getState().addMany(fresh);
  return fresh.length;
}
