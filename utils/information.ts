import type { LedgerItem } from '@/types/ledger';
import type { ItemState } from '@/services/database';

function normalized(value = '') { return value.toLowerCase().replace(/\s+/g, ' ').trim(); }
export function transactionReference(item: LedgerItem): string | null {
  if (item.reference) return item.reference;
  const value = item.sourceBody?.match(/\b(?:utr|rrn|txn(?:\s*id)?|transaction\s*id|ref(?:erence)?(?:\s*(?:no\.?|number|id))?)\s*[:.#-]?\s*([A-Z0-9-]{6,})\b/i)?.[1];
  return value && /\d/.test(value) ? value : null;
}
function provider(item: LedgerItem) {
  const text = [item.merchant, item.sender, item.sourceBody].join(' ');
  const known = text.match(/\b(KSEB|BSNL|Airtel|Jio|Vi|Netflix|Amazon|Flipkart|Myntra|Meesho|IRCTC|RedBus|IndiGo|Air India|LIC|HDFC|ICICI|SBI|Federal Bank|Canara|Axis)\b/i)?.[1];
  return known ?? (item.sender && !/screenshot|pasted|manual/i.test(item.sender) ? item.sender.replace(/^[A-Z]{2}-/i, '').replace(/-[SPGT]$/i, '') : '');
}

// Older records also get readable titles without requiring a destructive rescan.
export function informationTitle(item: LedgerItem): string {
  const title = item.merchant?.trim() ?? '';
  if (item.note === 'Added by you' || item.sourceId?.startsWith('manual-')) return title || 'Your reminder';
  if (item.type === 'transaction') {
    const senderTitle = normalized(title).replace(/[^a-z0-9]/g, '') === normalized(item.sender).replace(/[^a-z0-9]/g, '');
    return !title || senderTitle ? item.category === 'income' ? 'Money received' : 'Payment made' : title;
  }
  if (item.type === 'event' || item.type === 'subscription') return title || 'Your plan';
  if (item.type === 'security') return 'Possible scam to review';
  if (title && title.length < 65 && normalized(title) !== normalized(item.sourceBody)) return title;
  const body = item.sourceBody || title;
  const name = provider(item);
  if (item.type === 'bill') {
    const kind = /electricity|kseb/i.test(body) ? 'Electricity bill' : /credit card/i.test(body) ? 'Credit card bill' : /broadband|internet/i.test(body) ? 'Broadband bill' : /water/i.test(body) ? 'Water bill' : /\bemi\b/i.test(body) ? 'EMI payment' : 'Bill payment';
    return name && !/kseb/i.test(name) ? `${name} · ${kind}` : kind;
  }
  if (item.type === 'delivery') return `${name ? `${name} ` : ''}${item.trackingStatus === 'delivered' ? 'delivery completed' : item.trackingStatus === 'cancelled' ? 'order cancelled' : 'delivery'}`;
  if (item.type === 'travel') return `${/flight|boarding/i.test(body) ? 'Flight' : /train|irctc/i.test(body) ? 'Train journey' : /bus|redbus/i.test(body) ? 'Bus journey' : /hotel|check.in/i.test(body) ? 'Hotel booking' : 'Journey'}${item.location ? ` · ${item.location}` : name ? ` · ${name}` : ''}`;
  if (item.type === 'document') return `${/passport/i.test(body) ? 'Passport' : /licen[cs]e/i.test(body) ? 'Licence' : /fastag/i.test(body) ? 'FASTag' : /recharge/i.test(body) ? 'Recharge' : 'Insurance'} expiry${name ? ` · ${name}` : ''}`;
  if (item.type === 'purchase') return `${/warranty/i.test(body) ? 'Warranty expiry' : 'Return deadline'}${name ? ` · ${name}` : ''}`;
  const action = body.match(/\b(submit|send|complete|finish|upload|collect|bring)\b\s+(.+?)(?=\s+(?:by|before|on|at)\b|[.!?\n]|$)/i);
  if (action) return `${action[1][0].toUpperCase()}${action[1].slice(1).toLowerCase()} ${action[2]}`.slice(0, 80);
  return title.replace(/https?:\/\/\S+/gi, '').slice(0, 72) || 'Task to review';
}

export function isUsefulInformation(item: LedgerItem): boolean {
  if (item.valid === false || item.note === 'app' || item.id.startsWith('app-')) return false;
  if (item.type === 'transaction') return item.amount != null && item.amount > 0;
  const text = item.sourceBody ?? '';
  if (/your day at a glance/i.test(text) && /highlights|needs attention/i.test(text)) return false;
  if (/quick access/i.test(text) && /dashboard|preferences|performance/i.test(text)) return false;
  if (/\b(offer|sale|discount|apply now|limited period)\b/i.test(text) && !/\b(your (?:order|booking|appointment|bill|subscription)|confirmed|debited|credited)\b/i.test(text) && item.type !== 'security') return false;
  return true;
}

function identity(item: LedgerItem): string {
  const day = item.date?.slice(0, 10) ?? '';
  const body = normalized(item.sourceBody);
  const ref = transactionReference(item);
  const account = item.sourceBody?.match(/\b(?:a\/c|acct?|account|consumer|customer|policy|card(?:\s+ending)?)\s*(?:no\.?|number|id|in)?\s*[:.#-]?\s*([Xx*\d-]*\d{3,})\b/i)?.[1] ?? '';
  if (item.type === 'transaction') {
    const direction = item.category === 'income' ? 'credit' : 'debit';
    // Different transfers with the same amount must survive. A shared bank reference is strong evidence.
    if (ref) return `tx|${day}|${direction}|${item.amount}|${normalized(item.bankId)}|${normalized(account)}|${normalized(ref)}`;
    if (body && item.receivedAt) return `tx-body|${direction}|${item.receivedAt}|${body}`;
    return `tx-source|${item.sourceId || item.id}|${direction}|${item.amount}`;
  }
  if ((item.type === 'delivery' || item.type === 'travel') && ref) return `${item.type}|${normalized(provider(item))}|${normalized(ref)}${item.type === 'travel' ? `|${day}` : ''}`;
  // Bill reminders for one account and due date are a single payable, even if the wording changes.
  if (item.type === 'bill' && day && item.amount != null && provider(item)) return `bill|${normalized(provider(item))}|${normalized(account)}|${normalized(ref ?? '')}|${day}|${item.amount}`;
  if (body) return `${item.type}|${day}|${normalized(provider(item))}|${body}`;
  return `id|${item.id}`;
}

export function deduplicateInformation(items: LedgerItem[], states: Record<string, ItemState> = {}): LedgerItem[] {
  const grouped = new Map<string, LedgerItem>();
  for (const item of items) {
    const key = identity(item);
    const previous = grouped.get(key);
    // Preserve a user's completion/correction when a duplicate notification arrives.
    const state = states[item.id]; const oldState = previous && states[previous.id];
    if (!previous || (state && !oldState) || (!!state === !!oldState && (item.receivedAt ?? 0) > (previous.receivedAt ?? 0))) grouped.set(key, item);
  }
  return [...grouped.values()];
}
