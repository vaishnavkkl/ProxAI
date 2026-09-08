import type { ParsedItem } from '@/types/llm-output';
import type { IncomingMessage } from '@/utils/bank-parsers';
import { extractMessageDate } from '@/utils/message-date';
import { parseRenewal } from '@/utils/renewals';
import { spendAmount } from '@/utils/money-amount';

const STRONG_EVENT =
  /\b(exam|hall ticket|admit card|pnr|boarding pass|irctc|interview|appointment|concert|booking confirmed|ticket booked|e-ticket|flight|train pnr|bus ticket|class test|mid[- ]?sem|end[- ]?sem|viva|internal assessment|reporting (?:time|at)|google meet|zoom meeting|teams meeting|webinar|orientation|timetable|university exam|semester exam|exam city|bookmyshow|redbus|makemytrip|goibibo|indigo|air india|seat allotment|counselling|movie ticket|showtime)\b/i;

const SOFT_EVENT =
  /\b(reminder|scheduled on|meeting on|paper on|assessment on|seat no|platform no|depart(?:s|ure)|arrives? at|reporting date|exam on|test on)\b/i;

function receivedIso(message: IncomingMessage): string {
  if (message.receivedAt && Number.isFinite(message.receivedAt)) {
    return new Date(message.receivedAt).toISOString();
  }
  return message.date;
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

function isBankMove(body: string): boolean {
  return /\b(debited|credited|upi[- /]?(?:dr|cr)|paid to|withdrawn)\b/i.test(body);
}

export function parseLifeMessage(message: IncomingMessage): ParsedItem | null {
  const body = message.body;
  const amount = spendAmount(body);
  const when = receivedIso(message);

  const renewal = parseRenewal(message);
  if (renewal) return renewal;
  const promotional = /\b(book now|register now|offer|discount|sale|early bird|tickets? available)\b/i.test(body);
  if (!promotional && !isBankMove(body) && extractMessageDate(body, message.receivedAt ?? message.date) && (STRONG_EVENT.test(body) || SOFT_EVENT.test(body))) {
    return {
      type: 'event',
      amount,
      merchant: eventTitle(body, message.sender),
      date: extractMessageDate(body, message.receivedAt ?? message.date),
      category: 'other',
      note: 'regex',
      valid: true,
      important: 'high',
      review: `From ${message.sender} · ${when.slice(0, 16).replace('T', ' ')}`,
    };
  }

  return null;
}
