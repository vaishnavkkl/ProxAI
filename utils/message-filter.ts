import type { IncomingMessage } from '@/utils/bank-parsers';
import { isCardMirrorMessage } from '@/utils/card-sms';
import { securityReasons } from '@/utils/life-extraction';

const SPAM =
  /\b(pre[- ]?approved|instant cash|personal loan|loan offer|get a loan|apply now|limited offer|unsubscribe|otp|one[- ]time password|verification code|kyc update|recharge offer|win a|congratulations you|click here|bit\.ly|lst bid)\b/i;

const MONEY =
  /\b(rs\.?|inr|₹|usd|\$|debited|credited|spent|paid|sent|upi|txn|transaction|withdrawn|transfer|vpa|@ybl|@okaxis|@apl|phonepe|gpay|google pay|paytm|neft|imps|refund|salary|emi|invoice|a\/c|acct|dr\b|cr\b|amt)\b/i;

const DATE_OR_DUE =
  /\b(due|valid till|by \d{1,2}|on \d{1,2}|expir(?:y|es)|deadline)\b|\b\d{1,2}[-/ ](?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2})[-/ ]?\d{0,4}\b|\b\d{4}-\d{2}-\d{2}\b/i;

const TICKET_OR_EVENT =
  /\b(ticket|pnr|boarding|exam|admit card|hall ticket|booking|concert|hall|reminder|interview|appointment|train|flight|bus|irctc|webinar|viva|assessment|google meet|zoom|timetable|bookmyshow|redbus|showtime|counselling)\b/i;

const SUBSCRIPTION =
  /\b(renew|renewal|membership|subscription|auto[- ]?debit|auto[- ]?pay|will be charged|next billing|standing instruction|netflix|prime|hotstar|spotify|youtube premium|disney\+|zee5|sonyliv|icloud|google one)\b/i;

const DATA_USAGE =
  /\b(data usage|data pack|daily data|high[- ]speed data|sim data|prepaid data|fup|data exhausted|data limit|data balance|data validity|remaining data|internet pack|internet speed|reduced speed|2g speed|talktime|volte|gb left|mb left|of your \d+(\.\d+)?\s?(gb|mb)|consumed\s+\d|used\s+\d+(\.\d+)?\s?(gb|mb)|you have used \d|pack expiring|validity of (your )?(data|pack))\b/i;

const REAL_MONEY = /\b(debited|credited|spent|paid to|upi\/|neft|imps)\b/i;

export function hasRealMoneyMove(text: string): boolean {
  return REAL_MONEY.test(text);
}

export function isUsageNoiseText(text: string): boolean {
  if (!DATA_USAGE.test(text)) {
    return false;
  }
  return !hasRealMoneyMove(text);
}

export function isUsageAlert(message: IncomingMessage): boolean {
  return isUsageNoiseText(message.body);
}

export function isLikelySpam(message: IncomingMessage): boolean {
  const body = message.body;
  if (isUsageNoiseText(body)) {
    return true;
  }
  if (!SPAM.test(body)) {
    return false;
  }
  return !hasRealMoneyMove(body);
}

export function isWorthLlm(message: IncomingMessage): boolean {
  if (securityReasons(message.body).length > 0) return true;
  if (isLikelySpam(message) || isCardMirrorMessage(message.body)) {
    return false;
  }
  return (
    // Latin keyword rules cannot classify Malayalam notices; let the selected LLM decide.
    /[\u0D00-\u0D7F]/.test(message.body) ||
    MONEY.test(message.body) ||
    DATE_OR_DUE.test(message.body) ||
    TICKET_OR_EVENT.test(message.body) ||
    SUBSCRIPTION.test(message.body)
    || /\b(task|promise|submit|deadline|delivery|parcel|shipment|warranty|return window|insurance|passport|invoice|receipt)\b/i.test(message.body)
  );
}

export function splitForLlm(messages: IncomingMessage[]) {
  const keep: IncomingMessage[] = [];
  const drop: IncomingMessage[] = [];
  for (const message of messages) {
    if (isWorthLlm(message)) {
      keep.push(message);
    } else {
      drop.push(message);
    }
  }
  return { keep, drop };
}
