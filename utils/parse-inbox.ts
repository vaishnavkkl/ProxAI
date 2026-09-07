import type { ParsedItem } from '@/types/llm-output';
import { extractBankAccount } from '@/utils/bank-account';
import { parseBankMessage, type IncomingMessage } from '@/utils/bank-parsers';
import { classifyCardSms, isCardMirrorMessage } from '@/utils/card-sms';
import { parseLifeMessage } from '@/utils/life-parsers';
import { sanitizeParsedItem } from '@/utils/money-amount';

export function parseInbox(messages: IncomingMessage[]) {
  const parsed: ParsedItem[] = [];
  const unmatched: IncomingMessage[] = [];
  const verify: IncomingMessage[] = [];
  let dropped = 0;

  for (const message of messages) {
    if (isCardMirrorMessage(message.body)) {
      dropped += 1;
      continue;
    }
    const raw = parseLifeMessage(message) ?? parseBankMessage(message);
    const item = raw ? sanitizeParsedItem(raw, [message.body]) : null;
    if (item) {
      const bank = extractBankAccount(message.sender, message.body);
      parsed.push({
        ...item,
        sourceId: message.id,
        bankId: bank.id,
        bankLabel: bank.label,
      });
      if (classifyCardSms(message.body) === 'verify') {
        verify.push(message);
      }
    } else {
      unmatched.push(message);
    }
  }

  return { parsed, unmatched, verify, dropped };
}
