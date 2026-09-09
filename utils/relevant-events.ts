import type { LedgerItem } from '@/types/ledger';
import type { ItemState } from '@/services/database';
import { effectiveItem } from '@/utils/life-agenda';
import { isWithinUpcomingWindow } from '@/utils/message-date';
import { holidayIdentity } from '@/utils/regional-holidays';
import { deduplicateInformation } from '@/utils/information';

const KERALA = /kerala|kochi|cochin|ernakulam|thiruvananthapuram|trivandrum|kozhikode|calicut|thrissur|kollam|kottayam|alappuzha|alleppey|palakkad|malappuram|kannur|kasaragod|wayanad|idukki|pathanamthitta|കേരള|കൊച്ചി/i;
const LOCAL_HOLIDAY = /\b(onam|thiruvonam|vishu|kerala piravi|sree narayana|ayyankali|maha?bali|mahanavami|vijayadashami)\b/i;
const NATIONAL = /\b(republic day|independence day|gandhi jayanti|christmas|good friday|easter|eid|id.ul|bakrid|milad|muharram|diwali|deepavali|new year'?s? day)\b/i;
const HOLIDAY = /holiday|observance|festival|jayanti|jayanthi|sankranti|pongal|bihu|baisakhi|ugadi|gudi padwa|chhath|karva chauth|raksha bandhan|holi|navratri|dussehra|durga puja|ganesh chaturthi|thanksgiving|halloween|onam|vishu|christmas|easter|good friday|republic day|independence day|new year|eid|bakrid/i;
const PROMOTION = /\b(book now|register now|offer|discount|sale|win tickets|limited seats|early bird|tickets? (?:on sale|available))\b/i;
const CONFIRMED = /\b(confirmed|appointment|your booking|your tickets?|your exam|your interview|scheduled|meeting|reservation|reporting|admit card|hall ticket)\b/i;

export function isHolidayEvent(item: LedgerItem): boolean {
  return /holiday|observance|festival/i.test(item.calendarName ?? '') ||
    (!CONFIRMED.test([item.merchant, item.sourceBody].join(' ')) && HOLIDAY.test([item.merchant, item.review].join(' ')));
}

export function normalizeEvent(item: LedgerItem): LedgerItem {
  return isHolidayEvent(item) && item.date ? { ...item, date: item.date.slice(0, 10) } : item;
}

export function isRelevantEvent(item: LedgerItem): boolean {
  const text = [item.merchant, item.sourceBody, item.review, item.location].filter(Boolean).join(' ');
  if (item.note === 'Added by you') return true;
  const calendar = item.note === 'calendar' || item.id.startsWith('cal-');
  // Holiday feeds are regional; personal events retain their original location.
  const holiday = isHolidayEvent(item);
  if (holiday) return KERALA.test(item.merchant ?? '') || LOCAL_HOLIDAY.test(item.merchant ?? '') || NATIONAL.test(item.merchant ?? '');
  if (PROMOTION.test(text) && !/\b(?:booking|appointment|reservation|ticket)\s+(?:is\s+)?confirmed\b/i.test(text)) return false;
  if (calendar || CONFIRMED.test(text)) return true;
  return KERALA.test(text) && !!item.date;
}

export function relevantEvents(items: LedgerItem[], states: Record<string, ItemState>, now = new Date()): LedgerItem[] {
  const seen = new Set<string>();
  return deduplicateInformation(items, states).map((item) => effectiveItem(normalizeEvent(item), states))
    .sort((a, b) => Number(!!states[b.id]) - Number(!!states[a.id])).filter((item) => {
    if (!isWithinUpcomingWindow(item.date, now) || !isRelevantEvent(item)) return false;
    const key = `${isHolidayEvent(item) ? holidayIdentity(item.merchant ?? '') : (item.merchant ?? '').trim().toLowerCase()}|${item.date}|${isHolidayEvent(item) ? 'holiday' : item.location ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return !states[item.id]?.status || states[item.id].status === 'open';
  }).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
}
