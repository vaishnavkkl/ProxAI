import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import type { ScanLookbackMonths } from '@/services/settings-persist';
import { borderRadius, colors, spacing } from '@/styles';

const OPTIONS: { months: ScanLookbackMonths; label: string }[] = [
  { months: 1, label: 'This month' },
  { months: 2, label: 'Last 2 months' },
  { months: 3, label: 'Last 3 months' },
  { months: 6, label: 'Last 6 months' },
];

type ScanLookbackProps = {
  value: ScanLookbackMonths;
  onChange: (months: ScanLookbackMonths) => void;
};

export function ScanLookback({ value, onChange }: ScanLookbackProps) {
  return (
    <View style={styles.card}>
      <AppText variant="labelRegular">Messages to scan</AppText>
      <AppText variant="bodySmall">
        This month just started, so pick an earlier range if you want older bank SMS. Already scanned
        messages are skipped.
      </AppText>
      <View style={styles.chips}>
        {OPTIONS.map((option) => {
          const selected = option.months === value;
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected }}
              key={option.months}
              onPress={() => {
                onChange(option.months);
              }}
              style={[styles.chip, selected ? styles.chipOn : undefined]}>
              <AppText style={selected ? styles.chipLabelOn : styles.chipLabel} variant="labelSmall">
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    backgroundColor: colors.neutral[50],
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[100],
  },
  chipLabel: {
    color: colors.neutral[700],
  },
  chipLabelOn: {
    color: colors.primary[500],
  },
});
