import { z } from 'zod';

export const parsedItemSchema = z.object({
  type: z.enum(['transaction', 'event', 'subscription', 'action', 'travel', 'delivery', 'bill', 'security', 'document', 'purchase']),
  amount: z.number().nullable(),
  merchant: z.string().nullable(),
  date: z.string().nullable(),
  category: z.string(),
  note: z.string(),
  valid: z.boolean().optional(),
  important: z.enum(['high', 'normal', 'skip']).optional(),
  review: z.string().optional(),
  sourceId: z.string().optional(),
  reference: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
});

export const parsedBatchSchema = z.object({
  items: z.array(parsedItemSchema),
});

export type ParsedItem = z.infer<typeof parsedItemSchema> & {
  sourceId?: string;
  bankId?: string;
  bankLabel?: string;
  sourceBody?: string;
  sender?: string;
  receivedAt?: number;
  calendarName?: string;
  sourceUri?: string;
  sourceKind?: 'screenshot';
  trackingStatus?: 'scheduled' | 'in_transit' | 'delivered' | 'cancelled';
};
export type ParsedBatch = z.infer<typeof parsedBatchSchema>;

export function isKeepableItem(item: ParsedItem): boolean {
  if (item.valid === false) {
    return false;
  }
  if (item.important === 'skip') {
    return false;
  }
  return true;
}
