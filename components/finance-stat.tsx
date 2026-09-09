import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { borderRadius, colors, spacing } from '@/styles';

type FinanceStatTone = 'pace' | 'save' | 'days' | 'in' | 'out' | 'net';

type FinanceStatProps = {
  label: string;
  value: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: FinanceStatTone;
};

const TONE_ICON: Record<FinanceStatTone, string> = {
  in: colors.semantic.successDark,
  out: colors.semantic.dangerDark,
  net: colors.primary[600],
  pace: colors.primary[600],
  save: colors.semantic.successDark,
  days: colors.semantic.warningDark,
};

export function FinanceStat({ label, value, hint, icon, tone }: FinanceStatProps) {
  return (
    <View accessibilityLabel={`${label} ${value}, ${hint}`} style={styles.card}>
      <View style={[styles.iconWrap, styles[tone]]}>
        <Ionicons color={TONE_ICON[tone]} name={icon} size={18} />
      </View>
      <AppText style={styles.label} variant="caption">
        {label}
      </AppText>
      <AppText style={styles.value} variant="h4">
        {value}
      </AppText>
      <AppText style={styles.hint} variant="caption">
        {hint}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 118,
    borderRadius: borderRadius.xl,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  in: {
    backgroundColor: colors.semantic.successLight,
  },
  out: {
    backgroundColor: colors.semantic.dangerLight,
  },
  net: {
    backgroundColor: colors.primary[50],
  },
  pace: {
    backgroundColor: colors.primary[50],
  },
  save: {
    backgroundColor: colors.semantic.successLight,
  },
  days: {
    backgroundColor: colors.semantic.warningLight,
  },
  label: {
    color: colors.neutral[600],
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    color: colors.neutral[900],
  },
  hint: {
    color: colors.neutral[600],
  },
});
