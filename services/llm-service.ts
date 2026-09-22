import { importGoogleSources } from '@/services/device-calendar';
import { importInstalledSubscriptions } from '@/services/installed-apps';
import { isModelTimeout } from '@/services/model-deadline';
import { ingestMessagePage } from '@/services/message-ingestion';
import { getCatalogModel, resolveModelSources } from '@/services/model-catalog';
import { ensureParserRevision } from '@/services/parser-revision';
import { saveScanSummary } from '@/services/scan-summary';
import { notifyScanResult } from '@/services/reminders';
import { scanScreenshots, screenshotsEnabled } from '@/services/screenshot-scanner';
import { collectInboxPage, rememberInboxPage } from '@/services/sms-inbox';
import { useSettingsStore } from '@/store/settings-store';
import { refreshHomeBrief } from '@/services/home-brief';
import { getLlmRuntime } from './llm-runtime';
import type { BatchResult, CoachTurn, LlmAvailability, ProgressFn } from './llm-runtime-types';

export async function getModelAvailability(): Promise<LlmAvailability> { return getLlmRuntime().getAvailability(); }
export { getLlmRuntime } from './llm-runtime';
export async function downloadSelectedModel(onProgress: ProgressFn): Promise<void> { return getLlmRuntime().downloadSelectedModel(onProgress); }
export async function switchOnDeviceModel(onProgress: ProgressFn): Promise<void> { return getLlmRuntime().switchOnDeviceModel(onProgress); }
export async function unloadModelFromMemory(): Promise<boolean> { return getLlmRuntime().unloadFromMemory(); }
export async function releaseLlmSlot(): Promise<void> { return getLlmRuntime().releaseLlmSlot(); }
export function getModelRamState() { return getLlmRuntime().getRamState(); }
export async function askCoach(
  question: string,
  snapshot: string,
  onProgress: ProgressFn,
  history: CoachTurn[] = [],
  onToken?: (text: string) => void,
): Promise<string> {
  return getLlmRuntime().askCoach(question, snapshot, onProgress, history, onToken);
}
export async function loadCoachSession(onProgress: ProgressFn): Promise<void> { return getLlmRuntime().acquireCoachSession(onProgress); }
export async function unloadCoachSession(): Promise<void> { return getLlmRuntime().releaseCoachSession(); }
export function interruptCoach(): void { getLlmRuntime().interruptGeneration(); }
let scanning = false;

export async function processRefreshMessages(onProgress: ProgressFn, options: { skipMail?: boolean } = {}): Promise<BatchResult> {
  const result: BatchResult = { transactions: 0, events: 0, subscriptions: 0, life: 0, errors: 0, skipped: 0, read: 0, calendar: 0, mail: 0 };
  if (scanning) return { ...result, skipReason: 'A scan is already running.' };
  scanning = true;
  const runtime = getLlmRuntime();
  let regex = 0, model = 0, dropped = 0, llmRan = false;
  try {
    await ensureParserRevision();
    const settings = useSettingsStore.getState();
    const modelKey = JSON.stringify(resolveModelSources(settings));
    const availability = await runtime.getAvailability().catch(() => ({ status: 'unavailable' as const, reason: 'Local model is not ready.' }));
    let afterId = 0;
    let inferenceFailure: string | undefined;
    runtime.beginScan?.();
    // Page by the same ID ordering used in the native query, including restored/old SMS.
    // Each page is committed before reading another; no fixed page or AI-message cap.
    while (true) {
      onProgress(0.1, `Checking SMS · ${result.read} read`);
      const inbox = await collectInboxPage(afterId);
      if (inbox.source !== 'sms') {
        result.skipReason = inbox.source === 'denied' ? 'SMS access is off. Other enabled sources are still checked.' : 'SMS requires the Android development build.';
        break;
      }
      if (!inbox.messages.length) break;
      result.read = (result.read ?? 0) + inbox.messages.length;
      const page = await ingestMessagePage(inbox.messages, modelKey, availability.status === 'available' && !inferenceFailure
        ? (messages) => runtime.inferUnmatched(messages, onProgress) : undefined);
      result.transactions += page.transactions; result.events += page.events; result.subscriptions += page.subscriptions;
      result.life = (result.life ?? 0) + page.life; result.errors += page.errors;
      result.skipped = (result.skipped ?? 0) + page.pending;
      regex += page.regex; model += page.model; dropped += page.dropped;
      llmRan = llmRan || page.llmRan;
      inferenceFailure = page.failureReason ?? inferenceFailure;
      if (page.pending) result.skipReason = inferenceFailure ?? (availability.status === 'available'
        ? 'Some AI batches could not finish. Their messages will retry on Refresh.'
        : availability.reason);
      await rememberInboxPage(inbox);
      if (inbox.lastNativeId <= afterId) throw new Error('SMS paging did not advance.');
      afterId = inbox.lastNativeId;
      if (inbox.fetched < inbox.limit) break;
    }
    await runtime.endScan?.();
    if (!options.skipMail) {
      onProgress(0.86, 'Checking Calendar');
      try {
        const google = await importGoogleSources();
        result.calendar = google.events; result.mail = google.mail;
        result.events += google.events; result.transactions += google.mail;
      } catch { result.errors++; }
    }
    onProgress(0.9, 'Finding subscription apps');
    await importInstalledSubscriptions().catch(() => { result.errors++; });
    if (await screenshotsEnabled()) {
      try {
        const shots = await scanScreenshots(new Date(), (label) => onProgress(0.95, label), availability.status === 'available' && !inferenceFailure
          ? (messages) => runtime.inferUnmatched(messages, onProgress) : undefined);
        result.screenshots = shots.read; result.screenshotItems = shots.added; result.errors += shots.errors;
      } catch (error) {
        if (isModelTimeout(error)) throw error;
        result.errors++;
        result.skipReason = error instanceof Error ? error.message : 'Screenshot scan could not finish.';
      }
    }
    await saveScanSummary({ at: Date.now(), modelLabel: getCatalogModel(settings.modelId).label, usedModel: llmRan || model > 0,
      transactions: result.transactions, events: result.events, subscriptions: result.subscriptions, life: result.life ?? 0, regex, model, dropped });
    await notifyScanResult({ events: result.events, life: result.life ?? 0, bills: result.screenshotItems ?? 0 });
    await refreshHomeBrief({ allowLoad: llmRan || runtime.getRamState().loaded }).catch(() => undefined);
  } catch (error) {
    if (isModelTimeout(error)) throw error;
    result.errors++;
    result.skipReason = 'Scan stopped early. Saved pages are kept; Refresh retries unfinished messages.';
  } finally {
    await runtime.endScan?.();
    scanning = false;
    onProgress(1, 'Done');
  }
  return result;
}
