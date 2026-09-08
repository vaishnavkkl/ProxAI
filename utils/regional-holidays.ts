import type { LedgerItem } from '@/types/ledger';
import { localDay } from '@/utils/message-date';

export const HOLIDAY_SOURCE = 'https://gad.kerala.gov.in/sites/default/files/inline-files/diary2026_0.pdf';
// Selected Kerala/India observances from the official 2026 list. Lunar dates are
// deliberately year-specific; never repeat them into a year with no verified data.
const DATED: [string, string][] = [
  ['2026-03-20', 'Eid al-Fitr'], ['2026-04-03', 'Good Friday'],
  ['2026-04-05', 'Easter'], ['2026-04-14', 'Vishu'],
  ['2026-05-27', 'Bakrid'], ['2026-06-25', 'Muharram'],
  ['2026-08-25', 'Milad-un-Nabi'], ['2026-08-26', 'Onam'],
  ['2026-08-28', 'Ayyankali Jayanthi'], ['2026-09-21', 'Sree Narayana Guru Samadhi'],
  ['2026-10-20', 'Mahanavami'], ['2026-10-21', 'Vijayadashami'],
  ['2026-11-08', 'Diwali'],
];
const FIXED: [string, string][] = [['01-01', "New Year's Day"], ['01-26', 'Republic Day'], ['08-15', 'Independence Day'], ['10-02', 'Gandhi Jayanti'], ['12-25', 'Christmas']];

export function regionalHolidays(now = new Date()): LedgerItem[] {
  const end = new Date(now); end.setFullYear(end.getFullYear() + 1);
  const dates = [...DATED];
  for (const year of [now.getFullYear(), end.getFullYear()]) for (const [day, title] of FIXED) dates.push([`${year}-${day}`, title]);
  return dates.filter(([day]) => day >= localDay(now) && day <= localDay(end)).map(([date, merchant]) => ({
    id: `holiday-${date}-${merchant.toLowerCase().replace(/[^a-z]+/g, '-')}`,
    type: 'event', date, merchant, amount: null, category: 'other', valid: true,
    note: 'calendar', calendarName: 'Kerala & India holidays', location: 'Kerala, India',
    review: 'Kerala / India observance. Individual school and workplace calendars may differ.',
  }));
}

export function holidayIdentity(title: string) {
  const value = title.toLowerCase().trim();
  if (/^(diwali|deepavali)([\s/(),-]*(diwali|deepavali))*[\s)]*$/.test(value)) return 'diwali';
  return value.replace(/christmas(?: day)?/g, 'christmas').replace(/(?:mahatma )?gandhi(?:.?s birthday| jayanthi| jayanti)/g, 'gandhi jayanti').replace(/thiruvonam/g, 'onam').replace(/\s+/g, ' ').trim();
}
