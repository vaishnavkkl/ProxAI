import type { ParsedItem } from '@/types/llm-output';

const AMOUNT =
  /(?:(?:rs\.?|inr|₹)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:rs\.?|inr))/gi;

const MONEY_FIGURE = String.raw`(?:rs\.?|inr|₹)\s*[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?\s*(?:rs\.?|inr)|[\d,]{2,}(?:\.\d{1,2})?`;

const BALANCE_LABEL = String.raw`(?:(?:a\/c|ac|acct|account)\s+)?(?:avl|avbl|avlbl|available|avail|clr|clear|closing|ledger|current|tot(?:al)?|e-?|unused|combined|outst(?:anding)?)?\.?\s*bal(?:ance)?`;

const BALANCE_CHUNK = new RegExp(
  String.raw`\b${BALANCE_LABEL}\b[:\s=-]*(?:is[:\s]*)?(?:the[:\s]*)?(${MONEY_FIGURE})(?:\s*(?:cr|dr))?`,
  'gi',
);

const AMOUNT_THEN_BAL = new RegExp(
  String.raw`(${MONEY_FIGURE})\s+(?:is\s+)?(?:the\s+)?${BALANCE_LABEL}\b`,
  'gi',
);

const BALANCE_HINT = new RegExp(
  String.raw`\b${BALANCE_LABEL}\b|\b(?:available|avail|avl)\.?\s+bal|\bbal(?:ance)?[:\s=]`,
  'i',
);

const MOVE_VERB =
  /\b(debited|credited|spent|paid|sent|withdrawn|purchase|transferred|refund(?:ed)?|upi[- /]?(?:dr|cr)|amt sent|amount sent|money sent|has been credited|cr(?:edited)?\s+to|\bdr\b|\bcr\b)\b/i;

const MOVE_VERB_STRICT =
  /\b(debited|credited|spent|paid|sent|withdrawn|purchase|transferred|refund(?:ed)?|upi[- /]?(?:dr|cr)|amt sent|amount sent|money sent|has been credited|cr(?:edited)?\s+to)\b/i;

export function stripBalanceFigures(body: string): string {
  return body
    .replace(BALANCE_CHUNK, ' ')
    .replace(AMOUNT_THEN_BAL, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isBalanceOnlyMessage(body: string): boolean {
  if (MOVE_VERB_STRICT.test(body)) {
    return false;
  }
  return BALANCE_HINT.test(body);
}

function parseFigure(raw: string): number | null {
  const amount = Number(raw.replace(/,/g, ''));
  if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
    return null;
  }
  return amount;
}

function readAmount(match: RegExpMatchArray): number | null {
  return parseFigure(match[1] || match[2] || '');
}

function figureFromChunk(chunk: string): number | null {
  AMOUNT.lastIndex = 0;
  const match = AMOUNT.exec(chunk);
  if (match) {
    return readAmount(match);
  }
  const bare = chunk.match(/([\d,]+(?:\.\d{1,2})?)/);
  return bare ? parseFigure(bare[1]) : null;
}

export function firstAmount(text: string): number | null {
  AMOUNT.lastIndex = 0;
  const match = AMOUNT.exec(text);
  return match ? readAmount(match) : null;
}

export function balanceFigures(body: string): number[] {
  const found = new Set<number>();
  for (const pattern of [BALANCE_CHUNK, AMOUNT_THEN_BAL]) {
    pattern.lastIndex = 0;
    let match = pattern.exec(body);
    while (match) {
      const amount = figureFromChunk(match[1] || match[0]);
      if (amount != null) {
        found.add(amount);
      }
      match = pattern.exec(body);
    }
  }
  return [...found];
}

export function spendAmount(body: string): number | null {
  if (isBalanceOnlyMessage(body)) {
    return null;
  }

  const cleaned = stripBalanceFigures(body);
  const verb = cleaned.match(MOVE_VERB);
  if (verb && verb.index != null) {
    const start = Math.max(0, verb.index - 48);
    const around = cleaned.slice(start, verb.index + verb[0].length + 48);
    const near = firstAmount(around);
    if (near != null) {
      return near;
    }
  }

  const leftover = firstAmount(cleaned);
  if (leftover == null) {
    return null;
  }
  if (balanceFigures(body).includes(leftover)) {
    return null;
  }
  return leftover;
}

export function sanitizeParsedItem(item: ParsedItem, bodies: string[]): ParsedItem | null {
  const spends = bodies
    .map((body) => spendAmount(body))
    .filter((amount): amount is number => amount != null);
  const balances = bodies.flatMap((body) => balanceFigures(body));
  const amount = item.amount;
  const amountIsBalance = amount != null && balances.includes(amount) && !spends.includes(amount);

  if (item.type === 'transaction') {
    if (amountIsBalance) {
      if (spends.length === 1) {
        return { ...item, amount: spends[0] };
      }
      return null;
    }
    if (amount == null && spends.length === 1) {
      return { ...item, amount: spends[0] };
    }
    return item;
  }

  if (amountIsBalance) {
    return { ...item, amount: spends[0] ?? null };
  }
  return item;
}
