import { setHistorySince, setScanMeta } from '@/services/database';
import type { ScanLookbackMonths } from '@/services/settings-persist';

const LOOKBACK_LABELS: Record<ScanLookbackMonths, string> = {
  1: 'this month',
  2: 'the last 2 months',
  3: 'the last 3 months',
  6: 'the last 6 months',
};

export function startOfMonthsAgo(months: number) {
  const date = new Date();
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  date.setMonth(date.getMonth() - Math.max(0, months - 1));
  return date.getTime();
}

export function lookbackLabel(months: ScanLookbackMonths) {
  return LOOKBACK_LABELS[months] ?? 'this month';
}

export async function markLookbackExpanded(months: ScanLookbackMonths) {
  const windowStart = startOfMonthsAgo(months);
  await setHistorySince(windowStart > 0 ? windowStart - 1 : 0);
  await setScanMeta('applied_lookback_months', String(months));
}
