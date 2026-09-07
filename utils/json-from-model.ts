import { parsedBatchSchema, parsedItemSchema, type ParsedBatch, type ParsedItem } from '@/types/llm-output';

function parseObject(raw: string): unknown | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return null;
  }
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

function recoverItems(raw: string): ParsedItem[] {
  const items: ParsedItem[] = [];
  const matches = raw.matchAll(/\{[^{}]+\}/g);
  for (const match of matches) {
    try {
      const parsed = parsedItemSchema.safeParse(JSON.parse(match[0]));
      if (parsed.success) {
        items.push(parsed.data);
      }
    } catch {
      // Skip a broken object from a truncated model reply.
    }
  }
  return items;
}

export function parseModelJson(raw: string): ParsedBatch {
  const json = parseObject(raw);
  const parsed = parsedBatchSchema.safeParse(json);
  if (parsed.success) {
    return parsed.data;
  }

  const items = recoverItems(raw);
  if (items.length > 0) {
    return { items };
  }

  throw new Error('empty');
}
