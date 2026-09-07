import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { borderRadius, colors, gradients, spacing } from '@/styles';

type StatTone = 'balance' | 'upcoming' | 'tasks';

type StatCardProps = {
  label: string;
  value: string;
  hint: string;
  icon: keyof typeof Ionicons.glyphMap;
  tone: StatTone;
};

export function StatCard({ label, value, hint, icon, tone }: StatCardProps) {
  return (
    <View
      accessibilityLabel={`${label} ${value}, ${hint}`}
      style={[styles.card, styles[tone]]}>
      <View style={styles.iconWrap}>
        <Ionicons color={colors.neutral[0]} name={icon} size={16} />
      </View>
      <AppText style={styles.label} variant="caption">
        {label}
      </AppText>
      <AppText style={styles.value} variant="amount">
        {value}
      </AppText>
      <AppText style={styles.hint} variant="bodySmall">
        {hint}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minHeight: 132,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    overflow: 'hidden',
    boxShadow: '0px 8px 18px rgba(11,18,32,0.18)',
  },
  balance: {
    backgroundColor: colors.primary[800],
    experimental_backgroundImage: `${gradients.statSheen}, ${gradients.statBalance}`,
  },
  upcoming: {
    backgroundColor: '#7C2D12',
    experimental_backgroundImage: `${gradients.statSheen}, ${gradients.statUpcoming}`,
  },
  tasks: {
    backgroundColor: '#115E59',
    experimental_backgroundImage: `${gradients.statSheen}, ${gradients.statTasks}`,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
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
    fontSize: 16,
    lineHeight: 22,
  },
  hint: {
    color: 'rgba(255,255,255,0.64)',
  },
});
