import type { LedgerItem } from '@/types/ledger';
import { isCreditCardAccount } from '@/utils/card-sms';

const EXCLUDED_MERCHANT = /swiggy|zomato/i;

// Apply to the finance projection, keeping original records for other modules.
export function isFinanceTransaction(item: LedgerItem): boolean {
  if (item.type !== 'transaction') return false;
  const text = [item.merchant, item.sender, item.bankId, item.bankLabel, item.sourceBody, item.review, item.note]
    .filter(Boolean).join(' ');
  return !EXCLUDED_MERCHANT.test(text) && !isCreditCardAccount(item);
}
