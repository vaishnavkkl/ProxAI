import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppDialog } from '@/components/app-dialog';
import { AppText } from '@/components/app-text';
import { MailAccountPicker } from '@/components/mail-account-picker';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { StatCard } from '@/components/stat-card';
import { LifeAgenda } from '@/components/life-agenda';
import { ProgressMeter } from '@/components/progress-meter';
import { useLifeStore } from '@/store/life-store';
import { useMessageRefresh } from '@/hooks/use-message-refresh';
import { getCatalogModel } from '@/services/model-catalog';
import { resetLedgerData } from '@/services/reset-local-data';
import { useBudgetStore } from '@/store/budget-store';
import { useEventStore } from '@/store/event-store';
import { useScanSummaryStore } from '@/store/scan-summary-store';
import { useSettingsStore } from '@/store/settings-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import { useTransactionStore } from '@/store/transaction-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, spacing } from '@/styles';
import type { LedgerItem } from '@/types/ledger';
import { formatInr } from '@/utils/format-inr';
import { monthlyFixedTotal } from '@/utils/money-plan';
import { relevantEvents } from '@/utils/relevant-events';
import { listBankAccounts } from '@/utils/bank-account';
import { monthCategoryTotal } from '@/utils/month-finance';

const CATEGORIES = [
  { id: 'grocery', label: 'Grocery', icon: 'cart-outline' },
  { id: 'dining', label: 'Dining', icon: 'restaurant-outline' },
  { id: 'work', label: 'Work', icon: 'briefcase-outline' },
  { id: 'bills', label: 'Bills', icon: 'flash-outline' },
  { id: 'other', label: 'Other', icon: 'ellipse-outline' },
] as const;

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}

function scanWhen(at: number) {
  return new Date(at).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function netBalance(items: LedgerItem[]) {
  let total = 0;
  for (const item of items) {
    if (item.amount == null) {
      continue;
    }
    total += item.category === 'income' ? item.amount : -item.amount;
  }
  return total;
}

export function Home() {
  return (
    <ScreenScaffold scroll={false}>
      <LifeAgenda header={<DashboardHeader />} footer={<FinanceOverview />} />
    </ScreenScaffold>
  );
}

function DashboardHeader() {
  const { refresh, openResources, mailChoices, pickMail, skipMail } = useMessageRefresh();
  const busy = useUiStore((s) => s.isProcessing);
  const progress = useUiStore((s) => s.llmProgress);
  const label = useUiStore((s) => s.llmLabel);
  return (
    <View style={styles.header}>
      {mailChoices ? <MailAccountPicker accounts={mailChoices} onPick={pickMail} onSkip={skipMail} /> : null}
      <View style={styles.topRow}>
        <View style={styles.topCopy}>
          <AppText variant="caption" style={styles.muted}>PROXAI</AppText>
          <AppText variant="h3">{greeting()}</AppText>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Scan messages" accessibilityState={{ disabled: busy }} disabled={busy} onPress={refresh} style={styles.scanButton}>
          {busy ? <ActivityIndicator size="small" color={colors.primary[600]} /> : <Ionicons name="refresh-outline" size={19} color={colors.primary[600]} />}
          <AppText variant="labelSmall" style={styles.blue}>{busy ? 'Scanning' : 'Refresh'}</AppText>
        </Pressable>
      </View>
      <View style={styles.topRow}>
        <AppText variant="bodySmall" style={styles.muted}>{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}</AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="View scan and resource details" onPress={openResources} style={styles.resourceLink}>
          <Ionicons name="pulse-outline" size={16} color={colors.neutral[600]} />
          <AppText variant="caption" style={styles.muted}>Activity</AppText>
        </Pressable>
      </View>
      {busy ? <View style={styles.scanStatus}>
        <ProgressMeter progress={progress} label={label || 'Reading your messages…'} />
      </View> : null}
    </View>
  );
}

function FinanceOverview() {
  const [expanded, setExpanded] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const router = useRouter();
  const setToast = useUiStore((s) => s.setToast);
  const transactions = useTransactionStore((s) => s.financeItems);
  const events = useEventStore((s) => s.items);
  const life = useLifeStore((s) => s.items);
  const lifeStates = useLifeStore((s) => s.states);
  const subscriptions = useSubscriptionStore((s) => s.items);
  const scan = useScanSummaryStore((s) => s.summary);
  const modelId = useSettingsStore((s) => s.modelId);
  const setFinanceCategory = useUiStore((s) => s.setFinanceCategory);
  const setFinanceBankId = useUiStore((s) => s.setFinanceBankId);
  const salary = useBudgetStore((s) => s.salary);
  const fixedExpenses = useBudgetStore((s) => s.expenses);
  const accounts = listBankAccounts(transactions);
  let consolidatedIn = 0;
  let consolidatedOut = 0;
  for (const account of accounts) {
    consolidatedIn += account.income;
    consolidatedOut += account.spend;
  }
  const empty = transactions.length + events.length + subscriptions.length + life.length === 0;
  const fixedTotal = monthlyFixedTotal(fixedExpenses);
  const remaining = salary - fixedTotal + netBalance(transactions);

  return (
    <View style={styles.overview}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)} style={styles.overviewToggle}>
        <View style={styles.overviewIcon}><Ionicons name="wallet-outline" size={21} color={colors.primary[600]} /></View>
        <View style={styles.topCopy}>
          <AppText variant="labelRegular">Finance & insights</AppText>
          <AppText variant="caption" style={styles.muted}>Balances, accounts and spend insights</AppText>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.neutral[600]} />
      </Pressable>
      {expanded ? <View style={styles.overviewBody}>


      {__DEV__ ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setConfirmClear(true);
          }}
          style={styles.devClear}>
          <AppText style={styles.devClearLabel} variant="labelSmall">
            Clear scanned data
          </AppText>
        </Pressable>
      ) : null}

      <View style={styles.summaryRow}>
        <StatCard
          hint={salary > 0 ? 'Salary − fixed − spend' : 'On-device'}
          icon="wallet-outline"
          label="Balance"
          tone="balance"
          value={salary > 0 || transactions.length > 0 ? formatInr(remaining) : '—'}
        />
        <StatCard
          hint="Reminders"
          icon="alarm-outline"
          label="Upcoming"
          tone="upcoming"
          value={String(relevantEvents(events, lifeStates).length)}
        />
        <StatCard
          hint="Pending"
          icon="checkbox-outline"
          label="Tasks"
          tone="tasks"
          value={String(life.filter((item) => item.type === 'action' && (!lifeStates[item.id]?.status || lifeStates[item.id]?.status === 'open')).length)}
        />
      </View>

      {accounts.length > 0 ? (
        <View style={styles.section}>
          <AppText variant="h4">
            {accounts.length} bank{accounts.length === 1 ? '' : 's'}
          </AppText>
          <View style={styles.pills}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Consolidated income and expenses"
              onPress={() => {
                setFinanceBankId(null);
                setFinanceCategory(null);
                router.push('/(tabs)/finance' as Href);
              }}
              style={styles.pill}>
              <Ionicons color={colors.primary[600]} name="layers-outline" size={16} />
              <View style={styles.pillCopy}>
                <AppText numberOfLines={1} variant="labelSmall">
                  Consolidated
                </AppText>
                <AppText numberOfLines={1} variant="caption">
                  In {formatInr(consolidatedIn)} · Out {formatInr(consolidatedOut)}
                </AppText>
              </View>
            </Pressable>
            {accounts.map((account) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${account.label} income ${formatInr(account.income)} expenses ${formatInr(account.spend)}`}
                key={account.id}
                onPress={() => {
                  setFinanceBankId(account.id);
                  setFinanceCategory(null);
                  router.push('/(tabs)/finance' as Href);
                }}
                style={styles.pill}>
                <Ionicons color={colors.primary[600]} name="business-outline" size={16} />
                <View style={styles.pillCopy}>
                  <AppText numberOfLines={1} variant="labelSmall">
                    {account.label}
                  </AppText>
                  <AppText numberOfLines={1} variant="caption">
                    In {formatInr(account.income)} · Out {formatInr(account.spend)}
                  </AppText>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <AppText variant="h4">Finance categories</AppText>
        <View style={styles.categoryGrid}>
          {CATEGORIES.map((category) => {
            const total = monthCategoryTotal(transactions, category.id);
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${category.label} ${total > 0 ? formatInr(total) : 'no spends'}`}
                key={category.id}
                onPress={() => {
                  setFinanceCategory(category.id);
                  router.push('/(tabs)/finance' as Href);
                }}
                style={styles.categoryCard}>
                <View style={styles.categoryIcon}>
                  <Ionicons color={colors.primary[600]} name={category.icon} size={18} />
                </View>
                <View style={styles.categoryCopy}>
                  <AppText numberOfLines={1} variant="labelSmall">
                    {category.label}
                  </AppText>
                  <AppText numberOfLines={1} variant="caption">
                    {total > 0 ? formatInr(total) : '—'}
                  </AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {empty ? (
        <View style={styles.emptyCard}>
          <View style={styles.emptyIcon}>
            <Ionicons color={colors.primary[600]} name="sparkles-outline" size={28} />
          </View>
          <AppText variant="h4">Nothing to organize yet</AppText>
          <AppText style={styles.emptyCopy} variant="bodyRegular">
            Tap Refresh to organize messages and calendar events, or use + to add
            a task or scan images. Nothing is uploaded.
          </AppText>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <AppText variant="h4">Latest from this device</AppText>
          <AppText style={styles.emptyCopy} variant="bodyRegular">
            {scan
              ? `${scan.usedModel ? scan.modelLabel : 'Regex only'} · last scan ${scanWhen(scan.at)}`
              : `Ready with ${getCatalogModel(modelId).label}. Tap Refresh to scan this phone.`}
          </AppText>
          {scan ? (
            <AppText style={styles.emptyCopy} variant="bodySmall">
              {scan.life ?? 0} life items, {scan.transactions} spends, {scan.events} reminders, {scan.subscriptions} subs.
              Regex kept {scan.regex}
              {scan.usedModel ? ` · ${scan.modelLabel} added ${scan.model}` : ' · model not used — download one in Settings'}
              {scan.dropped > 0 ? ` · dropped ${scan.dropped} card or bill copies` : ''}.
            </AppText>
          ) : null}
          {accounts.length > 0 ? (
            <AppText style={styles.emptyCopy} variant="bodySmall">
              Tap an account above for that bank&apos;s in and out, or Consolidated for every
              account together.
            </AppText>
          ) : (
            <AppText style={styles.emptyCopy} variant="bodySmall">
              Bank SMS is checked on this device. Credit card statements are not counted twice.
            </AppText>
          )}
        </View>
      )}

      </View> : null}
      <AppDialog
        visible={confirmClear}
        title="Clear scanned data?"
        message="Removes saved messages, tasks, events, and completion history. Paycheck, rent, and EMIs stay."
        onClose={() => {
          setConfirmClear(false);
        }}
        actions={[
          { label: 'Cancel', tone: 'secondary', onPress: () => undefined },
          {
            label: 'Clear',
            tone: 'danger',
            onPress: () => {
              void resetLedgerData().then(() => {
                setToast({ kind: 'success', message: 'Scanned data cleared. Refresh can start again.' });
              });
            },
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs },
  muted: { color: colors.neutral[600] },
  blue: { color: colors.primary[600] },
  scanButton: { minHeight: 48, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primary[50], borderRadius: borderRadius.full },
  resourceLink: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingLeft: spacing.md },
  scanStatus: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.primary[50], borderRadius: borderRadius.md },
  overview: { borderTopWidth: 1, borderColor: colors.neutral[200], marginTop: spacing.md },
  overviewToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg, minHeight: 72 },
  overviewIcon: { padding: spacing.md, backgroundColor: colors.primary[50], borderRadius: borderRadius.lg },
  overviewBody: { gap: spacing.lg, paddingBottom: spacing.lg },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  devClear: {
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.semantic.dangerLight,
    backgroundColor: colors.semantic.dangerLight,
  },
  devClearLabel: {
    color: colors.semantic.dangerDark,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  section: {
    gap: spacing.md,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 48,
    maxWidth: '100%',
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 0,
  },
  pillCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    width: '48%',
    flexGrow: 1,
    flexBasis: '47%',
    minWidth: 0,
    minHeight: 56,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
  },
  categoryIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[100],
  },
  categoryCopy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  emptyCard: {
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    padding: spacing['2xl'],
    gap: spacing.sm,
    boxShadow: '0px 1px 3px rgba(0,0,0,0.06)',
  },
  emptyIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[100],
    marginBottom: spacing.xs,
  },
  emptyCopy: {
    textAlign: 'center',
  },
});
