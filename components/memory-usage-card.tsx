import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ResourceAreaChart } from '@/components/resource-area-chart';
import { borderRadius, colors, spacing } from '@/styles';
import { formatBytes } from '@/utils/format-bytes';

type MemoryUsageCardProps = {
  modelMb: number;
  usedMb: number;
  availMb: number;
  totalMb: number;
  diskMb: number;
  samples: number[];
  deviceUsedMb: number;
  deviceTotalMb: number;
  deviceSamples: number[];
};

function ratio(used: number, total: number) {
  if (total <= 0) {
    return 0;
  }
  return Math.min(1, used / total);
}

export function MemoryUsageCard({
  modelMb,
  usedMb,
  availMb,
  totalMb,
  diskMb,
  samples,
  deviceUsedMb,
  deviceTotalMb,
  deviceSamples,
}: MemoryUsageCardProps) {
  const appPercent = Math.round(ratio(usedMb, totalMb) * 100);
  const devicePercent = Math.round(ratio(deviceUsedMb, deviceTotalMb) * 100);

  return (
    <View style={styles.stack}>
      <View style={styles.card}>
        <View style={styles.header}>
          <View>
            <AppText variant="overline">App heap</AppText>
            <AppText variant="h3">{appPercent}%</AppText>
          </View>
          <AppText variant="caption">
            {formatBytes(usedMb * 1024 * 1024)} / {formatBytes(totalMb * 1024 * 1024)}
          </AppText>
        </View>
        <ResourceAreaChart
          label="App heap over time"
          maxValue={totalMb > 0 ? totalMb : 1}
          samples={samples}
        />
        <AppText variant="caption">
          This app only. Model load ~{formatBytes(modelMb * 1024 * 1024)} · headroom{' '}
          {formatBytes(availMb * 1024 * 1024)} · on disk {formatBytes(diskMb * 1024 * 1024)}
        </AppText>
      </View>

      <View style={styles.card}>
        <View style={styles.header}>
          <View>
            <AppText variant="overline">Device RAM</AppText>
            <AppText variant="h3">{devicePercent}%</AppText>
          </View>
          <AppText variant="caption">
            {formatBytes(deviceUsedMb * 1024 * 1024)} / {formatBytes(deviceTotalMb * 1024 * 1024)}
          </AppText>
        </View>
        <ResourceAreaChart
          label="Whole phone RAM over time"
          maxValue={deviceTotalMb > 0 ? deviceTotalMb : 1}
          samples={deviceSamples}
        />
        <AppText variant="caption">All apps on this phone, not just ProxAI.</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: spacing.lg,
  },
  card: {
    backgroundColor: colors.neutral[50],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
});
