import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, spacing } from '@/styles';
import type { LedgerItem } from '@/types/ledger';
import { formatInr } from '@/utils/format-inr';
import { formatLedgerWhen } from '@/utils/format-when';

function formatEventDate(date: string | null) {
  if (!date) {
    return 'Date not set';
  }
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) {
    return date;
  }
  return parsed.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export function EventRow({ item }: { item: LedgerItem }) {
  const title = item.merchant ?? item.note ?? 'Reminder';

  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => {
        useUiStore.getState().setSelectedLedgerId(item.id);
      }}
      style={styles.row}>
      <View style={styles.dateBlock}>
        <AppText style={styles.date} variant="h4">
          {formatEventDate(item.date)}
        </AppText>
        {item.important === 'high' ? (
          <AppText style={styles.flag} variant="caption">
            Important
          </AppText>
        ) : null}
      </View>
      <View style={styles.body}>
        <AppText numberOfLines={2} variant="labelRegular">
          {title}
        </AppText>
        <AppText numberOfLines={2} variant="caption">
          {formatLedgerWhen(item.date)} · {item.review?.trim() || item.note || item.category}
        </AppText>
      </View>
      {item.amount != null ? (
        <AppText style={styles.amount} variant="subamount">
          {formatInr(item.amount)}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    backgroundColor: colors.neutral[0],
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderColor: colors.semantic.warning,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  dateBlock: {
    width: 88,
    gap: 2,
  },
  date: {
    color: colors.neutral[900],
  },
  flag: {
    color: colors.semantic.warningDark,
    textTransform: 'uppercase',
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  amount: {
    color: colors.neutral[900],
  },
});
