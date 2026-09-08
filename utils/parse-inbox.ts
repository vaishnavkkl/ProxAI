import type { ParsedItem } from '@/types/llm-output';
import { extractBankAccount } from '@/utils/bank-account';
import { parseBankMessage, type IncomingMessage } from '@/utils/bank-parsers';
import { classifyCardSms, isCardMirrorMessage } from '@/utils/card-sms';
import { parseLifeMessage } from '@/utils/life-parsers';
import { parseExtendedLifeMessage } from '@/utils/life-extraction';
import { parseRenewal } from '@/utils/renewals';
import { sanitizeParsedItem } from '@/utils/money-amount';

export function parseInbox(messages: IncomingMessage[]) {
  const parsed: ParsedItem[] = [];
  const unmatched: IncomingMessage[] = [];
  const verify: IncomingMessage[] = [];
  let dropped = 0;

  for (const message of messages) {
    const life = parseExtendedLifeMessage(message);
    const renewal = parseRenewal(message);
    if (!life && !renewal && isCardMirrorMessage(message.body)) {
      dropped += 1;
      continue;
    }
    const bankItem = life?.type === 'security' || life?.type === 'bill' ? null : parseBankMessage(message);
    const rawItems = [life ?? renewal ?? parseLifeMessage(message), bankItem].filter((item): item is ParsedItem => item != null);
    if (!rawItems.length) unmatched.push(message);
    for (const raw of rawItems) {
      const item = sanitizeParsedItem(raw, [message.body]);
      if (!item) continue;
      const bank = extractBankAccount(message.sender, message.body);
      parsed.push({
        ...item,
        sourceId: message.id,
        sourceBody: message.body,
        sender: message.sender,
        receivedAt: message.receivedAt,
        bankId: bank.id,
        bankLabel: bank.label,
      });
      if (item.type === 'transaction' && classifyCardSms(message.body) === 'verify') {
        verify.push(message);
      }
    }
  }

  return { parsed, unmatched, verify, dropped };
}
