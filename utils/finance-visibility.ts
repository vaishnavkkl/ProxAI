import type { LedgerItem } from '@/types/ledger';

const EXCLUDED_MERCHANT = /swiggy|zomato/i;
const CREDIT_CARD = /\b(?:credit[\s-]*cards?|cc|infinia|regalia|millennia)\b/i;
const CARD_SENDER = /(?:sbicrd|hdfccr|icicic|axiscc|kotak c[ac]rd|amex)/i;

// Apply to the finance projection, keeping original records for other modules.
export function isFinanceTransaction(item: LedgerItem): boolean {
  if (item.type !== 'transaction') return false;
  const text = [item.merchant, item.sender, item.bankId, item.bankLabel, item.sourceBody, item.review, item.note]
    .filter(Boolean).join(' ');
  return !EXCLUDED_MERCHANT.test(text) && !CREDIT_CARD.test(text) &&
    !CARD_SENDER.test([item.sender, item.bankId, item.bankLabel].filter(Boolean).join(' '));
}
