import { Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

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
      <View style={styles.heading}><Ionicons name="time-outline" size={21} color={colors.primary[600]} /><AppText variant="labelRegular">Messages to scan</AppText></View>
      <AppText variant="bodySmall">
        Choose a wider range to find older renewal notices, bookings and bank messages.
        Already scanned messages are skipped.
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
  heading: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
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
