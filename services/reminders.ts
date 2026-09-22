import * as Notifications from 'expo-notifications';

import { informationTitle, isUpcomingPlan } from '@/utils/information';
import { formatLedgerWhen } from '@/utils/format-when';
import { parseLocalDate } from '@/utils/message-date';
import { relevantEvents } from '@/utils/relevant-events';
import { useEventStore } from '@/store/event-store';
import { useLifeStore } from '@/store/life-store';
import { useSettingsStore } from '@/store/settings-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import { useUiStore } from '@/store/ui-store';
import type { LedgerItem } from '@/types/ledger';

const CHANNEL_PLANS = 'reminders';
const CHANNEL_UPDATES = 'updates';
const CATEGORY_PLAN = 'proxai_plan';
const CATEGORY_SCAN = 'proxai_scan';
export const ACTION_OPEN = 'open';
export const ACTION_DONE = 'done';
export const ACTION_SNOOZE = 'snooze';

const SNOOZE_SECONDS = 60 * 60;

if (process.env.EXPO_OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    }),
  });
}

function canNotify() {
  return process.env.EXPO_OS !== 'web';
}

export async function setupReminderChannels() {
  if (!canNotify()) {
    return;
  }
  await Notifications.setNotificationChannelAsync(CHANNEL_PLANS, {
    name: 'Upcoming plans',
    description: 'Bills, bookings, and appointments on this phone',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 120, 250],
    lightColor: '#2563EB',
    enableVibrate: true,
    enableLights: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    showBadge: true,
    // Omit sound to use Android's default; a string is a bundled filename.
  });
  await Notifications.setNotificationChannelAsync(CHANNEL_UPDATES, {
    name: 'Scan updates',
    description: 'When Refresh finds new upcoming plans',
    importance: Notifications.AndroidImportance.DEFAULT,
    vibrationPattern: [0, 180],
    enableVibrate: true,
    showBadge: true,
    // Omit sound to use Android's default notification tone.
  });
  await Notifications.setNotificationCategoryAsync(CATEGORY_PLAN, [
    { identifier: ACTION_DONE, buttonTitle: 'Mark done', options: { opensAppToForeground: false } },
    { identifier: ACTION_SNOOZE, buttonTitle: 'Snooze 1h', options: { opensAppToForeground: false } },
    { identifier: ACTION_OPEN, buttonTitle: 'View', options: { opensAppToForeground: true } },
  ]);
  await Notifications.setNotificationCategoryAsync(CATEGORY_SCAN, [
    { identifier: ACTION_OPEN, buttonTitle: 'View', options: { opensAppToForeground: true } },
    { identifier: ACTION_DONE, buttonTitle: 'Dismiss', options: { opensAppToForeground: false } },
  ]);
}

export async function requestReminderPermission(): Promise<boolean> {
  if (!canNotify()) {
    return false;
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }
  const next = await Notifications.requestPermissionsAsync();
  return next.granted;
}

function reminderId(item: LedgerItem, kind: string) {
  return `plan_${kind}_${item.id}`.replace(/[^A-Za-z0-9_]/g, '_').slice(0, 64);
}

function fireDate(item: LedgerItem, now: Date): Date | null {
  const parsed = parseLocalDate(item.date ?? '');
  if (!Number.isFinite(parsed.getTime())) {
    return null;
  }
  const when = new Date(parsed);
  if ((item.date ?? '').length === 10) {
    when.setHours(9, 0, 0, 0);
  } else {
    when.setTime(parsed.getTime() - 60 * 60 * 1000);
  }
  if (when.getTime() <= now.getTime() + 15_000) {
    return null;
  }
  return when;
}

function planItems(now = new Date()): LedgerItem[] {
  const states = useLifeStore.getState().states;
  const events = relevantEvents(useEventStore.getState().items, states, now);
  const life = useLifeStore.getState().items.filter((item) => isUpcomingPlan(item, now) && item.type !== 'transaction');
  const renewals = useSubscriptionStore.getState().items.filter((item) => isUpcomingPlan(item, now) && item.note !== 'app');
  const seen = new Set<string>();
  const out: LedgerItem[] = [];
  for (const item of [...events, ...life, ...renewals]) {
    if (seen.has(item.id) || states[item.id]?.status && states[item.id]?.status !== 'open') {
      continue;
    }
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function contentFor(item: LedgerItem, extra?: string) {
  const when = formatLedgerWhen(item.date);
  return {
    title: informationTitle(item),
    subtitle: extra ?? (item.type === 'bill' ? 'Payment due' : 'Upcoming plan'),
    body: item.date ? when : 'Open to review this plan',
    categoryIdentifier: CATEGORY_PLAN,
    data: { itemId: item.id, kind: 'plan' },
    sound: 'default' as const,
    color: '#2563EB',
    autoDismiss: false,
    interruptionLevel: 'timeSensitive' as const,
  };
}

export async function clearPlanReminders() {
  if (!canNotify()) {
    return;
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
}

export async function syncPlanReminders(now = new Date()) {
  if (!canNotify() || !useSettingsStore.getState().remindersOn) {
    return;
  }
  const allowed = await requestReminderPermission();
  if (!allowed) {
    return;
  }
  await Notifications.cancelAllScheduledNotificationsAsync();
  const items = planItems(now).slice(0, 40);
  for (const item of items) {
    const when = fireDate(item, now);
    if (!when) {
      continue;
    }
    await Notifications.scheduleNotificationAsync({
      identifier: reminderId(item, 'due'),
      content: contentFor(item),
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
        channelId: CHANNEL_PLANS,
      },
    });
  }
}

export async function notifyScanResult(counts: { events: number; life: number; bills: number }) {
  if (!canNotify() || !useSettingsStore.getState().remindersOn) {
    return;
  }
  const upcoming = planItems();
  const found = counts.events + counts.life + counts.bills;
  if (found <= 0 && upcoming.length === 0) {
    await syncPlanReminders();
    return;
  }
  const allowed = await requestReminderPermission();
  if (!allowed) {
    return;
  }
  const parts = [
    counts.events ? `${counts.events} upcoming ${counts.events === 1 ? 'event' : 'events'}` : '',
    counts.bills ? `${counts.bills} ${counts.bills === 1 ? 'bill' : 'bills'}` : '',
    counts.life ? `${counts.life} other plans` : '',
  ].filter(Boolean);
  await Notifications.scheduleNotificationAsync({
    identifier: 'scan_complete',
    content: {
      title: upcoming.length ? 'New plans are ready' : 'Scan finished',
      body: parts.length ? parts.join(' · ') : `${upcoming.length} upcoming items on this phone`,
      categoryIdentifier: CATEGORY_SCAN,
      data: { kind: 'scan' },
      sound: 'default',
      color: '#2563EB',
      autoDismiss: true,
    },
    trigger: { channelId: CHANNEL_UPDATES },
  });
  await syncPlanReminders();
}

export function subscribeReminderActions() {
  if (!canNotify()) {
    return { remove() {} };
  }
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const action = response.actionIdentifier;
    const itemId = String(response.notification.request.content.data?.itemId ?? '');
    if (action === ACTION_SNOOZE && itemId) {
      const item = planItems().find((entry) => entry.id === itemId);
      void Notifications.scheduleNotificationAsync({
        identifier: reminderId(item ?? { id: itemId } as LedgerItem, 'snooze'),
        content: item ? contentFor(item, 'Snoozed') : {
          title: 'Reminder',
          body: 'Snoozed for 1 hour',
          categoryIdentifier: CATEGORY_PLAN,
          data: { itemId, kind: 'plan' },
          sound: 'default',
          color: '#2563EB',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
          seconds: SNOOZE_SECONDS,
          channelId: CHANNEL_PLANS,
        },
      });
      return;
    }
    if ((action === ACTION_DONE || action === 'dismiss') && itemId) {
      void useLifeStore.getState().update(itemId, { status: 'done' }).then(() => {
        void Notifications.dismissNotificationAsync(response.notification.request.identifier);
        void syncPlanReminders();
      });
      return;
    }
    if (action === ACTION_DONE && !itemId) {
      void Notifications.dismissNotificationAsync(response.notification.request.identifier);
      return;
    }
    if (itemId && (action === ACTION_OPEN || action === Notifications.DEFAULT_ACTION_IDENTIFIER)) {
      useUiStore.getState().setSelectedLedgerId(itemId);
    }
  });
}
