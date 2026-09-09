import { PermissionsAndroid, Platform } from 'react-native';
import { getDb, getScanMeta, persistParsedBatch, setScanMeta } from '@/services/database';
import { readExtraction, writeExtraction } from '@/services/extraction-cache';
import { getFinlifeNative } from '@/services/finlife-native';
import { ingestMessagePage } from '@/services/message-ingestion';
import { PARSER_VERSION } from '@/services/parser-revision';
import { resolveModelSources } from '@/services/model-catalog';
import { useEventStore } from '@/store/event-store';
import { useLifeStore } from '@/store/life-store';
import { useSettingsStore } from '@/store/settings-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import { useTransactionStore } from '@/store/transaction-store';
import type { NativeScreenshot } from '@/modules/finlife-native';
import type { LedgerItem } from '@/types/ledger';
import type { IncomingMessage } from '@/utils/bank-parsers';
import type { ParsedItem } from '@/types/llm-output';
import { extractScreenshotResult } from '@/utils/screenshot-extraction';
import { isUpcomingPlan } from '@/utils/information';
import { splitForLlm } from '@/utils/message-filter';
import { ocrVersion, recognizeImageText } from '@/services/screenshot-ocr';

export type ScreenshotScan = NativeScreenshot & { hash: string; text: string; itemIds: string[]; parser: string; ocrVersion?: string };
export type ScreenshotAccess = 'full' | 'limited' | 'denied' | 'unavailable';
type Infer = (messages: IncomingMessage[]) => Promise<ParsedItem[]>;
let running = false;

type ShotWork = {
  asset: NativeScreenshot;
  hash: string;
  text: string;
  regexItems: LedgerItem[];
  message: IncomingMessage;
  saved: ScreenshotScan | null;
  classified: boolean;
};

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

export type ImageFolder = { name: string; count: number };

export async function listImageFolders(): Promise<ImageFolder[]> {
  const native = getFinlifeNative();
  if (!native?.getImageFolders) {
    return [{ name: 'Screenshots', count: 0 }];
  }
  const rows = await native.getImageFolders();
  return rows.map((row) => ({ name: row.name, count: row.count }));
}

export async function getImageScanFolders(): Promise<string[]> {
  const raw = await getScanMeta('image_scan_folders');
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((item) => String(item).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

export async function setImageScanFolders(names: string[]) {
  const cleaned = names.map((name) => name.trim()).filter(Boolean);
  await setScanMeta('image_scan_folders', cleaned.length ? JSON.stringify(cleaned) : '');
}

export async function listScreenshotScans(month: Date): Promise<ScreenshotScan[]> {
  const db = await getDb();
  const start = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime();
  const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM screenshot_scans WHERE captured_at >= ? AND captured_at < ? ORDER BY captured_at DESC', [start, end]);
  return rows.map((row) => JSON.parse(row.payload) as ScreenshotScan);
}

function ledgerBySource(sourceId: string): LedgerItem[] {
  return [useTransactionStore.getState(), useEventStore.getState(), useSubscriptionStore.getState(), useLifeStore.getState()]
    .flatMap((state) => state.items.filter((item) => item.sourceId === sourceId));
}

async function removeDerived(ids: string[]) {
  if (!ids.length) return;
  const db = await getDb();
  for (const id of ids) {
    for (const table of ['transactions', 'events', 'subscriptions', 'life_items', 'ledger_details']) {
      await db.runAsync(`DELETE FROM ${table} WHERE id = ?`, [id]);
    }
  }
  for (const state of [useTransactionStore.getState(), useEventStore.getState(), useSubscriptionStore.getState()]) {
    state.replaceAll(state.items.filter((item) => !ids.includes(item.id)));
  }
  const life = useLifeStore.getState();
  life.replaceAll(life.items.filter((item) => !ids.includes(item.id)), life.states);
}

export async function scanScreenshots(month = new Date(), onProgress: (label: string) => void = () => {}, infer?: Infer) {
  if (running) throw new Error('A screenshot scan is already running.');
  running = true;
  try {
    const access = await screenshotAccess();
    if (access === 'denied') throw new Error('Allow photo access to scan image folders on this phone.');
    if (access === 'unavailable') throw new Error('Image OCR needs the updated Android development build.');
    const native = getFinlifeNative()!;
    const db = await getDb();
    const since = new Date(month.getFullYear(), month.getMonth(), 1).getTime();
    const until = Math.min(Date.now() + 1, new Date(month.getFullYear(), month.getMonth() + 1, 1).getTime());
    const modelKey = JSON.stringify(resolveModelSources(useSettingsStore.getState()));
    const language = useSettingsStore.getState().ocrLanguage;
    const version = ocrVersion(language);
    const folders = await getImageScanFolders();
    let after = 0, read = 0, cached = 0, added = 0, errors = 0, model = 0;
    while (true) {
      const assets = await native.getScreenshotPage!(since, until, after, folders);
      if (!assets.length) break;
      const knownBefore = new Set([useTransactionStore.getState(), useEventStore.getState(), useSubscriptionStore.getState(), useLifeStore.getState()].flatMap((state) => state.items.map((item) => item.id)));
      const page: ShotWork[] = [];
      for (const asset of assets) {
        after = Number(asset.id);
        read++;
        onProgress(`Checking image ${read}`);
        try {
          const previous = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM screenshot_scans WHERE asset_id = ?', [asset.id]);
          const saved = previous ? JSON.parse(previous.payload) as ScreenshotScan : null;
          if (saved?.revision === asset.revision && saved.parser === PARSER_VERSION &&
              (saved.ocrVersion ?? ocrVersion('en')) === version && typeof saved.text === 'string') { cached++; continue; }
          const hash = await native.getScreenshotHash!(asset.uri);
          const key = `ocr:${version}:${hash}`;
          let ocr = await readExtraction<{ text: string; capturedAt: number }>(key);
          if (!ocr) {
            onProgress(`Reading image ${read} on this phone`);
            ocr = { text: await recognizeImageText(asset.uri, language), capturedAt: asset.capturedAt };
            await writeExtraction(key, ocr);
          } else cached++;
          const extracted = extractScreenshotResult({ ...asset, capturedAt: ocr.capturedAt }, hash, ocr.text);
          page.push({
            asset,
            hash,
            text: ocr.text,
            regexItems: extracted.items.filter((item) => isUpcomingPlan(item)),
            message: extracted.message,
            saved,
            classified: extracted.items.length > 0,
          });
        } catch {
          // Never cache failure as an empty result: inaccessible/corrupt images retry next scan.
          errors++;
        }
      }
      const pending = page.filter((work) => !work.classified && work.message.body.trim().length > 0 && splitForLlm([work.message]).keep.length);
      if (infer && pending.length) {
        onProgress(`Categorizing ${pending.length} images with the on-device model`);
        const result = await ingestMessagePage(pending.map((work) => work.message), modelKey, infer);
        model += result.model;
      }
      for (const work of page) {
        const llmItems = ledgerBySource(work.message.id).filter((item) => isUpcomingPlan(item));
        const items = [...work.regexItems, ...llmItems.filter((item) => !work.regexItems.some((row) => row.id === item.id))];
        const removed = (work.saved?.itemIds ?? []).filter((id) => !items.some((item) => item.id === id) && !useLifeStore.getState().states[id]);
        await removeDerived(removed);
        const stores = [useTransactionStore.getState(), useEventStore.getState(), useSubscriptionStore.getState(), useLifeStore.getState()];
        if (work.regexItems.length) await persistParsedBatch({ items: work.regexItems, processed: [] });
        const corrected = (work.saved?.itemIds ?? []).filter((id) => !items.some((item) => item.id === id) && useLifeStore.getState().states[id]);
        const record: ScreenshotScan = { ...work.asset, hash: work.hash, text: work.text, itemIds: [...items.map((item) => item.id), ...corrected], parser: PARSER_VERSION, ocrVersion: version };
        await db.runAsync('INSERT OR REPLACE INTO screenshot_scans (asset_id, captured_at, payload) VALUES (?, ?, ?)', [work.asset.id, work.asset.capturedAt, JSON.stringify(record)]);
        for (const state of stores) state.addMany(items);
        added += items.filter((item) => !knownBefore.has(item.id)).length;
        for (const item of items) knownBefore.add(item.id);
      }
      if (assets.length < 50) break;
    }
    return { read, cached, added, errors, access, model };
  } finally { running = false; }
}
