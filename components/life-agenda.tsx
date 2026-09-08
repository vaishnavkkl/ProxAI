import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { AppState, FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { MessageCapture } from '@/components/message-capture';
import { useLifeStore } from '@/store/life-store';
import { useEventStore } from '@/store/event-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, gradients, spacing } from '@/styles';
import { relevantEvents } from '@/utils/relevant-events';
import { confirmedRenewals } from '@/utils/renewals';
import { agendaGroups, dailyDigest, dashboardHighlights, MODULES } from '@/utils/life-agenda';
import { formatLedgerWhen } from '@/utils/format-when';
import { formatInr } from '@/utils/format-inr';
import type { LedgerItem } from '@/types/ledger';
import { regionalHolidays } from '@/utils/regional-holidays';

type AgendaEntry = { id: string; title: string; count: number } | { id: string; item: LedgerItem };

function AgendaRow({ item }: { item: LedgerItem }) {
  const select = useUiStore((s) => s.setSelectedLedgerId);
  const module = MODULES.find((entry) => entry.type === item.type)!;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.merchant ?? module.label}`}
      onPress={() => select(item.id)} style={item.type === 'security' ? styles.warningRow : styles.row}>
      <View style={item.type === 'security' ? styles.warningIcon : styles.rowIcon}>
        <Ionicons name={module.icon} color={item.type === 'security' ? colors.semantic.warningDark : colors.primary[600]} size={20} />
      </View>
      <View style={styles.copy}>
        <AppText variant="caption" style={styles.blue}>{module.label}</AppText>
        <AppText variant="labelRegular" numberOfLines={2}>{item.merchant || module.label}</AppText>
        <AppText variant="caption" style={styles.muted}>{item.type === 'security' ? 'Possible risk · tap to review' : formatLedgerWhen(item.date)}</AppText>
      </View>
      {item.amount != null ? <AppText variant="labelSmall" style={styles.amount}>{formatInr(item.amount)}</AppText> : <Ionicons name="chevron-forward" size={16} color={colors.neutral[500]} />}
    </Pressable>
  );
}

function renderEntry({ item }: { item: AgendaEntry }) {
  if ('item' in item) return <AgendaRow item={item.item} />;
  return <View style={styles.sectionHeading}>
    <View style={styles.heading}>
      <AppText variant="labelRegular">{item.title}</AppText>
      {item.count ? <AppText variant="caption" style={styles.count}>{item.count}</AppText> : null}
    </View>
    {!item.count ? <AppText variant="bodySmall" style={styles.muted}>No items scheduled. A little room in your day.</AppText> : null}
  </View>;
}

function entryKey(item: AgendaEntry) { return item.id; }

export function LifeAgenda({ header, footer }: { header?: ReactNode; footer?: ReactNode }) {
  const router = useRouter();
  const life = useLifeStore((s) => s.items);
  const states = useLifeStore((s) => s.states);
  const events = useEventStore((s) => s.items);
  const subscriptions = useSubscriptionStore((s) => s.items);
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [capture, setCapture] = useState(false);
  const [history, setHistory] = useState(false);
  const [browseAll, setBrowseAll] = useState(false);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    function scheduleMidnight() {
      if (timer) clearTimeout(timer);
      const current = new Date();
      setNow(current);
      const midnight = new Date(current); midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(scheduleMidnight, midnight.getTime() - current.getTime() + 100);
    }
    if (AppState.currentState !== 'background') scheduleMidnight();
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') scheduleMidnight();
      else if (timer) clearTimeout(timer);
    });
    return () => { if (timer) clearTimeout(timer); listener.remove(); };
  }, []);
  const items = [...life, ...relevantEvents([...events, ...regionalHolidays(now)], states, now), ...confirmedRenewals(subscriptions, states)];
  const all = agendaGroups(items, states, now);
  const filtered = items.filter((item) => (filter === 'all' || item.type === filter) &&
    [states[item.id]?.title, item.merchant, item.sourceBody, item.reference, item.note].join(' ').toLowerCase().includes(search.toLowerCase()));
  const groups = agendaGroups(filtered, states, now);
  const highlights = [...all.Important, ...all.Overdue, ...all.Today, ...all.Tomorrow, ...all['Next 7 days']].filter((item) => item.type !== 'transaction');
  const focused = dashboardHighlights(all);
  const entries: AgendaEntry[] = browseAll ? Object.entries(groups).flatMap(([title, rows]) => {
    if ((!history && ['History', 'Completed'].includes(title)) || (!rows.length && title !== 'Today')) return [];
    return [{ id: `section-${title}`, title, count: rows.length }, ...rows.map((item) => ({ id: item.id, item }))];
  }) : focused.map((item) => ({ id: item.id, item }));
  return (
    <>
    <FlatList
      style={styles.list}
      data={entries}
      renderItem={renderEntry}
      keyExtractor={entryKey}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      windowSize={7}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.listContent}
      ListHeaderComponent={<View style={styles.section}>
      {header}
      <Pressable accessibilityRole="button" accessibilityLabel="Open screenshot intelligence" onPress={() => router.push('/screenshots')} style={styles.screenshotFeature}>
        <View style={styles.screenshotIcon}><Ionicons name="scan" size={29} color={colors.primary[600]} /></View>
        <View style={styles.copy}><AppText variant="overline" style={styles.blue}>SCREENSHOT INTELLIGENCE</AppText><AppText variant="h4">Saved it? We’ll remember.</AppText><AppText variant="bodySmall" style={styles.muted}>Find bills, bookings & renewals in your screenshots</AppText></View>
        <Ionicons name="arrow-forward" size={22} color={colors.primary[600]} />
      </Pressable>
      <View style={styles.digest}>
        <View style={styles.heading}>
          <Ionicons name="sparkles-outline" size={18} color={colors.primary[100]} />
          <AppText variant="labelRegular" style={styles.onDigest}>Your day at a glance</AppText>
        </View>
        <AppText variant="h2" style={styles.onDigest}>{all.Important.length + all.Overdue.length ? `${all.Important.length + all.Overdue.length} ${all.Important.length + all.Overdue.length === 1 ? "item" : "items"} to review` : highlights.length ? 'Your next plans, together' : 'You’re all caught up'}</AppText>
        <AppText variant="bodySmall" style={styles.digestMuted}>{all.Today.some((item) => item.type !== 'transaction') ? `Today: ${dailyDigest(all.Today.filter((item) => item.type !== 'transaction'))}` : 'Nothing scheduled for today. Check your upcoming plans below.'}</AppText>
        <View style={styles.briefStats}>
          {[
            { label: 'Today', count: all.Today.filter((item) => item.type !== 'transaction').length },
            { label: 'This week', count: [...all.Tomorrow, ...all['Next 7 days']].filter((item) => item.type !== 'transaction').length },
            { label: 'To review', count: all.Important.length + all.Overdue.length },
          ].map((stat) => <View key={stat.label} style={styles.briefStat}><AppText variant="h3" style={styles.onDigest}>{stat.count}</AppText><AppText variant="caption" style={styles.digestMuted}>{stat.label}</AppText></View>)}
        </View>
      </View>
      <View style={styles.viewTabs}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: !browseAll }} onPress={() => { setBrowseAll(false); setSearchOpen(false); setSearch(''); }} style={[styles.viewTab, !browseAll && styles.viewTabOn]}><AppText variant="labelSmall" style={!browseAll ? styles.blue : styles.muted}>Highlights</AppText></Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ selected: browseAll }} onPress={() => setBrowseAll(true)} style={[styles.viewTab, browseAll && styles.viewTabOn]}><AppText variant="labelSmall" style={browseAll ? styles.blue : styles.muted}>Your plans</AppText></Pressable>
      </View>
      <View style={styles.toolbar}>
        <AppText variant="h4" style={styles.copy}>{browseAll ? 'Your organizer' : 'Needs attention'}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel={searchOpen ? 'Close search' : 'Search agenda'} accessibilityState={{ expanded: searchOpen }} onPress={() => { setBrowseAll(true); setSearchOpen(!searchOpen); if (searchOpen) setSearch(''); }} style={styles.searchButton}>
          <Ionicons name={searchOpen ? 'close' : 'search-outline'} size={21} color={colors.neutral[700]} />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Add a task" onPress={() => setCapture(true)} style={styles.add}>
          <Ionicons name="add" color={colors.primary[600]} size={20} /><AppText variant="labelSmall" style={styles.blue}>Add</AppText>
        </Pressable>
      </View>
      {searchOpen ? <TextInput accessibilityLabel="Search your agenda" autoFocus placeholder="Search tasks, bookings, merchants…" placeholderTextColor={colors.neutral[600]} value={search} onChangeText={setSearch} style={styles.search} /> : null}
      {browseAll ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.modules} keyboardShouldPersistTaps="handled">
        <Pressable accessibilityRole="button" accessibilityState={{ selected: filter === 'all' }} onPress={() => setFilter('all')} style={filter === 'all' ? styles.selectedChip : styles.chip}><AppText variant="labelSmall" style={filter === 'all' ? styles.onDigest : styles.muted}>All</AppText></Pressable>
        {MODULES.filter((module) => module.type !== 'transaction').map((module) => <Pressable key={module.type} accessibilityRole="button" accessibilityState={{ selected: filter === module.type }} onPress={() => setFilter(module.type)} style={filter === module.type ? styles.selectedChip : styles.chip}><AppText variant="labelSmall" style={filter === module.type ? styles.onDigest : styles.muted}>{module.label}</AppText></Pressable>)}
      </ScrollView> : null}
      </View>}
      ListEmptyComponent={<View style={styles.empty}><Ionicons name="checkmark-circle-outline" size={30} color={colors.primary[600]} /><AppText variant="h4">Nothing needs your attention</AppText><AppText variant="bodySmall" style={styles.muted}>Add a task or refresh your messages. Your next important item will appear here.</AppText></View>}
      ListFooterComponent={<View style={styles.section}>
      {!browseAll ? <Pressable accessibilityRole="button" onPress={() => setBrowseAll(true)} style={styles.historyButton}><AppText variant="labelSmall" style={styles.blue}>{highlights.length > 6 ? `View all ${highlights.length} upcoming items` : 'Explore all tasks, travel & deliveries'}</AppText><Ionicons name="arrow-forward" size={18} color={colors.primary[600]} /></Pressable> : <>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: history }} onPress={() => setHistory(!history)} style={styles.historyButton}><Ionicons name="time-outline" size={17} color={colors.neutral[600]} /><AppText variant="labelSmall" style={styles.muted}>{history ? 'Hide' : 'View'} history & completed ({groups.History.length + groups.Completed.length})</AppText><Ionicons name={history ? 'chevron-up' : 'chevron-down'} size={15} color={colors.neutral[600]} /></Pressable>
      {footer}
      </>}
      </View>}
    />
      <MessageCapture visible={capture} onClose={() => setCapture(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  screenshotFeature: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: 24, borderWidth: 1, borderColor: colors.primary[100], experimental_backgroundImage: 'linear-gradient(120deg, #EFF6FF, #DBEAFE, #F8FAFC)' },
  screenshotIcon: { width: 50, height: 56, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.neutral[0], transform: [{ rotate: '-5deg' }] },
  briefStats: { flexDirection: 'row', paddingTop: spacing.md, marginTop: spacing.xs, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.2)' },
  briefStat: { flex: 1, gap: spacing.xs },
  viewTabs: { flexDirection: 'row', padding: spacing.xs, borderRadius: borderRadius.lg, backgroundColor: colors.neutral[200] },
  viewTab: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.md },
  viewTabOn: { backgroundColor: colors.neutral[0], boxShadow: '0px 2px 4px rgba(0,0,0,0.06)' },
  empty: { backgroundColor: colors.neutral[0], borderRadius: borderRadius.xl, padding: spacing.xl, gap: spacing.sm },
  list: { flex: 1 },
  listContent: { gap: spacing.sm, paddingBottom: spacing['2xl'] },
  sectionHeading: { gap: spacing.sm, paddingTop: spacing.xl, paddingBottom: spacing.xs },
  section: { gap: spacing.md },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs },
  muted: { color: colors.neutral[600] },
  blue: { color: colors.primary[600] },
  count: { color: colors.neutral[600], backgroundColor: colors.neutral[100], paddingHorizontal: spacing.sm, borderRadius: borderRadius.full },
  add: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md, backgroundColor: colors.primary[50], borderRadius: borderRadius.full },
  digest: { backgroundColor: colors.primary[800], experimental_backgroundImage: gradients.hero, boxShadow: '0px 6px 16px rgba(30,58,138,0.16)', padding: spacing.xl, borderRadius: borderRadius.xl, gap: spacing.sm },
  onDigest: { color: colors.neutral[0] },
  digestMuted: { color: colors.primary[100] },
  modules: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.lg, borderRadius: borderRadius.full, backgroundColor: colors.neutral[100] },
  selectedChip: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.lg, borderRadius: borderRadius.full, backgroundColor: colors.primary[600] },
  searchButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  search: { minHeight: 48, borderWidth: 1, borderColor: colors.neutral[200], borderRadius: borderRadius.lg, padding: spacing.md, color: colors.neutral[900], backgroundColor: colors.neutral[0] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg, paddingHorizontal: spacing.md, borderRadius: borderRadius.lg, backgroundColor: colors.neutral[0], borderWidth: 1, borderColor: colors.neutral[200], boxShadow: '0px 2px 5px rgba(11,18,32,0.03)' },
  warningRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg, paddingHorizontal: spacing.md, borderRadius: borderRadius.lg, backgroundColor: colors.semantic.warningLight },
  rowIcon: { width: 40, height: 40, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary[50] },
  warningIcon: { width: 40, height: 40, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.neutral[0] },
  amount: { maxWidth: '30%', color: colors.neutral[900], textAlign: 'right' },
  historyButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg },
});
