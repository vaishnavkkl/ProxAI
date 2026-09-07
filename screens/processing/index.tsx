import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { MemoryUsageCard } from '@/components/memory-usage-card';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, spacing } from '@/styles';
import { bottomSafeInset } from '@/utils/safe-area';

export function Processing() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isProcessing = useUiStore((s) => s.isProcessing);
  const llmProgress = useUiStore((s) => s.llmProgress);
  const llmLabel = useUiStore((s) => s.llmLabel);
  const memoryModelMb = useUiStore((s) => s.memoryModelMb);
  const memoryUsedMb = useUiStore((s) => s.memoryUsedMb);
  const memoryAvailMb = useUiStore((s) => s.memoryAvailMb);
  const memoryTotalMb = useUiStore((s) => s.memoryTotalMb);
  const memoryDiskMb = useUiStore((s) => s.memoryDiskMb);
  const memorySamples = useUiStore((s) => s.memorySamples);
  const memoryDeviceUsedMb = useUiStore((s) => s.memoryDeviceUsedMb);
  const memoryDeviceTotalMb = useUiStore((s) => s.memoryDeviceTotalMb);
  const memoryDeviceSamples = useUiStore((s) => s.memoryDeviceSamples);

  const widthPercent = `${Math.max(8, Math.round(llmProgress * 100))}%` as const;

  return (
    <View style={[styles.root, { paddingBottom: spacing['3xl'] + bottomSafeInset(insets.bottom) }]}>
      <View style={styles.handle} />
      <AppText style={styles.title} variant="h3">
        {isProcessing ? 'Working…' : 'App resources'}
      </AppText>
      <AppText style={styles.copy} variant="bodyRegular">
        {llmLabel ||
          (isProcessing
            ? 'Reading messages on this phone…'
            : 'App heap is this process. Device RAM is the whole phone.')}
      </AppText>
      <View
        accessibilityLabel={`Progress ${Math.round(llmProgress * 100)} percent`}
        accessibilityRole="progressbar"
        style={styles.track}>
        <View style={[styles.fill, { width: widthPercent }]} />
      </View>
      <MemoryUsageCard
        availMb={memoryAvailMb}
        diskMb={memoryDiskMb}
        modelMb={memoryModelMb}
        samples={memorySamples}
        totalMb={memoryTotalMb}
        usedMb={memoryUsedMb}
        deviceSamples={memoryDeviceSamples}
        deviceTotalMb={memoryDeviceTotalMb}
        deviceUsedMb={memoryDeviceUsedMb}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Dismiss processing status"
        onPress={() => router.back()}
        style={styles.button}>
        <AppText style={styles.buttonLabel} variant="labelLarge">
          {isProcessing ? 'Hide' : 'Done'}
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing['2xl'],
    paddingTop: spacing.lg,
    gap: spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[400],
    marginBottom: spacing.sm,
  },
  title: {
    textAlign: 'center',
  },
  copy: {
    textAlign: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[100],
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    backgroundColor: colors.primary[500],
    borderRadius: 2,
  },
  button: {
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: colors.neutral[0],
  },
});
