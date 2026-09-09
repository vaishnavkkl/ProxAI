import * as Notifications from 'expo-notifications';

import { requestReminderPermission } from '@/services/reminders';

const CHANNEL = 'downloads';
const NOTICE_ID = 'proxai_model_download';

let lastAt = 0;
let lastLabel = '';
let lastPercent = -1;
let ready = false;

async function ensureChannel() {
  if (ready || process.env.EXPO_OS === 'web') {
    return process.env.EXPO_OS !== 'web';
  }
  const allowed = await requestReminderPermission();
  if (!allowed) {
    return false;
  }
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Model downloads',
    description: 'Language and image model downloads on this phone',
    importance: Notifications.AndroidImportance.DEFAULT,
    enableVibrate: false,
    showBadge: false,
    sound: null,
  });
  ready = true;
  return true;
}

export async function reportDownloadNotice(progress: number, label: string) {
  if (process.env.EXPO_OS === 'web') {
    return;
  }
  const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
  const now = Date.now();
  if (percent < 100 && now - lastAt < 400 && lastLabel === label && lastPercent === percent) {
    return;
  }
  lastAt = now;
  lastLabel = label;
  lastPercent = percent;
  if (!(await ensureChannel())) {
    return;
  }
  await Notifications.scheduleNotificationAsync({
    identifier: NOTICE_ID,
    content: {
      title: percent >= 100 ? 'Saved on this phone' : 'Downloading on this phone',
      body: `${percent}% · ${label}`,
      sticky: percent < 100,
      autoDismiss: percent >= 100,
      sound: percent >= 100 || percent <= 4,
      color: '#2563EB',
    },
    trigger: { channelId: CHANNEL },
  });
}

export async function finishDownloadNotice(ok: boolean, message: string) {
  lastAt = 0;
  lastLabel = '';
  lastPercent = -1;
  if (process.env.EXPO_OS === 'web') {
    return;
  }
  if (!(await ensureChannel())) {
    return;
  }
  await Notifications.dismissNotificationAsync(NOTICE_ID).catch(() => undefined);
  await Notifications.scheduleNotificationAsync({
    identifier: `${NOTICE_ID}_done`,
    content: {
      title: ok ? 'Download finished' : 'Download stopped',
      body: message,
      sticky: false,
      autoDismiss: true,
      sound: true,
      color: ok ? '#10B981' : '#EF4444',
    },
    trigger: { channelId: CHANNEL },
  });
}
