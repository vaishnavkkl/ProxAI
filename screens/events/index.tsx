import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';

import { AppText } from '@/components/app-text';
import { EventRow } from '@/components/event-row';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { SectionHero } from '@/components/section-hero';
import { importDeviceCalendar } from '@/services/device-calendar';
import { useEventStore } from '@/store/event-store';
import { useLifeStore } from '@/store/life-store';
import { useUiStore } from '@/store/ui-store';
import { relevantEvents, isHolidayEvent } from '@/utils/relevant-events';
import { regionalHolidays } from '@/utils/regional-holidays';
import { parseLocalDate } from '@/utils/message-date';
import { borderRadius, colors, spacing } from '@/styles';
import type { LedgerItem } from '@/types/ledger';

function keyExtractor(item: LedgerItem) { return item.id; }
function renderEvent({ item }: { item: LedgerItem }) { return <EventRow item={item} />; }

export function Events() {
  const storedItems = useEventStore((s) => s.items);
  const states = useLifeStore((s) => s.states);
  const [filter, setFilter] = useState<'all' | 'personal' | 'holidays'>('all');
  const [importing, setImporting] = useState(false);
  const items = relevantEvents([...storedItems, ...regionalHolidays()], states).filter((item) => filter === 'all' || (filter === 'holidays' ? isHolidayEvent(item) : !isHolidayEvent(item)));
  const grouped = new Map<string, LedgerItem[]>();
  for (const item of items) { const key = item.date!.slice(0, 7); const group = grouped.get(key) ?? []; group.push(item); grouped.set(key, group); }
  const sections = [...grouped].map(([key, data]) => ({ key, title: parseLocalDate(`${key}-01`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), data }));
  async function refreshCalendar() {
    if (importing) return;
    setImporting(true);
    try { const count = await importDeviceCalendar(); useUiStore.getState().setToast({ kind: 'success', message: count ? `${count} new calendar events added.` : 'Calendar checked for the next 2 months.' }); }
    catch (error) { useUiStore.getState().setToast({ kind: 'error', message: error instanceof Error ? error.message : 'Calendar import failed.' }); }
    finally { setImporting(false); }
  }
  return <ScreenScaffold scroll={false}>
    <SectionList style={styles.fill} sections={sections} keyExtractor={keyExtractor} renderItem={renderEvent} stickySectionHeadersEnabled={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list}
      ListHeaderComponent={<View style={styles.header}>
        <SectionHero title="Good days ahead" subtitle="Your plans, Kerala & India holidays" icon="calendar-outline" />
        <View style={styles.tools}><View style={styles.copy}><AppText variant="h4">Your calendar</AppText><AppText variant="caption" style={styles.muted}>Upcoming from today · next 2 months</AppText></View><Pressable accessibilityRole="button" disabled={importing} onPress={() => void refreshCalendar()} style={styles.importButton}><Ionicons name="sync-outline" size={18} color={colors.primary[600]} /><AppText variant="labelSmall" style={styles.blue}>{importing ? 'Syncing…' : 'Sync calendar'}</AppText></Pressable></View>
        <View style={styles.filters}>{(['all', 'personal', 'holidays'] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: filter === value }} onPress={() => setFilter(value)} style={[styles.filter, filter === value && styles.selected]}><AppText variant="labelSmall" style={filter === value ? styles.blue : styles.muted}>{value === 'all' ? 'All events' : value === 'personal' ? 'My plans' : 'Holidays'}</AppText></Pressable>)}</View>
      </View>}
      renderSectionHeader={({ section }) => <AppText variant="labelRegular" style={styles.month}>{section.title}</AppText>}
      ListEmptyComponent={<View style={styles.empty}><Ionicons name="calendar-clear-outline" size={32} color={colors.primary[500]} /><AppText variant="h4">Room for your next plan</AppText><AppText variant="bodySmall" style={styles.muted}>Only the next 2 months of appointments, bookings, and holidays appear here. Past dates stay out of this list.</AppText></View>}
    />
  </ScreenScaffold>;
}
const styles = StyleSheet.create({
  fill: { flex: 1 }, list: { paddingBottom: spacing['2xl'] }, header: { gap: spacing.lg }, tools: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, copy: { flex: 1, minWidth: 0, gap: spacing.xs }, muted: { color: colors.neutral[600] }, blue: { color: colors.primary[600] },
  importButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, borderRadius: borderRadius.full, backgroundColor: colors.primary[50] },
  filters: { flexDirection: 'row', padding: spacing.xs, borderRadius: borderRadius.lg, backgroundColor: colors.neutral[200] }, filter: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.md }, selected: { backgroundColor: colors.neutral[0] }, month: { marginTop: spacing.xl, marginBottom: spacing.md, color: colors.neutral[700] }, empty: { padding: spacing.xl, gap: spacing.md, marginTop: spacing.lg, borderRadius: borderRadius.xl, backgroundColor: colors.neutral[0] },
});
