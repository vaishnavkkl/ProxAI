import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, fontFamilies, gradients, spacing } from '@/styles';
import type { LedgerItem } from '@/types/ledger';
import { accountOf } from '@/utils/bank-account';
import { signedInr } from '@/utils/format-inr';
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
  const amount =
    item.amount == null ? item.category : signedInr(income ? item.amount : -Math.abs(item.amount));
  const when = formatLedgerWhen(item.date);
  const bank = accountOf(item).label;

  return (
    <Pressable
      accessibilityHint="Shows transaction details"
      accessibilityRole="button"
      onPress={() => {
        openLedger(item.id);
      }}
      style={[styles.row, income ? styles.income : styles.spend]}>
      <View style={styles.iconWrap}>
        <Ionicons color={colors.neutral[0]} name={income ? 'arrow-down' : 'arrow-up'} size={18} />
      </View>
      <View style={styles.body}>
        <AppText numberOfLines={1} style={styles.title} variant="h4">
          {title}
        </AppText>
        <AppText numberOfLines={1} style={styles.meta} variant="caption">
          {income ? 'Credited' : 'Debited'} · {bank}
        </AppText>
        <AppText numberOfLines={2} style={styles.detail} variant="caption">
          {when}
        </AppText>
      </View>
      <AppText style={styles.amount} variant="amount">
        {amount}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 88,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
    overflow: 'hidden',
    boxShadow: '0px 8px 18px rgba(11,18,32,0.16)',
  },
  spend: {
    backgroundColor: '#9A3412',
    experimental_backgroundImage: gradients.spendCard,
  },
  income: {
    backgroundColor: '#064E3B',
    experimental_backgroundImage: gradients.incomeCard,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  body: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  title: {
    color: colors.neutral[0],
    fontFamily: fontFamilies.headingBold,
    fontWeight: '700',
  },
  meta: {
    color: 'rgba(255,255,255,0.78)',
  },
  detail: {
    color: 'rgba(255,255,255,0.7)',
  },
  amount: {
    maxWidth: '40%',
    flexShrink: 1,
    textAlign: 'right',
    fontSize: 18,
    color: colors.neutral[0],
    fontWeight: '700',
    fontFamily: fontFamilies.headingBold,
  },
});
