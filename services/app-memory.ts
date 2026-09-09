import { Image } from 'expo-image';
import { Directory, Paths } from 'expo-file-system';

import { getFinlifeNative } from '@/services/finlife-native';
import { getModelRamState, unloadModelFromMemory } from '@/services/llm-service';
import { readMemory } from '@/services/memory-monitor';
import { disposeTextToImage, interruptTextToImage, isTextToImageBusy } from '@/services/text-to-image';
import { isVisionLoaded } from '@/services/vision-slot';
import { useUiStore } from '@/store/ui-store';

export type FreeMemoryResult = {
  ok: boolean;
  message: string;
  unloadedLlm: boolean;
  unloadedImage: boolean;
  clearedCacheBytes: number;
};

function toMb(bytes: number) {
  return bytes / (1024 * 1024);
}

function clearImagineCache() {
  try {
    const folder = new Directory(Paths.cache, 'imagine');
    if (folder.exists) {
      folder.delete();
    }
  } catch {
    // Cache folder may already be gone.
  }
}

export async function publishMemoryNow() {
  const reading = await readMemory();
  useUiStore.getState().forceMemory({
    usedMb: toMb(reading.usedBytes),
    availMb: toMb(reading.availBytes),
    totalMb: toMb(reading.totalBytes),
    modelMb: toMb(reading.modelBytes),
    diskMb: toMb(reading.diskBytes),
    deviceUsedMb: toMb(reading.deviceUsedBytes),
    deviceTotalMb: toMb(reading.deviceTotalBytes),
  });
}

export async function freeAppMemory(): Promise<FreeMemoryResult> {
  if (useUiStore.getState().isProcessing) {
    return {
      ok: false,
      message: 'Wait for Refresh or a download to finish.',
      unloadedLlm: false,
      unloadedImage: false,
      clearedCacheBytes: 0,
    };
  }
  if (isTextToImageBusy()) {
    return {
      ok: false,
      message: 'Wait for the image to finish, or tap Stop first.',
      unloadedLlm: false,
      unloadedImage: false,
      clearedCacheBytes: 0,
    };
  }

  interruptTextToImage();
  const hadLlm = getModelRamState().loaded;
  const hadImage = isVisionLoaded();
  const unloadedLlm = await unloadModelFromMemory();
  try {
    await disposeTextToImage();
  } catch (error) {
    await publishMemoryNow();
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not unload the image generator.',
      unloadedLlm: unloadedLlm || hadLlm,
      unloadedImage: false,
      clearedCacheBytes: 0,
    };
  }

  try {
    await Image.clearMemoryCache();
  } catch {
    // expo-image cache is optional on web.
  }
  try {
    await Image.clearDiskCache();
  } catch {
    // Disk cache lives in this app only.
  }
  clearImagineCache();

  const native = getFinlifeNative();
  let clearedCacheBytes = 0;
  try {
    const released = (await native?.releaseAppMemory?.()) ?? (await native?.getMemorySnapshot());
    clearedCacheBytes = released?.clearedCacheBytes ?? 0;
  } catch {
    clearedCacheBytes = 0;
  }

  useUiStore.getState().setModelInRam(getModelRamState().loaded);
  await publishMemoryNow();

  const reading = await readMemory();
  const deviceAvail = formatMb(reading.deviceAvailBytes);
  const didWork = unloadedLlm || hadLlm || hadImage || clearedCacheBytes > 0;
  return {
    ok: true,
    unloadedLlm: unloadedLlm || hadLlm,
    unloadedImage: hadImage,
    clearedCacheBytes,
    message: didWork
      ? `Freed this app’s RAM and cache. About ${deviceAvail} free on the phone now. Other apps were not stopped.`
      : `Nothing extra was in this app’s RAM. About ${deviceAvail} free on the phone. Other apps were not stopped.`,
  };
}

function formatMb(bytes: number) {
  const mb = Math.max(0, Math.round(bytes / (1024 * 1024)));
  return `${mb} MB`;
}
