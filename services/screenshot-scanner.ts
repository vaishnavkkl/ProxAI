import { PermissionsAndroid, Platform } from 'react-native';
import { getDb, getScanMeta, persistParsedBatch, setScanMeta } from '@/services/database';
import { readExtraction, writeExtraction } from '@/services/extraction-cache';
import { getFinlifeNative } from '@/services/finlife-native';
import { PARSER_VERSION } from '@/services/parser-revision';
import { useEventStore } from '@/store/event-store';
import { useLifeStore } from '@/store/life-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import { useTransactionStore } from '@/store/transaction-store';
import type { NativeScreenshot } from '@/modules/finlife-native';
import { extractScreenshot } from '@/utils/screenshot-extraction';

export type ScreenshotScan = NativeScreenshot & { hash: string; text: string; itemIds: string[]; parser: string };
export type ScreenshotAccess = 'full' | 'limited' | 'denied' | 'unavailable';
const OCR_VERSION = 'mlkit-latin-16.0.1-4096-v1';
let running = false;

export async function screenshotAccess(request = false): Promise<ScreenshotAccess> {
  if (process.env.EXPO_OS !== 'android' || !getFinlifeNative()?.recognizeScreenshot) return 'unavailable';
  const full = Number(Platform.Version) >= 33 ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;
  const limited = PermissionsAndroid.PERMISSIONS.READ_MEDIA_VISUAL_USER_SELECTED;
  if (request) {
    await PermissionsAndroid.requestMultiple(Number(Platform.Version) >= 34 ? [full, limited] : [full]);
  }
  if (await PermissionsAndroid.check(full)) return 'full';
  if (Number(Platform.Version) >= 34 && await PermissionsAndroid.check(limited)) return 'limited';
  return 'denied';
}

export async function screenshotsEnabled() { return (await getScanMeta('screenshots_enabled')) === '1'; }
export async function setScreenshotsEnabled(enabled: boolean) { await setScanMeta('screenshots_enabled', enabled ? '1' : '0'); }

export async function listScreenshotScans(month: Date): Promise<ScreenshotScan[]> {
  const db = await getDb();
  const start = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime();
  const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM screenshot_scans WHERE captured_at >= ? AND captured_at < ? ORDER BY captured_at DESC', [start, end]);
  return rows.map((row) => JSON.parse(row.payload) as ScreenshotScan);
}

export async function scanScreenshots(month = new Date(), onProgress: (label: string) => void = () => {}) {
  if (running) throw new Error('A screenshot scan is already running.');
  running = true;
  try {
    const access = await screenshotAccess();
    if (access === 'denied') throw new Error('Allow photo access to scan your Screenshots folder.');
    if (access === 'unavailable') throw new Error('Screenshot OCR needs the updated Android development build.');
    const native = getFinlifeNative()!;
    const db = await getDb();
    const since = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
    const until = Math.min(Date.now() + 1, new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime());
    let after = 0, read = 0, cached = 0, added = 0, errors = 0;
    while (true) {
      const assets = await native.getScreenshotPage!(since, until, after);
      if (!assets.length) break;
      for (const asset of assets) {
        after = Number(asset.id);
        read++;
        onProgress(`Checking screenshot ${read}`);
        try {
          const previous = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM screenshot_scans WHERE asset_id = ?', [asset.id]);
          const saved = previous ? JSON.parse(previous.payload) as ScreenshotScan : null;
          if (saved?.revision === asset.revision && saved.parser === PARSER_VERSION) { cached++; continue; }
          const hash = await native.getScreenshotHash!(asset.uri);
          const key = `ocr:${OCR_VERSION}:${hash}`;
          let ocr = await readExtraction<{ text: string; capturedAt: number }>(key);
          if (!ocr) {
            onProgress(`Reading screenshot ${read} on this phone`);
            ocr = { text: await native.recognizeScreenshot!(asset.uri), capturedAt: asset.capturedAt };
            await writeExtraction(key, ocr);
          } else cached++;
          // A copied image keeps its first capture date and source identity.
          const items = extractScreenshot({ ...asset, capturedAt: ocr.capturedAt }, hash, ocr.text);
          const removed = (saved?.itemIds ?? []).filter((id) => !items.some((item) => item.id === id) && !useLifeStore.getState().states[id]);
          // A parser correction replaces only this screenshot's old derived results.
          for (const id of removed) {
            for (const table of ['transactions', 'events', 'subscriptions', 'life_items', 'ledger_details']) {
              await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
            }
          }
          if (removed.length) {
            for (const state of [useTransactionStore.getState(), useEventStore.getState(), useSubscriptionStore.getState()]) state.replaceAll(state.items.filter((item) => !removed.includes(item.id)));
            const life = useLifeStore.getState(); life.replaceAll(life.items.filter((item) => !removed.includes(item.id)), life.states);
          }
          const stores = [useTransactionStore.getState(), useEventStore.getState(), useSubscriptionStore.getState(), useLifeStore.getState()];
          const known = new Set(stores.flatMap((state) => state.items.map((item) => item.id)));
          await persistParsedBatch({ items, processed: [] });
          const corrected = (saved?.itemIds ?? []).filter((id) => !items.some((item) => item.id === id) && useLifeStore.getState().states[id]);
          const record: ScreenshotScan = { ...asset, hash, text: ocr.text, itemIds: [...items.map((item) => item.id), ...corrected], parser: PARSER_VERSION };
          await db.runAsync('INSERT OR REPLACE INTO screenshot_scans (asset_id, captured_at, payload) VALUES (?, ?, ?)', [asset.id, asset.capturedAt, JSON.stringify(record)]);
          for (const state of stores) state.addMany(items);
          added += items.filter((item) => !known.has(item.id)).length;
        } catch {
          // Never cache failure as an empty result: inaccessible/corrupt images retry next scan.
          errors++;
        }
      }
      if (assets.length < 50) break;
    }
    return { read, cached, added, errors, access };
  } finally { running = false; }
}
