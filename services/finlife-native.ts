import { requireOptionalNativeModule } from 'expo';

import type { NativeCalendarRow, NativeInboxRow, NativeMemorySnapshot } from '@/modules/finlife-native';

type FinlifeNativeModule = {
  getMemorySnapshot: () => Promise<NativeMemorySnapshot>;
  getTodaysInbox: () => Promise<NativeInboxRow[]>;
  getInboxSince?: (sinceMillis: number, limit?: number, afterId?: number) => Promise<NativeInboxRow[]>;
  getCalendarEvents?: (
    startMillis: number,
    endMillis: number,
    limit?: number,
    account?: string,
  ) => Promise<NativeCalendarRow[]>;
  getCalendarAccounts?: () => Promise<string[]>;
  filterInstalledPackages?: (packages: string[]) => Promise<string[]>;
};

export function getFinlifeNative(): FinlifeNativeModule | null {
  return requireOptionalNativeModule<FinlifeNativeModule>('FinlifeNative');
}
