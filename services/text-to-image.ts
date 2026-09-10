import { Directory, File, Paths } from 'expo-file-system';

import { finishDownloadNotice, reportDownloadNotice } from '@/services/download-notice';
import { exclusiveInference, occupyInference, releaseInference } from '@/services/inference-slot';
import { getLlmRuntime } from '@/services/llm-runtime';
import type { ProgressFn } from '@/services/llm-runtime-types';
import { downloadModelResources } from '@/services/model-download';
import { findCachedFile, listCachedFileMap, unlinkNamedCacheFiles } from '@/services/model-storage';
import {
    cacheFileNameFromUrl,
    DEFAULT_TTI_VARIANT,
    getTtiVariant,
    isCachedTti,
    ttiCacheNames,
    ttiSourcesFor,
    ttiVariantSupported,
    type TtiVariantId,
} from '@/services/text-to-image-catalog';
import { markVisionLoaded, registerVisionUnload } from '@/services/vision-slot';
import { beginModelDownload } from '@/store/model-download-store';
import { useUiStore } from '@/store/ui-store';
import { canUseNativeLlm } from '@/utils/app-runtime';
import { transferLabel } from '@/utils/format-bytes';
import { encodeRgbaPng } from '@/utils/rgba-png';

type SdxsRunner = {
  generate: (prompt: string, seed?: number) => Promise<{
    width: number;
    height: number;
    data: Uint8Array;
  }>;
  dispose: () => void;
};

export const TTI_STOPPED = 'stopped';

let moduleInstance: SdxsRunner | null = null;
let loadedVariant: TtiVariantId | null = null;
let generating = false;
let registered = false;
let cancelled = false;
let downloadAbort: AbortController | null = null;
let imagineViews = 0;

function ensureRegistered() {
  if (registered) {
    return;
  }
  registered = true;
  registerVisionUnload(disposeTextToImage);
}

function asFileUri(uri: string) {
  if (uri.startsWith('file://') || uri.startsWith('content://')) {
    return uri;
  }
  return `file://${uri}`;
}

function nativeApi() {
  return require('react-native-executorch') as typeof import('react-native-executorch');
}

function stoppedError() {
  return new Error(TTI_STOPPED);
}

function isUserCancelError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /DOWNLOAD_ABORTED|aborted|The operation was aborted/i.test(message);
}

function emitTransfer(name: string, ratio: number, received: number, total: number, onProgress: ProgressFn) {
  const label = transferLabel(name, received, total, ratio);
  onProgress(ratio, label);
  void reportDownloadNotice(ratio, label);
}

function setBusy(value: boolean) {
  generating = value;
  useUiStore.getState().setImageBusy(value);
}

function releaseImagineIfIdle() {
  if (imagineViews === 0 && !generating) {
    void disposeTextToImage();
  }
}

export function attachImagine() {
  imagineViews += 1;
}

export function unloadImaginePipeline() {
  if (imagineViews > 0) {
    return;
  }
  if (generating) {
    cancelled = true;
  }
  void disposeTextToImage().catch(() => undefined);
}

export function detachImagine() {
  imagineViews = Math.max(0, imagineViews - 1);
  if (imagineViews > 0) {
    return;
  }
  // A file download can finish on disk. The SDXS pipeline does not stay in RAM.
  unloadImaginePipeline();
}

function throwIfStopped() {
  if (cancelled) {
    throw stoppedError();
  }
}

export function isTextToImageAvailable() {
  if (!canUseNativeLlm()) {
    return false;
  }
  try {
    nativeApi();
    return true;
  } catch {
    return false;
  }
}

export function isTextToImageBusy() {
  return generating;
}

export function isTextToImageLoaded() {
  return moduleInstance != null;
}

export function hasCachedTextToImage(id: TtiVariantId = DEFAULT_TTI_VARIANT) {
  try {
    return isCachedTti(ttiSourcesFor(id), listCachedFileMap());
  } catch {
    return false;
  }
}

async function deletePipeline(current: SdxsRunner) {
  try {
    current.dispose();
    return true;
  } catch {
    return false;
  }
}

export async function disposeTextToImage() {
  const current = moduleInstance;
  const variant = loadedVariant;
  moduleInstance = null;
  loadedVariant = null;
  if (current) {
    const gone = await deletePipeline(current);
    if (!gone) {
      moduleInstance = current;
      loadedVariant = variant;
      markVisionLoaded(true);
      occupyInference('tti');
      throw new Error('Could not unload the image generator from RAM.');
    }
  }
  markVisionLoaded(false);
  releaseInference('tti');
}

export function interruptTextToImage() {
  cancelled = true;
  try {
    downloadAbort?.abort();
  } catch {
    // No remote fetch was active.
  }
  if (moduleInstance && generating) {
    void disposeTextToImage().catch(() => undefined);
  }
}

async function saveGeneratedPng(buffer: { width: number; height: number; data: Uint8Array }) {
  const folder = new Directory(Paths.cache, 'imagine');
  if (!folder.exists) {
    folder.create({ intermediates: true, idempotent: true });
  }
  const file = new File(folder, `imagine-${Date.now()}.png`);
  if (!file.exists) {
    file.create();
  }
  file.write(encodeRgbaPng(buffer.width, buffer.height, buffer.data));
  return asFileUri(file.uri);
}

async function downloadUnlocked(id: TtiVariantId, onProgress: ProgressFn) {
  const variant = getTtiVariant(id);
  const sources = ttiSourcesFor(id);
  const name = `${variant.modelName} ${variant.label}`;
  if (isCachedTti(sources, listCachedFileMap())) {
    onProgress(1, `${name} is already on this phone`);
    return;
  }
  throwIfStopped();
  const total = variant.downloadBytes;
  const controller = new AbortController();
  const task = beginModelDownload('image', `Downloading ${name}…`, () => controller.abort());
  downloadAbort = controller;
  const report: ProgressFn = (progress, label) => { task.update(progress, label); onProgress(progress, label); };
  let lastProgressAt = 0;
  try {
    emitTransfer(name, 0, 0, total, report);
    await downloadModelResources(sources, {
      signal: controller.signal,
      onProgress: (progress) => {
        if (cancelled || controller.signal.aborted) {
          return;
        }
        const now = Date.now();
        if (progress < 1 && now - lastProgressAt < 150) return;
        lastProgressAt = now;
        const ratio = Math.max(0, Math.min(1, progress));
        emitTransfer(name, ratio, Math.round(ratio * total), total, report);
      },
    });
    if (controller.signal.aborted) throw stoppedError();
    throwIfStopped();
    emitTransfer(name, 1, total, total, report);
    void finishDownloadNotice(true, `${name} is saved on this phone.`);
  } catch (error) {
    const stopped = cancelled || controller.signal.aborted || isUserCancelError(error);
    void finishDownloadNotice(false, stopped ? 'Image model download stopped.' : 'Image model download did not finish.');
    if (stopped) {
      throw stoppedError();
    }
    throw error;
  } finally {
    downloadAbort = null;
    task.finish();
  }
}

export async function downloadTextToImage(id: TtiVariantId, onProgress: ProgressFn) {
  ensureRegistered();
  if (!isTextToImageAvailable()) {
    throw new Error('unavailable');
  }
  if (!ttiVariantSupported(id)) {
    throw new Error('This image model is not available on this phone.');
  }
  if (generating || downloadAbort) throw new Error('An image operation is already running.');
  cancelled = false;
  // A file transfer does not own native model memory or the inference queue.
  await downloadUnlocked(id, onProgress);
}

function cacheNamesToRemove(id: TtiVariantId) {
  const sources = ttiSourcesFor(id);
  const names = ttiCacheNames(sources);
  const other: TtiVariantId = id === 'xnnpack' ? 'coreml' : 'xnnpack';
  const files = listCachedFileMap();
  const otherPte = cacheFileNameFromUrl(ttiSourcesFor(other).modelPath);
  if ((files.get(otherPte) ?? 0) > 0) {
    const tokenizerName = cacheFileNameFromUrl(sources.tokenizerPath);
    return names.filter((name) => name !== tokenizerName);
  }
  return names;
}

export async function removeCachedTextToImage(id: TtiVariantId) {
  if (loadedVariant === id) {
    await disposeTextToImage();
  }
  return unlinkNamedCacheFiles(cacheNamesToRemove(id));
}

async function loadPipeline(id: TtiVariantId, onProgress: ProgressFn) {
  if (moduleInstance && loadedVariant === id) {
    markVisionLoaded(true);
    occupyInference('tti');
    return moduleInstance;
  }
  if (moduleInstance) {
    onProgress(0.16, 'Unloading the previous image model…');
    const previous = moduleInstance;
    const previousId = loadedVariant;
    moduleInstance = null;
    loadedVariant = null;
    const gone = await deletePipeline(previous);
    if (!gone) {
      moduleInstance = previous;
      loadedVariant = previousId;
      markVisionLoaded(true);
      throw new Error('Could not unload the previous image model.');
    }
    markVisionLoaded(false);
  }
  throwIfStopped();
  occupyInference('tti');
  const { createSdxsTextToImage } = nativeApi();
  const variant = getTtiVariant(id);
  const sources = ttiSourcesFor(id);
  onProgress(0.22, `Loading ${variant.modelName} ${variant.label} on this phone…`);
  try {
    const modelPath = findCachedFile(sources.modelPath);
    const tokenizerPath = findCachedFile(sources.tokenizerPath);
    if (!modelPath || !tokenizerPath) throw new Error('Download the image model first.');
    const local = {
      modelPath: decodeURI(modelPath.replace(/^file:\/\//, '')),
      tokenizerPath: decodeURI(tokenizerPath.replace(/^file:\/\//, '')),
    };
    throwIfStopped();
    const loaded = await createSdxsTextToImage(local);
    if (cancelled) {
      const gone = await deletePipeline(loaded);
      if (!gone) {
        moduleInstance = loaded;
        loadedVariant = id;
        markVisionLoaded(true);
        throw stoppedError();
      }
      releaseInference('tti');
      throw stoppedError();
    }
    moduleInstance = loaded;
    loadedVariant = id;
    markVisionLoaded(true);
    return loaded;
  } catch (error) {
    if (!moduleInstance) {
      releaseInference('tti');
    }
    if (cancelled || isUserCancelError(error)) {
      throw stoppedError();
    }
    throw error;
  }
}

export async function generateTextToImage(
  prompt: string,
  id: TtiVariantId,
  seed: number | undefined,
  onProgress: ProgressFn,
) {
  ensureRegistered();
  const trimmed = prompt.trim();
  if (!trimmed) {
    throw new Error('Write a short description first.');
  }
  if (!isTextToImageAvailable()) {
    throw new Error('unavailable');
  }
  if (!ttiVariantSupported(id)) {
    throw new Error('This image model is not available on this phone.');
  }

  if (downloadAbort || generating) throw new Error('An image operation is already running.');
  cancelled = false;
  if (!hasCachedTextToImage(id)) await downloadUnlocked(id, onProgress);
  throwIfStopped();
  return exclusiveInference(async () => {
    if (generating) {
      throw new Error('An image is already being generated.');
    }
    throwIfStopped();
    setBusy(true);
    try {
      throwIfStopped();
      await getLlmRuntime().releaseLlmSlot();
      throwIfStopped();
      const variant = getTtiVariant(id);
      const pipeline = await loadPipeline(id, onProgress);
      throwIfStopped();
      onProgress(0.64, `Drawing ${variant.imageSize}×${variant.imageSize}…`);
      let buffer;
      try {
        buffer = await pipeline.generate(trimmed, seed);
      } catch (error) {
        if (cancelled) {
          throw stoppedError();
        }
        throw error;
      }
      throwIfStopped();
      onProgress(0.9, 'Saving the image…');
      const uri = await saveGeneratedPng(buffer);
      onProgress(1, 'Image ready');
      return uri;
    } finally {
      setBusy(false);
      if (!moduleInstance) {
        releaseInference('tti');
      }
      releaseImagineIfIdle();
    }
  });
}

ensureRegistered();
