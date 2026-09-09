import { persistParsedBatch } from '@/services/database';
import { getFinlifeNative } from '@/services/finlife-native';
import { useEventStore } from '@/store/event-store';
import { useSettingsStore } from '@/store/settings-store';
import { useTransactionStore } from '@/store/transaction-store';
import type { NativeCalendarRow } from '@/modules/finlife-native';
import type { LedgerItem } from '@/types/ledger';
import { withAccount } from '@/utils/bank-account';
import { parseBankMessage, type IncomingMessage } from '@/utils/bank-parsers';
import { isRelevantEvent } from '@/utils/relevant-events';
import { spendAmount } from '@/utils/money-amount';

export type GoogleImportResult = {
  events: number;
  mail: number;
};

function asIso(value: string | Date | number | undefined): string {
  if (value == null || value === '') {
    return new Date().toISOString();
  }
  if (typeof value === 'number') {
    return new Date(value).toISOString();
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return new Date(Number(value)).toISOString();
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : value;
  }
  return new Date(value).toISOString();
}

function isGoogleAccount(text: string): boolean {
  return /gmail|google|@gmail\.com|@googlemail\.com/i.test(text);
}

function toEventItem(id: string, title: string, startAt: string, review: string): LedgerItem {
  return {
    id: `cal-${id.replace(/^cal-/, '')}-${startAt}`,
    type: 'event',
    amount: null,
    merchant: title.trim() || 'Calendar event',
    date: startAt,
    category: 'other',
    note: 'calendar',
    review: review.trim() || 'From Calendar on this phone',
    valid: true,
    important: 'normal',
  };
}

function toMailItem(id: string, title: string, notes: string, startAt: string): LedgerItem | null {
  const body = `${title} ${notes}`.trim();
  if (spendAmount(body) == null) {
    return null;
  }
  const message: IncomingMessage = {
    id,
    sender: 'GMAIL',
    body,
    date: startAt.slice(0, 10),
    receivedAt: Date.parse(startAt) || Date.now(),
  };
  const parsed = parseBankMessage(message);
  if (!parsed) {
    return null;
  }
  return withAccount(
    {
      ...parsed,
      id: id.startsWith('gmail-') ? id : `gmail-${id}`,
      sourceId: message.id,
      note: 'gmail',
      review: parsed.review || 'From Gmail / Google Calendar on this phone',
      bankId: 'gmail',
      bankLabel: 'Gmail',
    },
    'GMAIL',
    body,
  );
}

function calendarModule() {
  try {
    return require('expo-calendar') as typeof import('expo-calendar');
  } catch {
    return null;
  }
}

export async function requestCalendarAccess(): Promise<boolean> {
  if (process.env.EXPO_OS === 'web') {
    return false;
  }
  const Calendar = calendarModule();
  if (!Calendar) {
    return true;
  }
  try {
    const current = await Calendar.getCalendarPermissionsAsync();
    if (current.status === 'granted') {
      return true;
    }
    const next = await Calendar.requestCalendarPermissionsAsync();
    return next.status === 'granted';
  } catch {
    return true;
  }
}

export async function listMailAccounts(): Promise<string[]> {
  const found = new Set<string>();
  const native = getFinlifeNative();
  if (native?.getCalendarAccounts) {
    try {
      for (const account of await native.getCalendarAccounts()) {
        if (account.trim()) {
          found.add(account.trim());
        }
      }
    } catch {
      // Fall through to Expo calendars.
    }
  }
  const Calendar = calendarModule();
  if (Calendar) {
    try {
      const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
      for (const item of calendars) {
        const source = item.source?.name?.trim() ?? '';
        const title = item.title?.trim() ?? '';
        if (source.includes('@')) {
          found.add(source);
        } else if (title.includes('@')) {
          found.add(title);
        } else if (isGoogleAccount(`${source} ${title}`) && source) {
          found.add(source);
        }
      }
    } catch {
      // Keep native accounts only.
    }
  }
  return [...found].sort((left, right) => left.localeCompare(right));
}

function matchesAccount(rowAccount: string, selected: string): boolean {
  if (!selected) {
    return true;
  }
  return rowAccount.trim().toLowerCase() === selected.trim().toLowerCase();
}

async function eventsFromNative(
  start: Date,
  end: Date,
  account: string,
): Promise<{ events: LedgerItem[]; mail: LedgerItem[] }> {
  const native = getFinlifeNative();
  if (!native?.getCalendarEvents) {
    return { events: [], mail: [] };
  }
  let rows: NativeCalendarRow[] = [];
  try {
    rows = await native.getCalendarEvents(start.getTime(), end.getTime(), 250, account);
  } catch {
    return { events: [], mail: [] };
  }
  const events: LedgerItem[] = [];
  const mail: LedgerItem[] = [];
  for (const row of rows) {
    if (!row.id) {
      continue;
    }
    const startAt = asIso(row.start);
    const title = row.title || 'Calendar event';
    const extra = [row.notes, row.location, row.calendar, row.account].filter(Boolean).join(' · ');
    if (!matchesAccount(row.account, account)) {
      continue;
    }
    const eventItem = { ...toEventItem(row.id, title, startAt, extra), location: row.location, calendarName: row.calendar };
    if (isRelevantEvent(eventItem)) events.push(eventItem);
    const item = toMailItem(row.id, title, extra, startAt);
    if (item) {
      mail.push(item);
    }
  }
  return { events, mail };
}

async function eventsFromExpo(
  start: Date,
  end: Date,
  account: string,
): Promise<{ events: LedgerItem[]; mail: LedgerItem[] }> {
  const Calendar = calendarModule();
  if (!Calendar) {
    return { events: [], mail: [] };
  }
  try {
    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const ids = calendars
      .filter((item) => {
        if (!account) {
          return true;
        }
        return matchesAccount(item.source?.name ?? '', account) || matchesAccount(item.title ?? '', account);
      })
      .map((item) => item.id)
      .filter(Boolean);
    if (ids.length === 0) {
      return { events: [], mail: [] };
    }
    const rows: Awaited<ReturnType<typeof Calendar.getEventsAsync>> = [];
    for (const id of ids) {
      try {
        const batch = await Calendar.getEventsAsync([id], start, end);
        rows.push(...batch);
      } catch {
        // Skip one calendar if the device rejects the query.
      }
    }
    const events: LedgerItem[] = [];
    const mail: LedgerItem[] = [];
    for (const event of rows) {
      const startAt = event.allDay ? asIso(event.startDate).slice(0, 10) : asIso(event.startDate);
      const title = event.title?.trim() || 'Calendar event';
      const notes = [event.notes, event.location].filter(Boolean).join(' ');
      const eventItem = { ...toEventItem(String(event.id), title, startAt, notes), location: event.location, calendarName: calendars.find((calendar) => calendar.id === event.calendarId)?.title };
      if (isRelevantEvent(eventItem)) events.push(eventItem);
      const item = toMailItem(String(event.id), title, notes, startAt);
      if (item) {
        mail.push(item);
      }
    }
    return { events, mail };
  } catch {
    return { events: [], mail: [] };
  }
}

export async function importGoogleSources(): Promise<GoogleImportResult> {
  if (process.env.EXPO_OS === 'web') {
    return { events: 0, mail: 0 };
  }

  const allowed = await requestCalendarAccess();
  if (!allowed) {
    return { events: 0, mail: 0 };
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getFullYear(), start.getMonth() + 2, start.getDate());

  const account = useSettingsStore.getState().googleAccount;
  let collected = await eventsFromExpo(start, end, account);
  if (collected.events.length === 0) {
    collected = await eventsFromNative(start, end, account);
  }

  const knownEvents = new Set(useEventStore.getState().items.map((item) => item.id));
  const knownTx = new Set(useTransactionStore.getState().items.map((item) => item.id));
  const freshEvents = collected.events.filter((item) => !knownEvents.has(item.id));
  const freshMail = collected.mail.filter((item) => !knownTx.has(item.id));
  const fresh = [...freshEvents, ...freshMail];
  if (fresh.length === 0) {
    return { events: 0, mail: 0 };
  }

  try {
    await persistParsedBatch({ items: fresh, processed: [] });
  } catch {
    // Keep them in memory if SQLite rejects a row.
  }
  useEventStore.getState().addMany(freshEvents);
  useTransactionStore.getState().addMany(freshMail);
  return { events: freshEvents.length, mail: freshMail.length };
}

export async function importDeviceCalendar(): Promise<number> {
  const result = await importGoogleSources();
  return result.events;
}
