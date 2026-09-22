import type { LedgerItem } from '@/types/ledger';
import type { ParsedItem } from '@/types/llm-output';
import { isInCurrentMonth } from '@/utils/month-finance';
import { isCreditCardAccount, isCreditCardAccountText } from '@/utils/card-sms';

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

// Recognized Indian banks, including banks with banking operations in India.
// Names checked against RBI's banks-in-India directory and DFS's banking list:
// https://www.rbi.org.in/commonman/English/scripts/banksinindia.aspx
// https://www.financialservices.gov.in/banking
const BANKS: { id: string; name: string; codes: string[]; words: RegExp }[] = [
  { id: 'hdfc', name: 'HDFC Bank', codes: ['hdfcbk', 'hdfcbn', 'hdfcb'], words: /\bhdfc(?:\s+bank)?\b/i },
  { id: 'icici', name: 'ICICI Bank', codes: ['icicib', 'icicibk'], words: /\bicici(?:\s+bank)?\b/i },
  {
    id: 'sbi',
    name: 'State Bank of India',
    codes: ['sbiinb', 'sbiupi', 'sbipsg', 'sbinin', 'sbicbk'],
    words: /\bstate bank of india\b|\bsbi\b/i,
  },
  { id: 'axis', name: 'Axis Bank', codes: ['axisbk', 'axisbn', 'utibnk'], words: /\baxis\s+bank\b|\baxis(?=\s+(?:a\/c|account|acct))\b/i },
  { id: 'kotak', name: 'Kotak Mahindra Bank', codes: ['kotakb', 'kotakm'], words: /\bkotak(?:\s+mahindra)?(?:\s+bank)?\b/i },
  { id: 'yes', name: 'Yes Bank', codes: ['yesbnk', 'yesbak'], words: /\byes\s*bank\b/i },
  { id: 'idfc', name: 'IDFC FIRST Bank', codes: ['idfcfb', 'idfcbk'], words: /\bidfc(?:\s+first)?(?:\s+bank)?\b/i },
  { id: 'canara', name: 'Canara Bank', codes: ['canbnk', 'canara'], words: /\bcanara\b/i },
  { id: 'pnb', name: 'Punjab National Bank', codes: ['pnbsms', 'punjab'], words: /\bpnb\b|punjab national/i },
  { id: 'bob', name: 'Bank of Baroda', codes: ['bobtxn', 'baroda', 'bobbnk'], words: /\bbank of baroda\b|\bbob(?=\s+(?:bank|a\/c|account|acct))\b/i },
  { id: 'union', name: 'Union Bank of India', codes: ['unionb'], words: /\bunion\s+bank(?:\s+of\s+india)?\b/i },
  { id: 'federal', name: 'Federal Bank', codes: ['fedbnk', 'federal'], words: /\bfederal\s+bank\b|\bfederal(?=\s+(?:a\/c|account|acct))\b/i },
  { id: 'indusind', name: 'IndusInd Bank', codes: ['indbnk', 'indusind'], words: /\bindusind\b/i },
  { id: 'iob', name: 'Indian Overseas Bank', codes: ['iobchn', 'iobbnk'], words: /\biob\b|indian overseas/i },
  { id: 'indian', name: 'Indian Bank', codes: ['indianb'], words: /\bindian\s*bank\b/i },
  { id: 'idbi', name: 'IDBI Bank', codes: ['idbibk', 'idbi'], words: /\bidbi\b/i },
  { id: 'bandhan', name: 'Bandhan Bank', codes: ['bandhn', 'bandhan'], words: /\bbandhan\b/i },
  { id: 'rbl', name: 'RBL Bank', codes: ['rblbnk', 'rbl'], words: /\brbl\s*bank\b|\brbl\b/i },
  { id: 'au', name: 'AU Small Finance Bank', codes: ['aubank', 'ausfbn'], words: /\bau\s+(?:small finance\s+)?bank\b/i },
  { id: 'hsbc', name: 'HSBC Bank', codes: ['hsbcin'], words: /\bhsbc\b/i },
  { id: 'citi', name: 'Citibank', codes: ['citibk', 'citibn'], words: /\bciti(?:bank)?\b/i },
  { id: 'scb', name: 'Standard Chartered', codes: ['scbank', 'scblin'], words: /\bstandard\s*chartered\b|\bscb\b/i },
  { id: 'dbs', name: 'DBS Bank', codes: ['dbsinb', 'dbsbnk'], words: /\bdbs\b/i },
  { id: 'boi', name: 'Bank of India', codes: ['boiind', 'boisms'], words: /\bbank of india\b/i },
  { id: 'bom', name: 'Bank of Maharashtra', codes: ['mahbnk', 'bomsms'], words: /\bbank of maharashtra\b/i },
  { id: 'central', name: 'Central Bank of India', codes: ['centbk', 'cbinbk'], words: /\bcentral bank of india\b/i },
  { id: 'psb', name: 'Punjab & Sind Bank', codes: ['psbank', 'psbsms'], words: /\bpunjab\s*(?:&|and)\s*sind(?:h)?\s+bank\b/i },
  { id: 'uco', name: 'UCO Bank', codes: ['ucobnk', 'ucobank'], words: /\buco\s+bank\b/i },
  { id: 'southindian', name: 'South Indian Bank', codes: ['sibank', 'sibbnk'], words: /\bsouth indian bank\b|\bsib(?=\s+(?:bank|a\/c|account))\b/i },
  { id: 'csb', name: 'CSB Bank', codes: ['csbbnk', 'csbank'], words: /\b(?:csb bank|catholic syrian bank)\b/i },
  { id: 'dhanlaxmi', name: 'Dhanlaxmi Bank', codes: ['dhanbk', 'dhanbn'], words: /\bdhan(?:laxmi|alakshmi)\s+bank\b/i },
  { id: 'cityunion', name: 'City Union Bank', codes: ['cubank', 'cubbnk'], words: /\bcity union bank\b/i },
  { id: 'dcb', name: 'DCB Bank', codes: ['dcbbnk', 'dcbbank'], words: /\bdcb\s+bank\b/i },
  { id: 'jkb', name: 'Jammu & Kashmir Bank', codes: ['jkbank', 'jkbmsg'], words: /\bjammu\s*(?:&|and)\s*kashmir bank\b|\bj\s*&\s*k\s*bank\b/i },
  { id: 'karnataka', name: 'Karnataka Bank', codes: ['ktkbnk', 'kblbnk'], words: /\bkarnataka bank\b/i },
  { id: 'kvb', name: 'Karur Vysya Bank', codes: ['kvbnot', 'kvbank'], words: /\bkarur vysya bank\b|\bkvb\b/i },
  { id: 'nainital', name: 'Nainital Bank', codes: ['ntbank'], words: /\bnainital bank\b/i },
  { id: 'tmb', name: 'Tamilnad Mercantile Bank', codes: ['tmbank', 'tmbltd'], words: /\btamilnad(?:u)? mercantile bank\b|\btmb\b/i },
  { id: 'keralagramin', name: 'Kerala Gramin Bank', codes: ['kgbank', 'kgbbnk'], words: /\bkerala gramin bank\b/i },
];

const LAST4 =
  /\b(?:a\s*\/\s*c|acct?|account)\s*(?:no\.?|number|ending(?:\s+(?:in|with))?)?\s*[:.#-]?\s*[x*]*\s*(\d{3,18})(?!\d)/i;

const UNKNOWN: BankAccount = { id: 'unknown', brandId: 'unknown', name: 'Unidentified bank', label: 'Unidentified bank' };

function headerToken(sender: string): string {
  return sender.trim().replace(/^[a-z]{2}-/i, '').replace(/-[a-z]$/i, '').replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function bankFromBody(body: string) {
  // A payee's UPI handle is not the customer's bank.
  const text = body.replace(/[\w.+-]+@[\w.-]+/g, '');
  const matches = BANKS.flatMap((bank) => {
    const match = bank.words.exec(text);
    return match ? [{ bank, length: match[0].length, index: match.index, end: match.index + match[0].length }] : [];
  });
  // Prefer a bank immediately attached to an account; otherwise use the most
  // specific name (South Indian Bank, not Indian Bank; City Union, not Union).
  matches.sort((a, b) => b.length - a.length);
  const specific = matches.filter((match, index) => !matches.slice(0, index).some((other) =>
    other.index <= match.index && other.end >= match.end));
  return specific.find((match) => /^\s+(?:savings\s+|current\s+)?(?:a\/c|acct?|account)\b/i.test(text.slice(match.end)))?.bank
    ?? (specific.length === 1 ? specific[0].bank : undefined);
}

function bankAccount(bank: typeof BANKS[number], last4 = ''): BankAccount {
  return { id: last4 ? `${bank.id}-${last4}` : bank.id, brandId: bank.id, name: bank.name,
    label: last4 ? `${bank.name} · XX${last4}` : bank.name };
}

export function extractBankAccount(sender: string, body: string): BankAccount {
  if (isCreditCardAccountText(sender, body)) return UNKNOWN;
  const token = headerToken(sender);
  const bank = BANKS.find((entry) => entry.codes.includes(token)) ?? bankFromBody(body);
  return bank ? bankAccount(bank, body.match(LAST4)?.[1]?.slice(-4)) : UNKNOWN;
}

export function accountOf(item: ParsedItem | LedgerItem): BankAccount {
  if (isCreditCardAccount(item)) return UNKNOWN;
  const source = item.sourceBody || [item.merchant, item.review, item.note].filter(Boolean).join(' ');
  const detected = extractBankAccount(item.sender ?? '', source);
  if (detected.brandId !== 'unknown') return detected;
  // Old rows may lack the original SMS. Accept only known saved IDs and
  // regenerate labels from the registry, never from an arbitrary saved label.
  const saved = item.bankId?.match(/^([a-z]+)(?:-(\d{3,4}))?$/);
  const bank = saved && BANKS.find((entry) => entry.id === saved[1]);
  if (bank) {
    const cardNumber = /\bcard\b/i.test(source);
    return bankAccount(bank, source.match(LAST4)?.[1]?.slice(-4) ?? (cardNumber ? '' : saved[2]));
  }
  return UNKNOWN;
}

export function withAccount<T extends ParsedItem>(item: T, sender = '', body = ''): T {
  const bank = accountOf({ ...item, sender: sender || item.sender, sourceBody: body || item.sourceBody });
  return { ...item, bankId: bank.id, bankLabel: bank.label };
}

export function listBankAccounts(items: LedgerItem[], now = new Date()): BankAccountTotal[] {
  const buckets = new Map<string, BankAccountTotal>();
  for (const item of items) {
    if (item.type !== 'transaction') {
      continue;
    }
    const account = accountOf(item);
    if (account.brandId === 'unknown') continue;
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
    // Some alerts identify the bank but omit the account number. They do not
    // establish another account alongside the bank's one known account.
    if (group.filter((account) => account.id !== account.brandId).length <= 1) {
      const one = group[0];
      listed.push({ ...one, id: one.brandId, label: one.name,
        income: group.reduce((total, account) => total + account.income, 0),
        spend: group.reduce((total, account) => total + account.spend, 0),
        count: group.reduce((total, account) => total + account.count, 0),
      });
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
  return account.brandId !== 'unknown' && (account.id === bankId || account.brandId === bankId);
}
