import type { LedgerItem } from '@/types/ledger';
import type { ParsedItem } from '@/types/llm-output';

const CARD =
  /\b(credit\s*card|\bcc\b|card\s*(?:xx|ending|no\.?|number)|infinia|regalia|millennia|rupay\s*cc)\b/i;

const BANK_DEBIT =
  /\b(debited from (?:your )?(?:a\/c|acct|account|sav|savings)|upi[- /]?dr|neft\s+dr|imps\s+dr|paid (?:to|rs|inr)|amt sent|amount sent|withdrawn from)\b/i;

const BANK_CREDIT =
  /\b(credited (?:to|in|with) (?:your )?(?:a\/c|acct|account|sav|savings)|neft\s+cr|upi[- /]?cr|salary credited|has been credited to (?:your )?(?:a\/c|acct))\b/i;

const BILL_NOTICE =
  /\b(bill (?:of|is|has been|generated|ready|dated)|total (?:amt |amount )?due|min(?:imum)? (?:amt |amount )?due|outstanding(?: amt| amount)?|statement (?:generated|is ready|dated)|payment due|amt payable|total due|available credit limit|credit limit|unused limit)\b/i;

const PAYMENT_ACK =
  /\b(payment (?:of|for|received|credited|posted|successful)|received (?:your )?payment|thank you for (?:the |your )?payment|payment has been|credited to your credit card|received on your (?:credit )?card)\b/i;

const CARD_ISSUER = /\b(?:sbicrd|sbicard|hdfccr|icicic|axiscc|kotak\s*c[ac]rd|amex(?:cr)?|onecrd|onecard)\b/i;

export type CardDecision = 'keep' | 'drop' | 'verify';

export function isCardText(text: string): boolean {
  return CARD.test(text);
}

/** A card issuer or masked card number is not evidence of a deposit account. */
export function isCreditCardAccountText(sender: string, text: string): boolean {
  const header = sender.trim().replace(/^[a-z]{2}-/i, '').replace(/-[a-z]$/i, '').toLowerCase();
  if (CARD_ISSUER.test(header) || CARD_ISSUER.test(text)) return true;
  if (/\b(?:credit[\s-]*cards?|cc|sbi\s*card|amex|american express|onecard|infinia|regalia|millennia)\b/i.test(text)) return true;
  // Preserve explicitly identified debit-card spending; never use its card suffix as an account number.
  return !/\bdebit[\s-]*card\b/i.test(text) &&
    /\bcard\s*(?:(?:a\/c|account|ending(?:\s+(?:in|with))?|no\.?|number)\s*)?[:.#-]?\s*(?:[x*]+\s*)?\d{3,16}\b|\bcard\b.*\b(?:credit limit|available limit|minimum due|total due)\b/i.test(text);
}

export function isCreditCardAccount(item: ParsedItem | LedgerItem): boolean {
  const text = [item.merchant, item.bankId, item.bankLabel, item.sourceBody, item.review, item.note].filter(Boolean).join(' ');
  return isCreditCardAccountText(item.sender ?? '', text) ||
    isCreditCardAccountText(item.bankId?.replace(/-\d+$/, '') ?? '', '');
}

export function classifyCardSms(body: string): CardDecision {
  if (BILL_NOTICE.test(body) && !BANK_DEBIT.test(body)) {
    return 'drop';
  }
  if (PAYMENT_ACK.test(body) && !BANK_DEBIT.test(body)) {
    return 'drop';
  }
  if (CARD.test(body) && !BANK_DEBIT.test(body) && !BANK_CREDIT.test(body)) {
    return 'drop';
  }
  if (CARD.test(body) && BANK_CREDIT.test(body) && !BANK_DEBIT.test(body)) {
    return 'drop';
  }
  if (CARD.test(body) && BANK_DEBIT.test(body)) {
    return 'verify';
  }
  return 'keep';
}

export function isCardMirrorMessage(body: string): boolean {
  return classifyCardSms(body) === 'drop';
}

function itemText(item: ParsedItem | LedgerItem): string {
  return [item.merchant, item.review, item.note].filter(Boolean).join(' ');
}

export function isCardMirrorItem(item: ParsedItem | LedgerItem): boolean {
  return isCardMirrorMessage(itemText(item));
}

function amountOf(item: ParsedItem | LedgerItem): number | null {
  return item.amount ?? null;
}

function timeOf(item: ParsedItem | LedgerItem): number {
  const value = Date.parse(item.date ?? '');
  return Number.isFinite(value) ? value : 0;
}

function cardScore(item: ParsedItem | LedgerItem): number {
  const text = itemText(item);
  let score = 0;
  if (CARD.test(text)) {
    score += 2;
  }
  if (BILL_NOTICE.test(text) || PAYMENT_ACK.test(text)) {
    score += 3;
  }
  if (/^credit\b/i.test(item.review ?? '')) {
    score += 2;
  }
  if (/^debit\b/i.test(item.review ?? '')) {
    score -= 2;
  }
  return score;
}

function isTwinSpend(left: ParsedItem | LedgerItem, right: ParsedItem | LedgerItem): boolean {
  if (left.type !== 'transaction' || right.type !== 'transaction') {
    return false;
  }
  if (left.category === 'income' || right.category === 'income') {
    return false;
  }
  const leftAmt = amountOf(left);
  const rightAmt = amountOf(right);
  if (leftAmt == null || rightAmt == null || Math.abs(leftAmt - rightAmt) > 0.009) {
    return false;
  }
  const gap = Math.abs(timeOf(left) - timeOf(right));
  if (gap > 3 * 24 * 60 * 60 * 1000) {
    return false;
  }
  return isCardText(itemText(left)) || isCardText(itemText(right));
}

export function collapseCardTwins<T extends ParsedItem | LedgerItem>(
  incoming: T[],
  existing: LedgerItem[] = [],
): T[] {
  const drop = new Set<T>();
  for (const item of incoming) {
    if (item.type !== 'transaction' || item.category === 'income') {
      continue;
    }
    const rivals = [...incoming, ...existing].filter((other) => other !== item);
    for (const other of rivals) {
      if (!isTwinSpend(item, other)) {
        continue;
      }
      if (cardScore(item) > cardScore(other)) {
        drop.add(item);
      }
    }
  }
  return incoming.filter((item) => !drop.has(item));
}
