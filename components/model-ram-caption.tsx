import { useEffect } from 'react';

import { AppText } from '@/components/app-text';
import { publishMemoryNow } from '@/services/app-memory';
import { useUiStore } from '@/store/ui-store';
import { colors } from '@/styles';
import { formatBytes, formatRamMb } from '@/utils/format-bytes';

type ModelRamCaptionProps = {
  loaded: boolean;
  loadBytes?: number;
  paused?: boolean;
};

export function ModelRamCaption({ loaded, loadBytes = 0, paused = false }: ModelRamCaptionProps) {
  const usedMb = useUiStore((s) => s.memoryUsedMb);
  const totalMb = useUiStore((s) => s.memoryTotalMb);
  const deviceUsedMb = useUiStore((s) => s.memoryDeviceUsedMb);
  const deviceTotalMb = useUiStore((s) => s.memoryDeviceTotalMb);

  useEffect(() => {
    if (paused) {
      return;
    }
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function tick() {
      await publishMemoryNow().catch(() => undefined);
      if (alive) {
        timer = setTimeout(() => {
          void tick();
        }, 4000);
      }
    }
    void tick();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [paused]);

  const phoneFree = Math.max(0, deviceTotalMb - deviceUsedMb);
  const text = loaded
    ? `In RAM · ${formatRamMb(usedMb)} / ${formatRamMb(totalMb)} · ${formatRamMb(phoneFree)} free on the phone`
    : `Not in RAM · ${formatBytes(loadBytes)} to load · ${formatRamMb(phoneFree)} free on the phone`;

  return (
    <AppText numberOfLines={2} style={loaded ? styles.on : styles.off} variant="caption">
      {text}
    </AppText>
  );
}

const styles = {
  on: { color: colors.semantic.successDark },
  off: { color: colors.neutral[600] },
};
