import { recoverModelDownloads } from '@/services/model-download';

export function setupExecutorch() {
  // DownloadManager survives JS reloads and process death; Zustand does not.
  // Recovery performs no network requests and leaves completed models intact.
  void recoverModelDownloads().catch(() => undefined);
}
