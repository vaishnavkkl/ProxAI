import { requireOptionalNativeModule } from 'expo';

import type { NativeCalendarRow, NativeInboxRow, NativeMemorySnapshot, NativeScreenshot } from '@/modules/finlife-native';

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
  resolveSubscriptionLinks?: (links: { packageName: string; url: string }[]) => Promise<string[]>;
  openSubscriptionApp?: (packageName: string, url: string) => Promise<void>;
  getAppIcon?: (packageName: string) => Promise<string>;
  getScreenshotPage?: (since: number, until: number, afterId: number) => Promise<NativeScreenshot[]>;
  getScreenshotHash?: (uri: string) => Promise<string>;
  recognizeScreenshot?: (uri: string) => Promise<string>;
};

export function getFinlifeNative(): FinlifeNativeModule | null {
  return requireOptionalNativeModule<FinlifeNativeModule>('FinlifeNative');
}
