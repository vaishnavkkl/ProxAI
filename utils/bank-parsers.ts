import type { ParsedItem } from '@/types/llm-output';
import { classifyCardSms } from '@/utils/card-sms';
import { spendAmount } from '@/utils/money-amount';

export type IncomingMessage = {
  id: string;
  sender: string;
  body: string;
  date: string;
  receivedAt?: number;
};

const CREDIT_VERB =
  /\b(credited|cr(?:edited)?\s+to|refund(?:ed)?|salary|neft\s+cr|upi[- /]?cr|has been credited|\bcr\b)\b/i;

const DEBIT_VERB =
  /\b(debited|has been debited|spent|paid to|paid rs|paid inr|paid|sent to|withdrawn|purchase|transferred|upi[- /]?dr|amt sent|amount sent|money sent|debit(?:ed)? (?:of|for|by)|\bdr\b)\b/i;

const MERCHANT =
  /(?:\b(?:at|to|info[:\s]+|vpa[:\s]*|towards|for)\s+|upi[\/\-])([A-Z0-9][A-Z0-9 .@&_-]{1,39})/i;

const DINING = /\b(swiggy|zomato|eatsure|dominos|mcdonald|kfc|cafe|restaurant|starbucks)\b/i;
const GROCERY = /\b(blinkit|zepto|bigbasket|dmart|jiomart|grocery|more supermarket)\b/i;
const BILLS =
  /\b(electric|electricity|gas|broadband|jio fiber|airtel thanks|water board|credit card|cc bill)\b/i;
const WORK = /\b(salary|stipend|internship|office|client payment)\b/i;

export function messageDateTime(message: IncomingMessage): string {
  if (message.receivedAt && Number.isFinite(message.receivedAt)) {
    return new Date(message.receivedAt).toISOString();
  }
  return message.date;
}

function merchantOf(message: IncomingMessage): string {
  const match = message.body.match(MERCHANT);
  if (!match) {
    return message.sender.replace(/[^A-Za-z0-9]/g, '').slice(0, 24) || 'Bank';
  }
  return match[1]
    .replace(/\s+/g, ' ')
    .replace(/\b(avl|available|on|info|ref no|upi).*$/i, '')
    .trim()
    .slice(0, 40);
}

function categoryOf(body: string, credit: boolean): string {
  if (credit) {
    return 'income';
  }
  if (GROCERY.test(body)) {
    return 'grocery';
  }
  if (DINING.test(body)) {
    return 'dining';
  }
  if (BILLS.test(body)) {
    return 'bills';
  }
  if (WORK.test(body)) {
    return 'work';
  }
  return 'other';
}

function asItem(
  message: IncomingMessage,
  amount: number,
  credit: boolean,
): ParsedItem {
  return {
    type: 'transaction',
    amount,
    merchant: merchantOf(message),
    date: messageDateTime(message),
    review: `${credit ? 'Credit' : 'Debit'} from ${message.sender}`,
    category: categoryOf(message.body, credit),
    note: 'regex',
    valid: true,
    important: 'normal',
  };
}

export function parseBankMessage(message: IncomingMessage): ParsedItem | null {
  const body = message.body;
  if (classifyCardSms(body) === 'drop') {
    return null;
  }
  const amount = spendAmount(body);
  if (amount == null) {
    return null;
  }

  const credit = CREDIT_VERB.test(body);
  const debit = DEBIT_VERB.test(body);
  if (!credit && !debit) {
    return null;
  }

  return asItem(message, amount, credit && !debit);
}

export function parseMany(messages: IncomingMessage[]) {
  const parsed: ParsedItem[] = [];
  const unmatched: IncomingMessage[] = [];

  for (const message of messages) {
    const item = parseBankMessage(message);
    if (item) {
      parsed.push(item);
    } else {
      unmatched.push(message);
    }
  }

  return { parsed, unmatched };
}
