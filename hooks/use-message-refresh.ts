import { useState } from 'react';
import { type Href, useRouter } from 'expo-router';

import { listMailAccounts, requestCalendarAccess } from '@/services/device-calendar';
import { processRefreshMessages } from '@/services/llm-service';
import { readHeapBytes, readMemory } from '@/services/memory-monitor';
import { useSettingsStore } from '@/store/settings-store';
import { useUiStore } from '@/store/ui-store';

let pendingMailPick: ((account: string | null) => void) | null = null;

function publishMemory(reading: Awaited<ReturnType<typeof readMemory>>) {
  const toMb = (bytes: number) => bytes / (1024 * 1024);
  useUiStore.getState().setMemory({
    usedMb: toMb(reading.usedBytes),
    availMb: toMb(reading.availBytes),
    totalMb: toMb(reading.totalBytes),
    modelMb: toMb(reading.modelBytes),
    diskMb: toMb(reading.diskBytes),
    deviceUsedMb: toMb(reading.deviceUsedBytes),
    deviceTotalMb: toMb(reading.deviceTotalBytes),
  });
}

export function useMessageRefresh() {
  const router = useRouter();
  const setProcessing = useUiStore((s) => s.setProcessing);
  const setProgress = useUiStore((s) => s.setProgress);
  const setToast = useUiStore((s) => s.setToast);
  const [mailChoices, setMailChoices] = useState<string[] | null>(null);

  function openResources() {
    router.push('/processing' as Href);
  }

  function pickMail(account: string) {
    useSettingsStore.getState().setGoogleAccount(account);
    pendingMailPick?.(account);
    pendingMailPick = null;
    setMailChoices(null);
  }

  function skipMail() {
    pendingMailPick?.(null);
    pendingMailPick = null;
    setMailChoices(null);
  }

  async function chooseMailAccount(accounts: string[]): Promise<string | null> {
    return new Promise((resolve) => {
      pendingMailPick = resolve;
      setMailChoices(accounts);
    });
  }

  async function refresh() {
    if (useUiStore.getState().isProcessing || mailChoices) {
      return;
    }

    let skipMailScan = false;
    try {
      await requestCalendarAccess();
      const accounts = await listMailAccounts();
      const saved = useSettingsStore.getState().googleAccount;
      if (accounts.length === 1 && saved !== accounts[0]) {
        useSettingsStore.getState().setGoogleAccount(accounts[0]);
      }
      if (accounts.length > 1 && !accounts.includes(saved)) {
        const picked = await chooseMailAccount(accounts);
        if (!picked) {
          skipMailScan = true;
        }
      }
    } catch {
      // Mail picker is optional. SMS still runs.
    }

    setProcessing(true);
    setProgress(0.02, 'Scanning this phone…');
    setToast({ kind: 'info', message: 'Scanning SMS, Calendar, and subscription apps…' });
    useUiStore.getState().clearMemory();

    let timer: ReturnType<typeof setInterval> | undefined;
    try {
      try {
        const baselineHeap = await readHeapBytes();
        const first = await readMemory(baselineHeap);
        publishMemory(first);
        timer = setInterval(() => {
          void readMemory(baselineHeap).then(publishMemory);
        }, 250);
      } catch {
        // Memory readout is optional. The scan still runs.
      }

      const result = await processRefreshMessages((progress, label) => {
        setProgress(progress, label);
      }, { skipMail: skipMailScan });

      const found = result.transactions + result.events + result.subscriptions + (result.life ?? 0) + (result.screenshotItems ?? 0);
      const extras = [
        result.read ? `${result.read} SMS` : '',
        result.calendar ? `${result.calendar} calendar` : '',
        result.mail ? `${result.mail} calendar notices` : '',
        result.subscriptions ? `${result.subscriptions} subs` : '',
        result.screenshots ? `${result.screenshots} screenshots, ${result.screenshotItems ?? 0} new items` : '',
      ]
        .filter(Boolean)
        .join(', ');
      const read = extras ? ` ${extras}.` : '';
      const again = result.moreHistory ? ' More SMS are still in those chats — tap Refresh again.' : '';

      if (found > 0) {
        setToast({
          kind: 'success',
          message: `Found ${result.life ?? 0} life items, ${result.events} events, ${result.transactions} transactions.${read}${again}`,
        });
        return;
      }

      if (result.skipReason) {
        setToast({
          kind: 'info',
          message: `${result.skipReason}${read}${again}`,
        });
        return;
      }

      setToast({
        kind: 'info',
        message: result.moreHistory
          ? `Read ${result.read ?? 0} SMS in this batch. Tap Refresh again for the rest.`
          : `Read ${result.read ?? 0} SMS. Nothing new in SMS, Calendar, or apps.`,
      });
    } catch {
      setToast({
        kind: 'info',
        message: 'Scan stopped early. Anything already found is saved. Tap Refresh to continue.',
      });
    } finally {
      if (timer) {
        clearInterval(timer);
      }
      setProcessing(false);
      setProgress(0, '');
    }
  }

  return { refresh, openResources, mailChoices, pickMail, skipMail };
}
