import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';


import { AppText } from '@/components/app-text';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, spacing } from '@/styles';
import type { LedgerItem } from '@/types/ledger';
import { accountOf } from '@/utils/bank-account';
import { formatInr } from '@/utils/format-inr';
import { formatLedgerWhen } from '@/utils/format-when';
import { informationTitle } from '@/utils/information';

type LedgerRowProps = {
  item: LedgerItem;
};

function openLedger(id: string) {
  useUiStore.getState().setSelectedLedgerId(id);
}

export function LedgerRow({ item }: LedgerRowProps) {
  const income = item.category === 'income';
  const title = informationTitle(item);
  const amount = item.amount == null ? item.category : formatInr(item.amount);
  const when = formatLedgerWhen(item.date);
  const bank = accountOf(item).label;

  return (
    <Pressable
      accessibilityHint="Shows transaction details"
      accessibilityRole="button"
      onPress={() => {
        openLedger(item.id);
      }}
      style={styles.row}>
      <View style={[styles.iconWrap, income ? styles.iconIn : styles.iconOut]}>
        <Ionicons color={income ? colors.semantic.successDark : colors.semantic.dangerDark} name={income ? 'arrow-down' : 'arrow-up'} size={18} />
      </View>
      <View style={styles.body}>
        <AppText style={styles.kind} variant="caption">
          {income ? 'CREDITED' : 'DEBITED'}
        </AppText>
        <AppText numberOfLines={2} variant="labelRegular">
          {title}
        </AppText>
        <AppText numberOfLines={1} style={styles.muted} variant="caption">
          {bank} · {when}
        </AppText>
      </View>
      <AppText style={income ? styles.amountIn : styles.amountOut} variant="labelRegular">
        {income ? '+' : '−'}
        {amount}
      </AppText>
      <Ionicons color={colors.neutral[500]} name="chevron-forward" size={16} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    marginBottom: spacing.sm,
    minHeight: 88,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconIn: {
    backgroundColor: colors.semantic.successLight,
  },
  iconOut: {
    backgroundColor: colors.semantic.dangerLight,
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  kind: {
    color: colors.primary[600],
    letterSpacing: 0.5,
  },
  muted: {
    color: colors.neutral[600],
  },
  amountIn: {
    color: colors.semantic.successDark,
  },
  amountOut: {
    color: colors.semantic.dangerDark,
  },
});
