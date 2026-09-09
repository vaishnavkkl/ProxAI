import * as Device from 'expo-device';

import { getFinlifeNative } from './finlife-native';
import { getModelStorageInfo } from './model-storage';

export type MemoryReading = {
  usedBytes: number;
  availBytes: number;
  totalBytes: number;
  modelBytes: number;
  diskBytes: number;
  deviceUsedBytes: number;
  deviceAvailBytes: number;
  deviceTotalBytes: number;
};

function clamp(value: number, max: number) {
  if (!Number.isFinite(value) || value < 0) {
    return 0;
  }
  if (!Number.isFinite(max) || max <= 0) {
    return value;
  }
  return Math.min(value, max);
}

async function appMaxBytes(): Promise<number> {
  try {
    return (await Device.getMaxMemoryAsync()) ?? 0;
  } catch {
    return 0;
  }
}

export async function readMemory(
  baselineHeapBytes = 0,
  cached?: { diskBytes: number; appMaxBytes: number },
): Promise<MemoryReading> {
  const diskBytes = cached?.diskBytes ?? getModelStorageInfo().totalBytes;
  const native = getFinlifeNative();
  const snapshot = native ? await native.getMemorySnapshot() : null;
  const javaUsed = snapshot?.javaUsedBytes ?? 0;
  const nativeUsed = snapshot?.nativeHeapBytes ?? 0;
  const appMax = cached?.appMaxBytes ?? await appMaxBytes();
  const appUsed = clamp(javaUsed, appMax || javaUsed);
  const appTotal = appMax > 0 ? appMax : Math.max(appUsed, 1);
  const modelRaw = Math.max(0, javaUsed + nativeUsed - baselineHeapBytes);
  const deviceTotal = snapshot?.totalBytes ?? 0;
  const deviceAvail = snapshot?.availBytes ?? 0;
  const deviceUsed = clamp(deviceTotal - deviceAvail, deviceTotal);

  return {
    usedBytes: appUsed,
    availBytes: Math.max(0, appTotal - appUsed),
    totalBytes: appTotal,
    modelBytes: clamp(modelRaw, appTotal),
    diskBytes,
    deviceUsedBytes: deviceUsed,
    deviceAvailBytes: Math.max(0, deviceTotal - deviceUsed),
    deviceTotalBytes: deviceTotal,
  };
}

export async function readHeapBytes(): Promise<number> {
  const native = getFinlifeNative();
  if (!native) {
    return 0;
  }
  const snapshot = await native.getMemorySnapshot();
  return snapshot.javaUsedBytes;
}
