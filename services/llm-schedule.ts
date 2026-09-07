export type ScheduleWindow = {
  start: string;
  end: string;
};

export const DEFAULT_WINDOWS: ScheduleWindow[] = [
  { start: '06:00', end: '09:00' },
  { start: '12:00', end: '13:00' },
  { start: '20:00', end: '22:00' },
];

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isClockTime(value: string): boolean {
  return TIME.test(value.trim());
}

export function parseWindows(raw: string | null): ScheduleWindow[] {
  if (!raw) {
    return DEFAULT_WINDOWS;
  }

  try {
    const parsed = JSON.parse(raw) as ScheduleWindow[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_WINDOWS;
    }
    const valid = parsed.filter((item) => isClockTime(item.start) && isClockTime(item.end));
    return valid.length > 0 ? valid : DEFAULT_WINDOWS;
  } catch {
    return DEFAULT_WINDOWS;
  }
}

export function formatWindows(windows: ScheduleWindow[]): string {
  return windows.map((item) => `${item.start}–${item.end}`).join(', ') + ' + Refresh';
}

function minutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  return hour * 60 + minute;
}

export function isInLlmWindow(now: Date, windows: ScheduleWindow[]): boolean {
  const current = now.getHours() * 60 + now.getMinutes();
  return windows.some((item) => {
    const start = minutes(item.start);
    const end = minutes(item.end);
    if (end >= start) {
      return current >= start && current < end;
    }
    return current >= start || current < end;
  });
}
