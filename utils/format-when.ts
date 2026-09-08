import { parseLocalDate } from '@/utils/message-date';

export function formatLedgerWhen(value: string | null | undefined): string {
  if (!value) {
    return 'Time not set';
  }

  const parsed = parseLocalDate(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  const date = parsed.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return date;
  }

  const time = parsed.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
  return `${date} · ${time}`;
}

export function formatLedgerClock(value: string | null | undefined): string {
  if (!value || /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return '';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }
  return parsed.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  });
}
