import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, useRouter } from 'expo-router';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { MailAccountPicker } from '@/components/mail-account-picker';
import { RefreshButton } from '@/components/refresh-button';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { StatCard } from '@/components/stat-card';
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
import { borderRadius, colors, gradients, layout, spacing } from '@/styles';
import type { LedgerItem } from '@/types/ledger';
import { formatInr } from '@/utils/format-inr';
import { monthlyFixedTotal } from '@/utils/money-plan';
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
  const router = useRouter();
  const { refresh, openResources, mailChoices, pickMail, skipMail } = useMessageRefresh();
  const isProcessing = useUiStore((s) => s.isProcessing);
  const llmProgress = useUiStore((s) => s.llmProgress);
  const llmLabel = useUiStore((s) => s.llmLabel);
  const setToast = useUiStore((s) => s.setToast);
  const transactions = useTransactionStore((s) => s.items);
  const events = useEventStore((s) => s.items);
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
  const empty = transactions.length + events.length + subscriptions.length === 0;
  const fixedTotal = monthlyFixedTotal(fixedExpenses);
  const remaining = salary - fixedTotal + netBalance(transactions);

  return (
    <ScreenScaffold>
      {mailChoices ? (
        <MailAccountPicker accounts={mailChoices} onPick={pickMail} onSkip={skipMail} />
      ) : null}
      <View style={styles.topRow}>
        <View style={styles.topCopy}>
          <AppText variant="overline">{greeting()}</AppText>
          <AppText variant="h2">Dashboard</AppText>
        </View>
      </View>

      <View accessibilityRole="summary" style={styles.heroCard}>
        <View style={styles.heroTop}>
          <View style={styles.heroCopy}>
            <AppText style={styles.onHero} variant="h3">
              Let&apos;s organize your life today
            </AppText>
            <AppText style={styles.onHeroMuted} variant="bodyRegular">
              Tap Refresh to scan bank SMS, Google Calendar, and Gmail on this phone.
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="App resource usage"
            onPress={openResources}
            style={styles.resourceBtn}>
            <Ionicons color={colors.neutral[0]} name="pulse-outline" size={22} />
          </Pressable>
        </View>
        <RefreshButton busy={isProcessing} onPress={refresh} />
        {isProcessing || llmLabel ? (
          <View style={styles.status}>
            <View
              accessibilityLabel={llmLabel || 'Processing'}
              accessibilityRole="progressbar"
              style={styles.track}>
              <View style={[styles.fill, { width: `${Math.max(8, Math.round(llmProgress * 100))}%` }]} />
            </View>
            <AppText style={styles.onHeroMuted} variant="caption">
              {llmLabel || 'Working…'}
            </AppText>
          </View>
        ) : null}
      </View>

      {__DEV__ ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => {
            Alert.alert(
              'Clear scanned data?',
              'Removes parsed messages only. Paycheck, rent, and EMIs stay.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Clear',
                  style: 'destructive',
                  onPress: () => {
                    void resetLedgerData().then(() => {
                      setToast({ kind: 'success', message: 'Scanned data cleared. Refresh can start again.' });
                    });
                  },
                },
              ],
            );
          }}
          style={styles.devClear}>
          <AppText style={styles.devClearLabel} variant="labelSmall">
            Clear scanned data
          </AppText>
        </Pressable>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => {
          router.push('/coach' as Href);
        }}
        style={styles.coachCard}>
        <View style={styles.coachIcon}>
          <Ionicons color={colors.neutral[0]} name="chatbubble-ellipses" size={20} />
        </View>
        <View style={styles.coachCopy}>
          <AppText style={styles.onHero} variant="h4">
            Ask your money coach
          </AppText>
          <AppText style={styles.onHeroMuted} variant="bodySmall">
            Daily and monthly spend limits from your ledger. On this phone only.
          </AppText>
        </View>
        <Ionicons color={colors.neutral[0]} name="chevron-forward" size={18} />
      </Pressable>

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
          value={String(events.length)}
        />
        <StatCard
          hint="Pending"
          icon="checkbox-outline"
          label="Tasks"
          tone="tasks"
          value={String(subscriptions.length)}
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
        <AppText variant="h4">Categories</AppText>
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
            Tap Refresh above. It reads bank SMS, Google Calendar, and Gmail
            receipts that are already on this phone. Nothing is uploaded.
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
              {scan.transactions} spends, {scan.events} reminders, {scan.subscriptions} subs.
              Regex kept {scan.regex}
              {scan.usedModel ? ` · model added ${scan.model}` : ' · model not used'}
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
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  topCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  heroCard: {
    backgroundColor: colors.primary[800],
    experimental_backgroundImage: gradients.hero,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  resourceBtn: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    experimental_backgroundImage: gradients.refresh,
  },
  status: {
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  track: {
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
  },
  fill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[0],
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
  heroCopy: {
    flex: 1,
    gap: spacing.sm,
  },
  onHero: {
    color: colors.neutral[0],
  },
  onHeroMuted: {
    color: 'rgba(219,234,254,0.86)',
  },
  coachCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    backgroundColor: colors.primary[800],
    experimental_backgroundImage: gradients.hero,
    minHeight: 72,
  },
  coachIcon: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  coachCopy: {
    flex: 1,
    gap: spacing.xs,
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
