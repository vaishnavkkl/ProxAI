import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { borderRadius, colors, gradients, spacing } from '@/styles';

type FinanceStatTone = 'pace' | 'save' | 'days' | 'in' | 'out' | 'net';

type FinanceStatProps = {
  label: string;
  value: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: FinanceStatTone;
};

export function FinanceStat({ label, value, hint, icon, tone }: FinanceStatProps) {
  return (
    <View accessibilityLabel={`${label} ${value}, ${hint}`} style={[styles.card, styles[tone]]}>
      <View style={styles.iconWrap}>
        <Ionicons color={colors.neutral[0]} name={icon} size={16} />
      </View>
      <AppText style={styles.label} variant="caption">
        {label}
      </AppText>
      <AppText style={styles.value} variant="amount">
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
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: 2,
    overflow: 'hidden',
    boxShadow: '0px 8px 18px rgba(11,18,32,0.18)',
  },
  pace: {
    backgroundColor: colors.primary[800],
    experimental_backgroundImage: `${gradients.statSheen}, ${gradients.statPace}`,
  },
  save: {
    backgroundColor: '#065F46',
    experimental_backgroundImage: `${gradients.statSheen}, ${gradients.statSave}`,
  },
  days: {
    backgroundColor: '#7C2D12',
    experimental_backgroundImage: `${gradients.statSheen}, ${gradients.statDays}`,
  },
  in: {
    backgroundColor: '#047857',
    experimental_backgroundImage: `${gradients.statSheen}, ${gradients.statIn}`,
  },
  out: {
    backgroundColor: '#9A3412',
    experimental_backgroundImage: `${gradients.statSheen}, ${gradients.statOut}`,
  },
  net: {
    backgroundColor: '#1E293B',
    experimental_backgroundImage: `${gradients.statSheen}, ${gradients.statNet}`,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.14)',
    marginBottom: spacing.xs,
  },
  label: {
    color: 'rgba(255,255,255,0.72)',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  value: {
    color: colors.neutral[0],
    fontSize: 15,
    lineHeight: 20,
  },
  hint: {
    color: 'rgba(255,255,255,0.64)',
  },
});
