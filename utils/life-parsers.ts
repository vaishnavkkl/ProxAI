import type { ParsedItem } from '@/types/llm-output';
import type { IncomingMessage } from '@/utils/bank-parsers';
import { spendAmount } from '@/utils/money-amount';

const STRONG_EVENT =
  /\b(exam|hall ticket|admit card|pnr|boarding pass|irctc|interview|appointment|concert|booking confirmed|ticket booked|e-ticket|flight|train pnr|bus ticket|class test|mid[- ]?sem|end[- ]?sem|viva|internal assessment|reporting (?:time|at)|google meet|zoom meeting|teams meeting|webinar|orientation|timetable|university exam|semester exam|exam city|bookmyshow|redbus|makemytrip|goibibo|indigo|air india|seat allotment|counselling|movie ticket|showtime)\b/i;

const SOFT_EVENT =
  /\b(reminder|scheduled on|meeting on|paper on|assessment on|seat no|platform no|depart(?:s|ure)|arrives? at|reporting date|exam on|test on)\b/i;

const STRONG_SUB =
  /\b(will renew|renews? on|renewal on|membership|subscription|auto[- ]?debit|auto[- ]?pay|will be charged|next billing|recurring (?:charge|payment)|standing instruction|nach mandate|si(?:\s|-)mandate|netflix|amazon prime|prime membership|prime video|hotstar|disney\+|spotify|youtube premium|apple music|icloud|google one|zee5|sonyliv|jiocinema|jiosaavn|swiggy one|zomato gold|canva|adobe|linkedin premium|emi due)\b/i;

const MONTHS: Record<string, number> = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  sept: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function receivedIso(message: IncomingMessage): string {
  if (message.receivedAt && Number.isFinite(message.receivedAt)) {
    return new Date(message.receivedAt).toISOString();
  }
  return message.date;
}

function extractEventDate(body: string, fallback: string): string {
  const match = body.match(
    /\b(\d{1,2})[-/ ](jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|\d{1,2})[-/ ]?(\d{2,4})?\b/i,
  );
  if (!match) {
    return fallback;
  }

  const day = Number(match[1]);
  const now = new Date();
  let month = MONTHS[match[2].toLowerCase()];
  if (month == null) {
    month = Number(match[2]) - 1;
  }
  if (!Number.isFinite(month) || month < 0 || month > 11 || day < 1 || day > 31) {
    return fallback;
  }

  let year = match[3] ? Number(match[3]) : now.getFullYear();
  if (year < 100) {
    year += 2000;
  }

  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }
  return date.toISOString().slice(0, 10);
}

function eventTitle(body: string, sender: string): string {
  const exam = body.match(/([A-Za-z][A-Za-z0-9 .]{1,40}?)\s+(exam|paper|test|viva|assessment)/i);
  if (exam) {
    return `${exam[1].trim()} ${exam[2].toLowerCase()}`;
  }
  const ticket = body.match(
    /\b(pnr|flight|train|bus|concert|interview|appointment|meeting|webinar|movie|showtime)\b[^.!]{0,40}/i,
  );
  if (ticket) {
    return ticket[0].replace(/\s+/g, ' ').trim().slice(0, 48);
  }
  return sender.replace(/[^A-Za-z0-9]/g, '').slice(0, 24) || 'Reminder';
}

function subTitle(body: string, sender: string): string {
  const named = body.match(
    /\b(netflix|amazon prime|prime video|prime|hotstar|disney\+|spotify|youtube premium|apple music|icloud|google one|zee5|sonyliv|jiocinema|jiosaavn|swiggy one|zomato gold|canva|adobe|linkedin premium)\b/i,
  );
  if (named) {
    return named[1];
  }
  return sender.replace(/[^A-Za-z0-9]/g, '').slice(0, 24) || 'Subscription';
}

function isBankMove(body: string): boolean {
  return /\b(debited|credited|upi[- /]?(?:dr|cr)|paid to|withdrawn)\b/i.test(body);
}

export function parseLifeMessage(message: IncomingMessage): ParsedItem | null {
  const body = message.body;
  const amount = spendAmount(body);
  const when = receivedIso(message);

  if (STRONG_EVENT.test(body) || (SOFT_EVENT.test(body) && !isBankMove(body))) {
    return {
      type: 'event',
      amount,
      merchant: eventTitle(body, message.sender),
      date: extractEventDate(body, message.date),
      category: 'other',
      note: 'regex',
      valid: true,
      important: 'high',
      review: `From ${message.sender} · ${when.slice(0, 16).replace('T', ' ')}`,
    };
  }

  if (STRONG_SUB.test(body)) {
    return {
      type: 'subscription',
      amount,
      merchant: subTitle(body, message.sender),
      date: extractEventDate(body, message.date),
      category: 'bills',
      note: 'regex',
      valid: true,
      important: 'normal',
      review: `Renewal or membership from ${message.sender}`,
    };
  }

  return null;
}
