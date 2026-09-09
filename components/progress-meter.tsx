import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { borderRadius, colors, spacing } from '@/styles';

type ProgressMeterProps = {
  progress: number;
  label?: string;
};

export function ProgressMeter({ progress, label }: ProgressMeterProps) {
  const percent = Math.max(0, Math.min(100, Math.round(progress * 100)));
  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText accessibilityLiveRegion="polite" variant="bodySmall">
          {label}
        </AppText>
      ) : null}
      <View
        accessibilityLabel={`Progress ${percent} percent`}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: percent }}
        style={styles.track}>
        <View style={[styles.fill, { width: `${Math.max(2, percent)}%` }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  track: {
    height: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[100],
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[500],
  },
});
