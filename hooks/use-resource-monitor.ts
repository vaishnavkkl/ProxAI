import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { AppState } from 'react-native';

import { readMemory } from '@/services/memory-monitor';
import { useUiStore } from '@/store/ui-store';

/** Sample only while the resource sheet is focused and the app is active. */
export function useResourceMonitor() {
  useFocusEffect(useCallback(() => {
    let disposed = false;
    let active = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    let reading = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cached: { diskBytes: number; appMaxBytes: number } | undefined;
    let metadataAt = 0;
    let baseline = 0;

    async function sample() {
      if (disposed || !active || reading) return;
      reading = true;
      try {
        const now = Date.now();
        const refreshMetadata = now - metadataAt >= 10_000;
        const result = await readMemory(baseline, refreshMetadata ? undefined : cached);
        if (disposed || !active) return;
        if (!cached) baseline = result.usedBytes;
        cached = { diskBytes: result.diskBytes, appMaxBytes: result.totalBytes };
        if (refreshMetadata) metadataAt = now;
        const mb = (bytes: number) => bytes / (1024 * 1024);
        useUiStore.getState().forceMemory({
          usedMb: mb(result.usedBytes),
          availMb: mb(result.availBytes),
          totalMb: mb(result.totalBytes),
          modelMb: mb(result.modelBytes),
          diskMb: mb(result.diskBytes),
          deviceUsedMb: mb(result.deviceUsedBytes),
          deviceTotalMb: mb(result.deviceTotalBytes),
        });
      } catch {
        // A transient native read failure must not close the sheet.
      } finally {
        reading = false;
        if (!disposed && active) timer = setTimeout(() => void sample(), 1000);
      }
    }

    useUiStore.getState().clearMemory();
    void sample();
    const subscription = AppState.addEventListener('change', (state) => {
      active = state === 'active';
      clearTimeout(timer);
      if (active) void sample();
    });
    return () => {
      disposed = true;
      clearTimeout(timer);
      subscription.remove();
    };
  }, []));
}
