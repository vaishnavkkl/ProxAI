import { PermissionsAndroid } from 'react-native';

import { getLastReceivedAt, getLastScanAt, setScanMeta } from '@/services/database';
import { lookbackLabel, startOfMonthsAgo } from '@/services/scan-window';
import { loadAppSettings } from '@/services/settings-persist';
import { canUseNativeLlm } from '@/utils/app-runtime';
import type { IncomingMessage } from '@/utils/bank-parsers';
import { localDay } from '@/utils/message-date';

import { getFinlifeNative } from './finlife-native';

export const INBOX_PAGE_SIZE = 200;

export type InboxResult = {
  messages: IncomingMessage[];
  source: 'sms' | 'unavailable' | 'denied';
  fetched: number;
  limit: number;
  lastNativeId: number;
  backfill: boolean;
};

function emptyInbox(source: InboxResult['source']): InboxResult {
  return { messages: [], source, fetched: 0, limit: 0, lastNativeId: 0, backfill: false };
}

function toIsoDate(millis: number) {
  return localDay(new Date(millis));
}

export async function requestSmsPermission(): Promise<boolean> {
  if (process.env.EXPO_OS !== 'android') {
    return false;
  }

  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.READ_SMS, {
    title: 'Read messages',
    message: 'ProxAI reads every SMS in the range you pick, including each bank chat. Nothing is sent to a server.',
    buttonPositive: 'Allow',
    buttonNegative: 'Not now',
  });

  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export async function collectInboxPage(afterId = 0): Promise<InboxResult> {
  if (!canUseNativeLlm() || process.env.EXPO_OS !== 'android') {
    return emptyInbox('unavailable');
  }

  const native = getFinlifeNative();
  if (!native) {
    return emptyInbox('unavailable');
  }

  const allowed = await requestSmsPermission();
  if (!allowed) {
    return emptyInbox('denied');
  }

  const settings = await loadAppSettings();
  const windowStart = startOfMonthsAgo(settings.scanLookbackMonths);
  const limit = INBOX_PAGE_SIZE;
  let rows: { id: string; sender: string; body: string; date: string }[] = [];
  if (!native.getInboxSince) throw new Error('Update the Android build to scan SMS history.');
  rows = await native.getInboxSince(windowStart, limit, afterId);

  const list = Array.isArray(rows) ? rows : [];
  const messages = list.map((row) => {
    const receivedAt = Number(row.date);
    return {
      id: `sms-${row.id}`,
      sender: row.sender,
      body: row.body,
      date: Number.isFinite(receivedAt) ? toIsoDate(receivedAt) : toIsoDate(Date.now()),
      receivedAt: Number.isFinite(receivedAt) ? receivedAt : Date.now(),
    };
  });

  const lastNativeId = list.reduce((max, row) => {
    const id = Number(row.id);
    return Number.isFinite(id) && id > max ? id : max;
  }, afterId);

  return {
    messages,
    source: 'sms',
    fetched: messages.length,
    limit,
    lastNativeId,
    backfill: messages.length >= limit,
  };
}

export async function rememberInboxPage(inbox: InboxResult) {
  if (inbox.source !== 'sms') {
    return;
  }
  const newest = Math.max(0, ...inbox.messages.map((message) => message.receivedAt ?? 0));
  await setScanMeta('last_scan_at', String(Date.now()));
  if (newest > 0) {
    const previous = await getLastReceivedAt();
    if (newest > previous) {
      await setScanMeta('last_received_at', String(newest));
    }
  }
}

function formatWhen(millis: number): string {
  if (!millis) {
    return 'never';
  }
  return new Date(millis).toLocaleString();
}

export async function describeSmsAccess(): Promise<string> {
  if (process.env.EXPO_OS !== 'android') {
    return 'SMS inbox is Android-only.';
  }
  if (!canUseNativeLlm()) {
    return 'SMS needs a development build. Expo Go cannot read the inbox.';
  }

  const native = getFinlifeNative();
  if (!native) {
    return 'Native SMS module is missing. Rebuild with npx expo run:android.';
  }

  const settings = await loadAppSettings();
  const lastReceived = await getLastReceivedAt();
  const lastScan = await getLastScanAt();
  const range = lookbackLabel(settings.scanLookbackMonths);
  return `Tap Allow, then Refresh. Reads every SMS in ${range}, including each message in a bank chat. Last scan ${formatWhen(lastScan)}. Newest message ${formatWhen(lastReceived)}.`;
}
