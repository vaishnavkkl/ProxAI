import type { LedgerItem } from '@/types/ledger';
import type { ParsedItem } from '@/types/llm-output';
import type { IncomingMessage } from '@/utils/bank-parsers';
import type { ItemState } from '@/services/database';
import { effectiveItem } from '@/utils/life-agenda';
import { extractMessageDate } from '@/utils/message-date';
import { firstAmount } from '@/utils/money-amount';

const SERVICES: [RegExp, string][] = [
  [/netflix/i, 'Netflix'], [/amazon\s*prime|prime\s*(?:video|membership)/i, 'Amazon Prime'],
  [/jio\s*hotstar|hotstar|disney\s*\+/i, 'JioHotstar'], [/sony\s*liv/i, 'SonyLIV'], [/zee\s*5/i, 'ZEE5'],
  [/sun\s*nxt/i, 'Sun NXT'], [/manorama\s*max/i, 'ManoramaMAX'], [/saina\s*play/i, 'Saina Play'],
  [/jio\s*cinema/i, 'JioCinema'], [/aha\b/i, 'aha'], [/hoichoi/i, 'Hoichoi'], [/lionsgate/i, 'Lionsgate Play'],
  [/youtube\s*premium/i, 'YouTube Premium'], [/spotify/i, 'Spotify'], [/apple\s*tv/i, 'Apple TV+'],
  [/apple\s*music/i, 'Apple Music'], [/google\s*one/i, 'Google One'], [/icloud/i, 'iCloud'],
];
const EVIDENCE = /\b(renew(?:s|al|ing)?|expir(?:e|es|ing|y)|valid (?:until|till|through)|next (?:billing|payment)|will be (?:charged|debited)|auto[- ]?(?:pay|debit)|subscription (?:is |has been )?(?:active|activated|confirmed)|membership (?:is |has been )?(?:active|activated|confirmed))\b/i;
const PROMO = /\b(subscribe now|join now|offer|discount|sale|win|watch now|starts? at|starting (?:at|from))\b/i;
const PERSONAL = /\b(your|next billing|will be (?:charged|debited)|renews? on|renewal (?:on|date)|expires? on|valid (?:until|till))\b/i;

export function renewalService(text: string): string | null {
  return SERVICES.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

export function parseRenewal(message: IncomingMessage): ParsedItem | null {
  const body = message.body;
  const service = renewalService(`${message.sender} ${body}`);
  if (service && /\b(subscription|membership|plan)\b/i.test(body) && /\b(cancelled|canceled|terminated|revoked)\b/i.test(body)) {
    return { type: 'subscription', merchant: service, amount: null, date: null, category: 'bills', note: 'renewal', review: 'Subscription cancelled', trackingStatus: 'cancelled', valid: true };
  }
  if (!EVIDENCE.test(body) || (PROMO.test(body) && !PERSONAL.test(body))) return null;
  if (!service && !/\b(subscription|membership|recurring|mandate)\b/i.test(body)) return null;
  if (/\b(cancelled|canceled|terminated|revoked)\b/i.test(body)) return null;
  // A payment receipt date is not a future renewal date.
  const dueText = body.match(/\b(?:renews?(?:\s+on)?|renewal (?:date|on|due)|next (?:billing|payment)(?: date)?|expires?(?:\s+on)?|valid (?:until|till|through)|will be (?:charged|debited))\b[\s\S]*/i)?.[0];
  return {
    type: 'subscription', merchant: service ?? 'Subscription', amount: firstAmount(body),
    date: dueText ? extractMessageDate(dueText, message.receivedAt ?? message.date) : null,
    category: 'bills', note: 'renewal', review: dueText ? 'Renewal notice' : 'Subscription detected · renewal date needed',
    valid: true, important: 'normal',
  };
}

export function confirmedRenewals(items: LedgerItem[], states: Record<string, ItemState>): LedgerItem[] {
  const latest = new Map<string, LedgerItem>();
  const seen = new Set<string>();
  for (const stored of [...items].sort((a, b) => (b.receivedAt ?? 0) - (a.receivedAt ?? 0))) {
    if (stored.id.startsWith('app-') || stored.note === 'app') continue;
    const parsed = stored.sourceBody ? parseRenewal({ id: stored.id, sender: stored.sender ?? '', body: stored.sourceBody, date: stored.date ?? '', receivedAt: stored.receivedAt }) : null;
    if (!parsed && stored.note !== 'Added by you' && !states[stored.id]?.title && !states[stored.id]?.date) continue;
    const item = effectiveItem(parsed ? { ...stored, ...parsed } : stored, states);
    const key = (renewalService(item.merchant ?? '') ?? item.merchant ?? item.id).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if ((states[stored.id]?.status && states[stored.id].status !== 'open') || item.trackingStatus === 'cancelled') continue;
    latest.set(key, item);
  }
  return [...latest.values()].sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
}
