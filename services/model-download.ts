import { getFinlifeNative } from '@/services/finlife-native';
import { stopModelDownload } from '@/store/model-download-store';

type DownloadOptions = { signal?: AbortSignal; onProgress?: (progress: number) => void };
let recovery: Promise<number> | null = null;

/** Cancel OS transfers left by a previous JS runtime before allowing a new job. */
export function recoverModelDownloads(): Promise<number> {
  if (!recovery) {
    recovery = cancelNativeModelDownloads().catch((error) => { recovery = null; throw error; });
  }
  return recovery;
}

async function cancelNativeModelDownloads(): Promise<number> {
  return await getFinlifeNative()?.cancelModelDownloads?.() ?? 0;
}

/** Recovery control works even when a previous runtime lost its JS download state. */
export async function stopAllModelDownloads(): Promise<number> {
  stopModelDownload();
  const native = getFinlifeNative();
  if (!native?.cancelModelDownloads) {
    throw new Error('Stopping hidden Android downloads needs the updated native build. Run npx expo run:android.');
  }
  return native.cancelModelDownloads();
}

/**
 * ExecuTorch downloads model/tokenizer files concurrently with Promise.all.
 * One failed file rejects that promise without stopping its sibling transfers.
 * Own an attempt signal so every failure cancels ALL files before the job ends
 * or a retry starts. A user's Stop also removes OS-owned DownloadManager jobs.
 */
export async function downloadModelResources<T>(source: T, options: DownloadOptions = {}): Promise<T> {
  await recoverModelDownloads();
  if (options.signal?.aborted) throw new Error('DOWNLOAD_ABORTED');
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort);
  try {
    const { download } = require('react-native-executorch') as typeof import('react-native-executorch');
    const result = await download(source, {
      signal: controller.signal,
      onProgress: (progress) => {
        if (!controller.signal.aborted) options.onProgress?.(progress);
      },
    });
    if (options.signal?.aborted) throw new Error('DOWNLOAD_ABORTED');
    return result;
  } catch (error) {
    // Abort siblings first, then await native removal before hiding the Stop UI.
    controller.abort();
    await cancelNativeModelDownloads();
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', abort);
  }
}
