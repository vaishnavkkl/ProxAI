import type { LedgerItem } from '@/types/ledger';
import type { ParsedItem } from '@/types/llm-output';
import { isInCurrentMonth } from '@/utils/month-finance';

export type BankAccount = {
  id: string;
  brandId: string;
  name: string;
  label: string;
};

export type BankAccountTotal = BankAccount & {
  income: number;
  spend: number;
  count: number;
};

const BANKS: { id: string; name: string; codes: string[]; words: RegExp }[] = [
  { id: 'hdfc', name: 'HDFC Bank', codes: ['hdfcbk', 'hdfcbn', 'hdfcb'], words: /\bhdfc\b|@okhdfc/i },
  { id: 'icici', name: 'ICICI Bank', codes: ['icicib', 'icicibk'], words: /\bicici\b|@okicici/i },
  {
    id: 'sbi',
    name: 'State Bank of India',
    codes: ['sbiinb', 'sbiupi', 'sbipsg', 'sbicrd', 'sbinin', 'sbicbk'],
    words: /\bsbi\b|state bank|@oksbi/i,
  },
  { id: 'axis', name: 'Axis Bank', codes: ['axisbk', 'axisbn', 'utibnk'], words: /\baxis\b|@okaxis/i },
  { id: 'kotak', name: 'Kotak Bank', codes: ['kotakb', 'kotakm'], words: /\bkotak\b|@okkotak/i },
  { id: 'yes', name: 'Yes Bank', codes: ['yesbnk', 'yesbak'], words: /\byes\s*bank\b/i },
  { id: 'idfc', name: 'IDFC First', codes: ['idfcfb', 'idfcbk'], words: /\bidfc\b/i },
  { id: 'canara', name: 'Canara Bank', codes: ['canbnk', 'canara'], words: /\bcanara\b/i },
  { id: 'pnb', name: 'Punjab National Bank', codes: ['pnbsms', 'punjab'], words: /\bpnb\b|punjab national/i },
  { id: 'bob', name: 'Bank of Baroda', codes: ['bobtxn', 'baroda', 'bobbnk'], words: /\bbaroda\b|\bbob\b/i },
  { id: 'union', name: 'Union Bank', codes: ['unionb'], words: /\bunion\s*bank\b/i },
  { id: 'federal', name: 'Federal Bank', codes: ['fedbnk', 'federal'], words: /\bfederal\b/i },
  { id: 'indusind', name: 'IndusInd Bank', codes: ['indbnk', 'indusind'], words: /\bindusind\b/i },
  { id: 'iob', name: 'Indian Overseas Bank', codes: ['iobchn', 'iobbnk'], words: /\biob\b|indian overseas/i },
  { id: 'indian', name: 'Indian Bank', codes: ['indianb'], words: /\bindian\s*bank\b/i },
  { id: 'idbi', name: 'IDBI Bank', codes: ['idbibk', 'idbi'], words: /\bidbi\b/i },
  { id: 'bandhan', name: 'Bandhan Bank', codes: ['bandhn', 'bandhan'], words: /\bbandhan\b/i },
  { id: 'rbl', name: 'RBL Bank', codes: ['rblbnk', 'rbl'], words: /\brbl\s*bank\b|\brbl\b/i },
  { id: 'au', name: 'AU Bank', codes: ['aubank', 'ausfbn'], words: /\bau\s*bank\b|\bau\s*small\b/i },
  { id: 'hsbc', name: 'HSBC', codes: ['hsbcin'], words: /\bhsbc\b/i },
  { id: 'citi', name: 'Citi', codes: ['citibk', 'citibn'], words: /\bciti\b/i },
  { id: 'scb', name: 'Standard Chartered', codes: ['scbank', 'scblin'], words: /\bstandard\s*chartered\b|\bscb\b/i },
  { id: 'dbs', name: 'DBS Bank', codes: ['dbsinb', 'dbsbnk'], words: /\bdbs\b/i },
];

const WALLETS: { id: string; name: string; codes: string[]; words: RegExp }[] = [
  { id: 'paytm', name: 'Paytm', codes: ['paytmb', 'paytm'], words: /\bpaytm\b/i },
  { id: 'phonepe', name: 'PhonePe', codes: ['phonpe', 'phonepe'], words: /\bphonepe\b/i },
  { id: 'gpay', name: 'Google Pay', codes: ['gpay', 'googpl', 'gpayin'], words: /\bgpay\b|google pay/i },
  { id: 'airtel', name: 'Airtel Payments', codes: ['airpmt', 'airtel'], words: /\bairtel\s*payments\b/i },
];

const LAST4 =
  /(?:a\/c|acct|account|\bac\b)\s*(?:no\.?|number)?\s*(?:\*+|x+|xx+|xxxx)?\s*(\d{3,6})/i;
const LAST4_XX = /\b(?:xx+|x{2,}|\*{2,}|ending(?:\s+in)?)\s*(\d{3,4})\b/i;
const FROM_BANK =
  /(?:debited\s+from|credited\s+to|from|in)\s+([A-Za-z][A-Za-z .]{1,24}?)\s+(?:bank|a\/c|acct|xx|\*)/i;

function headerToken(sender: string): string {
  const compact = sender.replace(/[^A-Za-z0-9]/g, '').toLowerCase();
  if (/^[a-z]{2}[a-z0-9]{4,10}$/.test(compact)) {
    return compact.slice(2);
  }
  return compact.slice(0, 12) || 'unknown';
}

function matchListed(
  token: string,
  text: string,
  list: { id: string; name: string; codes: string[]; words: RegExp }[],
) {
  return (
    list.find((bank) => bank.codes.some((code) => token === code || token.startsWith(code))) ??
    list.find((bank) => bank.words.test(text))
  );
}

function last4Of(text: string): string {
  const digits = text.match(LAST4)?.[1] ?? text.match(LAST4_XX)?.[1] ?? '';
  return digits.slice(-4);
}

export function extractBankAccount(sender: string, body: string): BankAccount {
  const text = `${sender} ${body}`;
  const token = headerToken(sender);
  const fromBody = text.match(FROM_BANK)?.[1] ?? '';
  const bank =
    matchListed(headerToken(fromBody), fromBody || text, BANKS) ??
    matchListed(token, text, BANKS) ??
    matchListed(token, text, WALLETS);
  const last4 = last4Of(text);
  const brandId = bank?.id ?? token;
  const name = bank?.name ?? (token.toUpperCase() || 'Unknown bank');
  const id = last4 ? `${brandId}-${last4}` : brandId;
  return {
    id,
    brandId,
    name,
    label: last4 ? `${name} · XX${last4}` : name,
  };
}

export function accountOf(item: ParsedItem | LedgerItem): BankAccount {
  if (item.bankId && item.bankLabel) {
    const last4 = item.bankId.match(/-(\d{3,4})$/)?.[1] ?? '';
    const brandId = item.bankId.replace(/-\d{3,4}$/, '') || item.bankId;
    const name = item.bankLabel.replace(/\s*·\s*XX\d{3,4}$/, '');
    return { id: item.bankId, brandId, name, label: item.bankLabel };
  }
  return extractBankAccount('', [item.merchant, item.review, item.note].filter(Boolean).join(' '));
}

export function withAccount<T extends ParsedItem>(item: T, sender = '', body = ''): T {
  const hint = body || [item.merchant, item.review, item.note].filter(Boolean).join(' ');
  const bank =
    item.bankId && item.bankLabel
      ? accountOf(item)
      : extractBankAccount(sender, hint);
  return { ...item, bankId: bank.id, bankLabel: bank.label };
}

export function listBankAccounts(items: LedgerItem[], now = new Date()): BankAccountTotal[] {
  const buckets = new Map<string, BankAccountTotal>();
  for (const item of items) {
    if (item.type !== 'transaction') {
      continue;
    }
    const account = accountOf(item);
    const current = buckets.get(account.id) ?? {
      id: account.id,
      brandId: account.brandId,
      name: account.name,
      label: account.label,
      income: 0,
      spend: 0,
      count: 0,
    };
    current.count += 1;
    if (item.amount != null && isInCurrentMonth(item.date, now)) {
      if (item.category === 'income') {
        current.income += item.amount;
      } else {
        current.spend += item.amount;
      }
    }
    buckets.set(account.id, current);
  }

  const byBrand = new Map<string, BankAccountTotal[]>();
  for (const account of buckets.values()) {
    const group = byBrand.get(account.brandId) ?? [];
    group.push(account);
    byBrand.set(account.brandId, group);
  }

  const listed: BankAccountTotal[] = [];
  for (const group of byBrand.values()) {
    if (group.length === 1) {
      const one = group[0];
      listed.push({ ...one, id: one.brandId, label: one.name });
    } else {
      listed.push(...group);
    }
  }
  return listed.sort((left, right) => left.label.localeCompare(right.label));
}

export function inBankAccount(item: LedgerItem, bankId: string | null): boolean {
  if (!bankId) {
    return true;
  }
  const account = accountOf(item);
  return account.id === bankId || account.brandId === bankId;
}
