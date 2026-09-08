import { persistParsedBatch } from '@/services/database';
import { getFinlifeNative } from '@/services/finlife-native';
import { useSubscriptionStore } from '@/store/subscription-store';
import type { LedgerItem } from '@/types/ledger';
import { isUtilitySubId, kindLabel, SUBSCRIPTION_APPS, SUBSCRIPTION_LINKS, subscriptionAppPackages } from '@/utils/subscription-apps';

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
    if (native.resolveSubscriptionLinks) {
      const linked = await native.resolveSubscriptionLinks(SUBSCRIPTION_APPS.flatMap((app) => SUBSCRIPTION_LINKS[app.id] ? [{ packageName: app.packageName, url: SUBSCRIPTION_LINKS[app.id] }] : []));
      installed = [...new Set([...installed, ...linked])];
    }
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
    date: null,
    category: 'other',
    note: 'app',
    review: `${kindLabel(app.kind)} · installed app; subscription not confirmed`,
    valid: false,
    important: 'normal',
  }));

  const known = new Set(useSubscriptionStore.getState().items.map((item) => item.id));
  const fresh = items.filter((item) => !known.has(item.id));

  try {
    if (items.length) await persistParsedBatch({ items, processed: [] });
  } catch {
    // List them even if SQLite skips a row.
  }
  const savedPlans = useSubscriptionStore.getState().items.filter((item) => !item.id.startsWith('app-') && item.note !== 'app');
  useSubscriptionStore.getState().replaceAll([...savedPlans, ...items]);
  return fresh.length;
}

export async function openDiscoveredApp(id: string) {
  const app = SUBSCRIPTION_APPS.find((item) => `app-${item.id}` === id);
  const native = getFinlifeNative();
  if (!app || !native?.openSubscriptionApp) throw new Error('Rebuild the app to open installed services.');
  await native.openSubscriptionApp(app.packageName, SUBSCRIPTION_LINKS[app.id] ?? '');
}
