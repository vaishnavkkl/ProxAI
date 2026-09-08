import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { FlatList, Linking, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { AppText } from '@/components/app-text';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { SectionHero } from '@/components/section-hero';
import { listScreenshotScans, scanScreenshots, screenshotAccess, screenshotsEnabled, setScreenshotsEnabled, type ScreenshotScan, type ScreenshotAccess } from '@/services/screenshot-scanner';
import { useUiStore } from '@/store/ui-store';
import { colors, spacing, borderRadius } from '@/styles';
import { useLifeStore } from '@/store/life-store';
import { useTransactionStore } from '@/store/transaction-store';
import { useEventStore } from '@/store/event-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import { informationTitle, isUsefulInformation } from '@/utils/information';
import { formatLedgerWhen } from '@/utils/format-when';
import { formatInr } from '@/utils/format-inr';

function useExtractedItems() {
  const life = useLifeStore((s) => s.items);
  const transactions = useTransactionStore((s) => s.financeItems);
  const events = useEventStore((s) => s.items);
  const renewals = useSubscriptionStore((s) => s.items);
  return [...life, ...transactions, ...events, ...renewals].filter(isUsefulInformation);
}

function ScreenshotRow({ item }: { item: ScreenshotScan }) {
  const [open, setOpen] = useState(false);
  const extracted = useExtractedItems().filter((entry) => item.itemIds.includes(entry.id));
  const select = useUiStore((s) => s.setSelectedLedgerId);
  return <View style={styles.card}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)} style={styles.row}>
      <Image source={{ uri: item.uri }} recyclingKey={item.id} style={styles.thumbnail} contentFit="cover" />
      <View style={styles.copy}><AppText variant="labelRegular" numberOfLines={2}>{extracted[0] ? informationTitle(extracted[0]) : 'No useful details found'}</AppText><AppText variant="caption">{new Date(item.capturedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {extracted.length} details found</AppText></View>
      <Ionicons name={open ? 'remove' : 'add'} size={22} color={colors.primary[600]} />
    </Pressable>
    {open ? <View style={styles.details}>
      <Image source={{ uri: item.uri }} recyclingKey={item.id} contentFit="contain" style={styles.preview} />
      {extracted.map((entry) => <Pressable accessibilityRole="button" key={entry.id} onPress={() => select(entry.id)} style={styles.outline}><View style={styles.copy}><AppText variant="labelSmall">{informationTitle(entry)}</AppText><AppText variant="caption">{formatLedgerWhen(entry.date)}{entry.amount != null ? ` · ${formatInr(entry.amount)}` : ''}</AppText></View><Ionicons name="arrow-forward" size={18} color={colors.primary[600]} /></Pressable>)}
    </View> : null}
  </View>;
}
function renderItem({ item }: { item: ScreenshotScan }) { return <ScreenshotRow item={item} />; }
function keyExtractor(item: ScreenshotScan) { return item.id; }

export function Screenshots() {
  const router = useRouter();
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [rows, setRows] = useState<ScreenshotScan[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [access, setAccess] = useState<ScreenshotAccess>('denied');
  const [status, setStatus] = useState('Scan screenshots to find plans, renewals, deliveries and more.');
  const busy = useUiStore((s) => s.isProcessing);
  const extractedIds = new Set(useExtractedItems().map((item) => item.id));
  const shownHashes = new Set<string>();
  const usefulRows = rows.filter((row) => {
    if (shownHashes.has(row.hash) || !row.itemIds.some((id) => extractedIds.has(id))) return false;
    shownHashes.add(row.hash); return true;
  });
  useEffect(() => { let active = true; void listScreenshotScans(month).then((items) => { if (active) setRows(items); }).catch(() => {}); return () => { active = false; }; }, [month]);
  useEffect(() => { void screenshotsEnabled().then(setEnabled); void screenshotAccess().then(setAccess); }, []);
  async function enable(value: boolean) {
    const permission = value ? await screenshotAccess(true) : await screenshotAccess();
    setAccess(permission);
    const next = value && (permission === 'full' || permission === 'limited');
    await setScreenshotsEnabled(next); setEnabled(next);
    if (value && !next) setStatus(permission === 'unavailable' ? 'Available in the updated Android build.' : 'Photo access was not granted. You can allow it in phone settings.');
  }
  async function scan() {
    if (useUiStore.getState().isProcessing) return;
    useUiStore.getState().setProcessing(true);
    try {
      const permission = await screenshotAccess(true); setAccess(permission);
      const result = await scanScreenshots(month, setStatus);
      setStatus(`${result.read} checked · ${result.added} new items · ${result.cached} already read${result.errors ? ` · ${result.errors} could not be read; scan again to retry` : ''}`);
      setRows(await listScreenshotScans(month));
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Could not scan. Try again.'); }
    finally { useUiStore.getState().setProcessing(false); }
  }
  const currentMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  return <ScreenScaffold scroll={false}><FlatList data={usefulRows} renderItem={renderItem} keyExtractor={keyExtractor} contentContainerStyle={styles.list}
    ListHeaderComponent={<View style={styles.header}>
      <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={22} color={colors.primary[600]} /><AppText>Back</AppText></Pressable>
      <SectionHero icon="scan-outline" title="From your screenshots" subtitle="Useful details, remembered for you" />
      <View style={styles.card}><View style={styles.row}><View style={styles.copy}><AppText variant="labelRegular">Include in Refresh</AppText><AppText variant="bodySmall">Checks new screenshots from this month</AppText></View><Switch accessibilityLabel="Include screenshots in Refresh" disabled={busy} value={enabled} onValueChange={(value) => void enable(value)} trackColor={{ true: colors.primary[500], false: colors.neutral[400] }} /></View></View>
      <AppText variant="bodySmall">Reads Screenshots folders on this phone and shows useful details only. English / Latin text works offline; Malayalam is not supported yet.</AppText>
      {access === 'limited' ? <AppText variant="bodySmall">Only selected photos are accessible. Allow all photos to find every screenshot in the selected month.</AppText> : null}
      {access === 'denied' ? <Pressable accessibilityRole="button" style={styles.outline} onPress={() => void Linking.openSettings()}><AppText>Photo access settings</AppText></Pressable> : null}
      <View style={styles.row}><Pressable accessibilityRole="button" accessibilityLabel="Previous month" disabled={busy} style={styles.arrow} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Ionicons name="chevron-back" size={22} color={colors.primary[600]} /></Pressable><AppText style={styles.copy} variant="h4">{month.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</AppText><Pressable accessibilityRole="button" accessibilityLabel="Next month" disabled={busy || month.getTime() >= currentMonth} style={styles.arrow} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Ionicons name="chevron-forward" size={22} color={month.getTime() >= currentMonth ? colors.neutral[400] : colors.primary[600]} /></Pressable></View>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void scan()} style={styles.primary}><Ionicons name="scan-outline" size={22} color="white" /><AppText variant="labelRegular" style={styles.white}>{busy ? 'Scanning…' : 'Scan this month'}</AppText></Pressable>
      <AppText accessibilityLiveRegion="polite" variant="bodySmall">{status}</AppText>
    </View>}
    ListEmptyComponent={<View style={styles.empty}><Ionicons name="images-outline" size={36} color={colors.primary[500]} /><AppText variant="h4">Your useful finds appear here</AppText><AppText variant="bodySmall">Scan screenshots with booking confirmations, bills or renewal notices. Images with no actionable details are kept out of your organizer.</AppText></View>}
  /></ScreenScaffold>;
}
const styles = StyleSheet.create({
  preview: { width: '100%', height: 200, borderRadius: borderRadius.lg, backgroundColor: colors.neutral[100] },
  list: { gap: spacing.md, paddingBottom: spacing['2xl'] }, header: { gap: spacing.md }, row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, copy: { flex: 1, gap: spacing.xs },
  card: { backgroundColor: 'white', padding: spacing.md, borderWidth: 1, borderColor: colors.neutral[200], borderRadius: borderRadius.xl }, thumbnail: { width: 52, height: 66, borderRadius: 10, backgroundColor: colors.primary[50] },
  details: { gap: spacing.md, marginTop: spacing.md, borderTopWidth: 1, borderColor: colors.neutral[100], paddingTop: spacing.md }, outline: { minHeight: 48, padding: spacing.md, backgroundColor: colors.primary[50], borderRadius: borderRadius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, primary: { minHeight: 54, backgroundColor: colors.primary[600], borderRadius: borderRadius.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm }, white: { color: 'white' }, back: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, empty: { padding: spacing.xl, gap: spacing.md, alignItems: 'center' },
});
