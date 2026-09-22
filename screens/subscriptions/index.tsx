import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';

import { useRouter } from 'expo-router';
import { SubscriptionIcon } from '@/components/subscription-icon';
import { AppText } from '@/components/app-text';
import { MessageCapture } from '@/components/message-capture';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { SectionHero } from '@/components/section-hero';
import { useSubscriptionStore } from '@/store/subscription-store';
import { useLifeStore } from '@/store/life-store';
import { useUiStore } from '@/store/ui-store';
import { confirmedRenewals } from '@/utils/renewals';
import { formatLedgerWhen } from '@/utils/format-when';
import { formatInr } from '@/utils/format-inr';
import { borderRadius, colors, spacing } from '@/styles';
import type { LedgerItem } from '@/types/ledger';
import { importInstalledSubscriptions, openDiscoveredApp } from '@/services/installed-apps';

function RenewalRow({ item }: { item: LedgerItem }) {
  const select = useUiStore((s) => s.setSelectedLedgerId);
  return <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${item.merchant} renewal`} onPress={() => select(item.id)} style={styles.card}>
    <SubscriptionIcon id={item.id} name={item.merchant ?? ""} />
    <View style={styles.copy}><AppText variant="h4">{item.merchant}</AppText><AppText variant="bodySmall" style={styles.muted}>{item.date ? `Renewal: ${formatLedgerWhen(item.date)}` : 'Add renewal date'}</AppText><AppText variant="caption" style={styles.muted}>{item.sourceKind === 'screenshot' ? 'From a screenshot' : item.sourceId?.startsWith('manual-') ? 'Added by you' : 'From a renewal notice'}</AppText></View>
    {item.amount != null ? <AppText variant="labelRegular">{formatInr(item.amount)}</AppText> : null}
    <Ionicons name="chevron-forward" size={17} color={colors.neutral[500]} />
  </Pressable>;
}
function keyExtractor(item: LedgerItem) { return item.id; }

export function Subscriptions() {
  const router = useRouter();
  const storedItems = useSubscriptionStore((s) => s.items);
  const states = useLifeStore((s) => s.states);
  const items = confirmedRenewals(storedItems, states);
  const [capture, setCapture] = useState<{ mode: 'renewal'; title: string } | null>(null);
  const [showApps, setShowApps] = useState(true);
  useEffect(() => { void importInstalledSubscriptions().catch(() => undefined); }, []);
  const apps = storedItems.filter((item) => item.id.startsWith('app-') && !items.some((renewal) => renewal.merchant?.toLowerCase() === item.merchant?.toLowerCase()));
  async function openApp(id: string) {
    try { await openDiscoveredApp(id); }
    catch (error) { useUiStore.getState().setToast({ kind: 'info', message: error instanceof Error ? error.message : 'Could not open this app.' }); }
  }
  return <ScreenScaffold scroll={false}>
    <SectionList sections={[{ key: 'plans', data: items }, { key: 'apps', data: showApps ? apps : [] }]} stickySectionHeadersEnabled={false} keyExtractor={keyExtractor} contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}
      renderItem={({ item, section }) => section.key === 'plans' ? <RenewalRow item={item} /> : <View style={styles.appCard}>
        <View style={styles.cardTop}><SubscriptionIcon id={item.id} name={item.merchant ?? ""} /><View style={styles.copy}><AppText variant="labelRegular">{item.merchant}</AppText><AppText variant="caption" style={styles.muted}>Found on your phone</AppText></View><Pressable accessibilityRole="button" accessibilityLabel={`Open ${item.merchant}`} onPress={() => void openApp(item.id)} style={styles.openButton}><Ionicons name="open-outline" size={21} color={colors.primary[600]} /></Pressable></View>
        <View style={styles.cardTop}><AppText variant="caption" style={styles.copy}>Plan details not added yet</AppText><Pressable accessibilityRole="button" onPress={() => setCapture({ mode: 'renewal', title: item.merchant ?? '' })} style={styles.addPlan}><Ionicons name="add" size={17} color={colors.primary[600]} /><AppText variant="labelSmall" style={styles.blue}>Add my plan</AppText></Pressable></View>
      </View>}
      renderSectionHeader={({ section }) => section.key === 'plans' ? (!items.length ? <View style={styles.empty}><Ionicons name="receipt-outline" size={26} color={colors.primary[600]} /><AppText variant="h4">Your next renewal starts here</AppText><AppText variant="bodySmall" style={styles.muted}>Refresh to find renewal notices, or scan a subscription screenshot. An installed app does not confirm a paid subscription.</AppText></View> : null) : apps.length ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: showApps }} onPress={() => setShowApps(!showApps)} style={styles.discovery}>
        <View style={styles.discoveryIcon}><Ionicons name="apps-outline" size={25} color={colors.primary[600]} /></View><View style={styles.copy}><AppText variant="overline" style={styles.blue}>DISCOVERED FOR YOU</AppText><AppText variant="h4">{apps.length} apps on your phone</AppText><AppText variant="caption">{showApps ? 'Tap to fold away' : 'Tap to explore your services'}</AppText></View><View style={styles.toggle}><Ionicons name={showApps ? 'remove' : 'add'} size={21} color={colors.primary[600]} /></View>
      </Pressable> : null}
      ListHeaderComponent={<View style={styles.header}>
        <SectionHero title="Your renewals" subtitle={`${items.length} subscription${items.length === 1 ? '' : 's'} · confirmed by a notice or you`} icon="repeat-outline" />
        <View style={styles.actions}>
          <Pressable accessibilityRole="button" onPress={() => setCapture({ mode: 'renewal', title: '' })} style={styles.primary}><Ionicons name="add" color="white" size={20} /><AppText variant="labelSmall" style={styles.white}>Add renewal</AppText></Pressable>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.push('/screenshots')} style={styles.screenshotLink}><Ionicons name="scan-outline" size={21} color={colors.primary[600]} /><View style={styles.copy}><AppText variant="labelRegular">Saved a subscription screenshot?</AppText><AppText variant="caption">Read the details with Image intelligence</AppText></View><Ionicons name="arrow-forward" size={19} color={colors.primary[600]} /></Pressable>
        <AppText variant="caption" style={styles.muted}>Refresh checks SMS and installed apps. Email notices can be read from screenshots. Your email inbox is not connected.</AppText>
      </View>}
    />
    {capture ? <MessageCapture visible initialMode={capture.mode} initialTitle={capture.title} onClose={() => setCapture(null)} /> : null}
  </ScreenScaffold>;
}
const styles = StyleSheet.create({
  list: { gap: spacing.md, paddingBottom: spacing['2xl'] }, header: { gap: spacing.md },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.neutral[0], borderRadius: borderRadius.lg, borderWidth: 1, borderColor: colors.neutral[200] },
  icon: { width: 44, height: 44, borderRadius: borderRadius.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary[50] },
  copy: { flex: 1, minWidth: 0, gap: spacing.xs }, muted: { color: colors.neutral[600] }, white: { color: colors.neutral[0] }, blue: { color: colors.primary[600] },
  actions: { flexDirection: 'row', gap: spacing.sm }, primary: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, minHeight: 48, backgroundColor: colors.primary[600], borderRadius: borderRadius.lg },
  secondary: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 48, backgroundColor: colors.primary[100], borderRadius: borderRadius.lg },
  empty: { gap: spacing.sm, padding: spacing.lg, backgroundColor: colors.neutral[0], borderRadius: borderRadius.xl },
  discovery: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, borderRadius: 24, borderWidth: 1, borderColor: colors.primary[100], experimental_backgroundImage: 'linear-gradient(125deg, #EFF6FF, #DBEAFE, #F8FAFC)' },
  discoveryIcon: { width: 48, height: 48, borderRadius: 17, backgroundColor: colors.neutral[0], alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-6deg' }] }, toggle: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.neutral[0], alignItems: 'center', justifyContent: 'center' },
  appCard: { borderWidth: 1, borderColor: colors.neutral[200], borderRadius: 22, padding: spacing.md, gap: spacing.sm, backgroundColor: colors.neutral[0] }, cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md }, brand: { width: 44, height: 44, borderRadius: 15, backgroundColor: colors.primary[50], alignItems: 'center', justifyContent: 'center' }, openButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }, addPlan: { minHeight: 48, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: 14, backgroundColor: colors.primary[50] }, screenshotLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 64, padding: spacing.md, backgroundColor: colors.neutral[0], borderRadius: borderRadius.lg },
});
