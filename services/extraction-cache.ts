import { getDb } from '@/services/database';

// Payloads are local only and deleted by Clear database along with the ledger.
export async function readExtraction<T>(key: string): Promise<T | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM extraction_cache WHERE cache_key = ?', [key]);
  return row ? JSON.parse(row.payload) as T : null;
}

export async function writeExtraction<T>(key: string, payload: T): Promise<void> {
  const db = await getDb();
  await db.runAsync('INSERT OR REPLACE INTO extraction_cache (cache_key, payload) VALUES (?, ?)', [key, JSON.stringify(payload)]);
}
