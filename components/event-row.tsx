import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';

import { AppText } from '@/components/app-text';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, spacing } from '@/styles';
import type { LedgerItem } from '@/types/ledger';
import { formatInr } from '@/utils/format-inr';
import { formatLedgerClock } from '@/utils/format-when';
import { parseLocalDate } from '@/utils/message-date';
import { isHolidayEvent } from '@/utils/relevant-events';

export function EventRow({ item }: { item: LedgerItem }) {
  const date = parseLocalDate(item.date ?? '');
  const validDate = Number.isFinite(date.getTime());
  const holiday = isHolidayEvent(item);
  return <Pressable accessibilityRole="button" accessibilityLabel={`${item.merchant}, ${item.date}`} onPress={() => useUiStore.getState().setSelectedLedgerId(item.id)} style={styles.row}>
    <View style={styles.dateBlock}>
      <AppText variant="caption" style={styles.month}>{validDate ? date.toLocaleDateString('en-IN', { month: 'short' }).toUpperCase() : 'DATE'}</AppText>
      <AppText variant="h2" style={styles.day}>{validDate ? date.getDate() : '—'}</AppText>
      <AppText variant="caption" style={styles.muted}>{validDate ? date.toLocaleDateString('en-IN', { weekday: 'short' }) : 'Not set'}</AppText>
    </View>
    <View style={styles.body}>
      <AppText variant="caption" style={styles.kind}>{holiday ? 'HOLIDAY' : 'YOUR PLAN'}</AppText>
      <AppText numberOfLines={3} variant="labelRegular">{item.merchant || 'Your event'}</AppText>
      <AppText numberOfLines={2} variant="caption" style={styles.muted}>{holiday ? 'Kerala & India · All day' : [formatLedgerClock(item.date) || 'All day', item.location].filter(Boolean).join(' · ')}</AppText>
      {item.amount != null ? <AppText variant="labelSmall">{formatInr(item.amount)}</AppText> : null}
    </View>
    <Ionicons name="chevron-forward" size={16} color={colors.neutral[500]} />
  </Pressable>;
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, backgroundColor: colors.neutral[0], borderRadius: borderRadius.xl, borderWidth: 1, borderColor: colors.neutral[200], marginBottom: spacing.sm },
  dateBlock: { width: 64, flexShrink: 0, paddingVertical: spacing.sm, alignItems: 'center', borderRadius: 16, backgroundColor: colors.primary[50] },
  month: { color: colors.primary[600], letterSpacing: 1 }, day: { color: colors.primary[800] }, muted: { color: colors.neutral[600] }, kind: { color: colors.primary[600], letterSpacing: 0.5 }, body: { flex: 1, minWidth: 0, gap: spacing.xs },
});
