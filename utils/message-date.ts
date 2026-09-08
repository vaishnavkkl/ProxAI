const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function localDay(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseLocalDate(value: string): Date {
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
}

// Resolve relative dates against receipt time, never the day an old SMS is scanned.
// A missing or invalid date stays unknown instead of becoming a fabricated deadline.
export function extractMessageDate(body: string, received: string | number): string | null {
  const base = typeof received === 'number' ? new Date(received) : parseLocalDate(received);
  if (!Number.isFinite(base.getTime())) return null;
  let year = base.getFullYear();
  let month = base.getMonth();
  let day = base.getDate();
  let explicit = false;
  const iso = body.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  const named = body.match(/\b(\d{1,2})[-/ ](Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:[-/ ,]+(20\d{2}|\d{2})\b)?/i);
  const first = body.match(/\b(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(20\d{2}))?\b/i);
  const numeric = body.match(/\b(\d{1,2})[/-](\d{1,2})(?:[/-](20\d{2}|\d{2}))?\b/);
  const match = iso ?? named ?? first ?? numeric;
  if (match) {
    explicit = true;
    if (iso) { year = +iso[1]; month = +iso[2] - 1; day = +iso[3]; }
    else if (named) { day = +named[1]; month = MONTHS.indexOf(named[2].slice(0, 3).toLowerCase()); year = named[3] ? +named[3] : year; }
    else if (first) { day = +first[2]; month = MONTHS.indexOf(first[1].slice(0, 3).toLowerCase()); year = first[3] ? +first[3] : year; }
    else if (numeric) { day = +numeric[1]; month = +numeric[2] - 1; year = numeric[3] ? +numeric[3] : year; }
    if (year < 100) year += 2000;
    if (!iso && !match[3] && base.getMonth() === 11 && month === 0) year += 1;
  } else if (/\b(day after tomorrow|tomorrow|today|tonight)\b/i.test(body)) {
    const offset = /day after tomorrow/i.test(body) ? 2 : /tomorrow/i.test(body) ? 1 : 0;
    const relative = new Date(base); relative.setDate(day + offset);
    year = relative.getFullYear(); month = relative.getMonth(); day = relative.getDate();
    explicit = true;
  } else {
    const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const weekday = body.match(/\b(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i);
    if (weekday) {
      let offset = (weekdays.indexOf(weekday[2].toLowerCase()) - base.getDay() + 7) % 7;
      if (weekday[1] && offset === 0) offset = 7;
      const relative = new Date(base); relative.setDate(day + offset);
      year = relative.getFullYear(); month = relative.getMonth(); day = relative.getDate(); explicit = true;
    }
  }
  const time = body.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i) ?? body.match(/\b(?:at|by|departs?|departure|arrives?)\s+(\d{1,2}):(\d{2})\b/i);
  if (!explicit) return null;
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
  if (time) {
    let hour = +time[1]; const minute = +(time[2] ?? 0); const period = time[3]?.toLowerCase();
    if (minute > 59 || (period ? hour < 1 || hour > 12 : hour > 23)) return null;
    if (period) hour = hour % 12 + (period === 'pm' ? 12 : 0);
    date.setHours(hour, minute, 0, 0);
    return date.toISOString();
  }
  return localDay(date);
}
