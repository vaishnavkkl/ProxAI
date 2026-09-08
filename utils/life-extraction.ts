import type { ParsedItem } from '@/types/llm-output';
import type { IncomingMessage } from '@/utils/bank-parsers';
import { extractMessageDate } from '@/utils/message-date';
import { firstAmount } from '@/utils/money-amount';

export function securityReasons(body: string): string[] {
  const reasons: string[] = [];
  const link = /https?:\/\/|www\.|\b(?:bit\.ly|tinyurl\.com|t\.co)\//i.test(body);
  const threat = /\b(blocked|suspended|deactivated|disconnected|arrest|legal action|urgent|immediately)\b/i.test(body);
  const sensitive = /\b(kyc|bank|account|pan|payment|electricity|verify|update)\b/i.test(body);
  if (threat && sensitive && (link || /\b(call|contact|pay|update|verify)\b|\bwill (?:be |get )?(?:blocked|suspended|deactivated|disconnected)\b/i.test(body))) reasons.push('Pressure to act on an account or payment threat');
  if (/\b(?:share|send|tell|provide)\b.{0,25}\b(?:otp|pin|password|cvv)\b/i.test(body) && !/\b(?:never|not|don.t)\s+(?:ever\s+)?(?:share|send|tell|provide)\b/i.test(body)) reasons.push('Request to disclose a secret code or password');
  if (link && /\b(won|winner|lottery|prize)\b/i.test(body) && /\b(pay|fee|claim|deposit)\b/i.test(body)) reasons.push('Prize claim with a link or payment request');
  if (/\b(install|download)\b.{0,70}\b(apk|anydesk|teamviewer)\b/i.test(body)) reasons.push('Request to install an app or remote access tool');
  return reasons;
}

export function parseExtendedLifeMessage(message: IncomingMessage): ParsedItem | null {
  const body = message.body;
  const reasons = securityReasons(body);
  let type: ParsedItem['type'] | null = reasons.length ? 'security' : null;
  const move = /\b(debited|credited|paid to|withdrawn|upi[- /](?:dr|cr))\b/i.test(body);
  if (!type && /\b(return (?:window|available|eligible|by|until)|warranty (?:expires|valid|until))\b/i.test(body)) type = 'purchase';
  if (!type && /\b(insurance|policy|passport|licen[cs]e|fastag|recharge)\b/i.test(body) && /\b(expir(?:y|es|ing)|valid (?:till|until)|renew (?:by|before))\b/i.test(body)) type = 'document';
  if (!type && /\b(package|parcel|shipment|delivery|order)\b/i.test(body) && /\b(arriving|arrives?|delivered|out for delivery|shipped|dispatched|expected|placed|confirmed|delayed|cancelled)\b/i.test(body)) type = 'delivery';
  if (!type && !move && /\b(flight|train|bus|pnr|boarding pass|hotel|check[- ]in|irctc|redbus)\b/i.test(body) && /\b(booked|booking|confirmed|pnr|departs?|departure|ticket|check[- ]in|reservation|delayed|cancelled)\b/i.test(body)) type = 'travel';
  if (!type && !move && /\b(bill|credit card|electricity|water|broadband|emi)\b/i.test(body) && /\b(due|payable|pay by)\b/i.test(body) && !/\b(payment\b.{0,50}\b(?:received|successful|credited|posted)|received (?:your )?payment)\b/i.test(body)) type = 'bill';
  if (!type && !move && /\b(submit|send|complete|finish|upload|collect|remember to|don.t forget|i will|i.ll|please bring|deadline)\b/i.test(body) && !/\b(otp|verification code|offer|apply now)\b/i.test(body)) type = 'action';
  if (!type) return null;
  const candidate = body.match(/\b(?:pnr|order(?:\s+id)?|tracking(?:\s+id)?|booking(?:\s+id)?)\s*[:#-]?\s*([A-Z0-9][A-Z0-9-]{4,})\b/i)?.[1] ?? '';
  const reference = /\d|^[A-Z]{5,}$/.test(candidate) && !/^(confirmed|delivered|arriving|shipped|cancelled|placed)$/i.test(candidate) ? candidate : null;
  const location = body.match(/\b(?:from\s+([A-Za-z ]{2,30}?)\s+to\s+([A-Za-z ]{2,30}?))(?=\s+(?:on|at|by)\b|[.,;]|$)/i);
  return {
    type, amount: type === 'security' ? null : firstAmount(body),
    merchant: type === 'security' ? 'Possible suspicious message' : body.replace(/https?:\/\/\S+/gi, '').replace(/\s+/g, ' ').trim().slice(0, 96),
    date: type === 'security' ? null : extractMessageDate(body, message.receivedAt ?? message.date),
    category: type === 'bill' ? 'bills' : type,
    note: body, review: reasons.length ? reasons.join('. ') : `From ${message.sender}`,
    valid: true, important: type === 'security' || type === 'action' || type === 'bill' ? 'high' : 'normal',
    reference, location: location ? `${location[1].trim()} → ${location[2].trim()}` : null,
    sourceId: message.id, sourceBody: body, sender: message.sender, receivedAt: message.receivedAt,
    trackingStatus: type === 'delivery' || type === 'travel'
      ? /\b(?:cancelled|canceled)\b/i.test(body) ? 'cancelled'
        : type === 'delivery' && /\bdelivered\b/i.test(body) && !/\b(?:be|not|wasn.t|isn.t)\s+delivered\b/i.test(body) ? 'delivered'
          : /\b(shipped|dispatched|out for delivery)\b/i.test(body) ? 'in_transit' : 'scheduled'
      : undefined,
  };
}
