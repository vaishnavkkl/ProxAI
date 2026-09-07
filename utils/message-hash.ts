import * as Crypto from 'expo-crypto';

import type { IncomingMessage } from '@/utils/bank-parsers';

async function digest(material: string) {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, material);
}

export async function hashMessage(message: IncomingMessage): Promise<string> {
  return digest(`${message.id}|${message.sender}|${message.date}|${message.receivedAt ?? ''}|${message.body}`);
}

export async function hashMessageContent(message: IncomingMessage): Promise<string> {
  return digest(`${message.sender.trim().toLowerCase()}|${message.body.trim()}`);
}
