import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';


import { AppBottomSheet } from '@/components/app-bottom-sheet';
import { AppText } from '@/components/app-text';
import { FinanceStat } from '@/components/finance-stat';
import { useBudgetStore } from '@/store/budget-store';
import { useTransactionStore } from '@/store/transaction-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, spacing } from '@/styles';
import { formatInr } from '@/utils/format-inr';
import { inBankAccount, listBankAccounts } from '@/utils/bank-account';
import { summarizeMonth } from '@/utils/month-finance';
import type { LedgerSort } from '@/utils/sort-ledger';
import { buildSpendPlan } from '@/utils/spend-coach';

type FinanceAnalysisProps = {
  sort: LedgerSort;
  onSort: (sort: LedgerSort) => void;
};

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  grocery: 'cart-outline',
  dining: 'restaurant-outline',
  bills: 'flash-outline',
  work: 'briefcase-outline',
  income: 'trending-up-outline',
  other: 'ellipse-outline',
};

export function FinanceAnalysis({ sort, onSort }: FinanceAnalysisProps) {
  const [insights, setInsights] = useState(false);
  const items = useTransactionStore((s) => s.financeItems);
  const bankId = useUiStore((s) => s.financeBankId);
  const setFinanceCategory = useUiStore((s) => s.setFinanceCategory);
  const salary = useBudgetStore((s) => s.salary);
  const expenses = useBudgetStore((s) => s.expenses);
  const scoped = items.filter((item) => inBankAccount(item, bankId));
  const accountView = Boolean(bankId);
  const summary = summarizeMonth(scoped, accountView ? 0 : salary, accountView ? [] : expenses);
  const plan = buildSpendPlan(scoped, accountView ? 0 : salary, accountView ? [] : expenses);
  const accounts = listBankAccounts(items);
  const selected = accounts.find((account) => account.id === bankId);

  return (
    <View style={styles.block}>
      <View style={styles.summary}>
        <AppText style={styles.muted} variant="overline">
          {selected ? selected.label : summary.monthLabel}
        </AppText>
        <AppText variant="h1">{formatInr(summary.net)}</AppText>
        <AppText style={styles.muted} variant="bodySmall">
          Credits minus debits this month
        </AppText>
      </View>

      <View style={styles.row}>
        <FinanceStat hint="Money received" icon="trending-up-outline" label="Credited" tone="in" value={formatInr(summary.income)} />
        <FinanceStat hint="Money paid" icon="trending-down-outline" label="Debited" tone="out" value={formatInr(summary.spend)} />
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: insights }}
        onPress={() => {
          setInsights(true);
        }}
        style={styles.insightsButton}>
        <View style={styles.insightsIcon}>
          <Ionicons color={colors.primary[600]} name="analytics-outline" size={21} />
        </View>
        <View style={styles.copy}>
          <AppText variant="labelRegular">Budget & spending insights</AppText>
          <AppText style={styles.muted} variant="caption">
            Daily pace, savings target, and where it went
          </AppText>
        </View>
        <Ionicons color={colors.primary[600]} name="chevron-forward" size={16} />
      </Pressable>

      <AppBottomSheet
        accessibilityLabel="Close budget insights"
        onClose={() => {
          setInsights(false);
        }}
        title="Budget & insights"
        visible={insights}>
        <View style={styles.row}>
          <FinanceStat
            hint="Safe remaining"
            icon="sunny-outline"
            label="Per day"
            tone="pace"
            value={accountView || salary > 0 ? formatInr(plan.daily) : '—'}
          />
          <FinanceStat
            hint="20% after bills"
            icon="leaf-outline"
            label="Save"
            tone="save"
            value={
              accountView
                ? formatInr(Math.max(0, Math.round(summary.net * 0.2)))
                : salary > 0
                  ? formatInr(plan.saveMonthly)
                  : '—'
            }
          />
        </View>
        <FinanceStat hint="In this month" icon="calendar-outline" label="Days left" tone="days" value={String(plan.daysLeft)} />
        {summary.fixed > 0 || summary.emiOwed > 0 ? (
          <View style={styles.card}>
            <AppText variant="labelRegular">Fixed this month {formatInr(summary.fixed)}</AppText>
            {summary.emiOwed > 0 ? (
              <AppText style={styles.muted} variant="bodySmall">
                Still owed on EMIs {formatInr(summary.emiOwed)}
              </AppText>
            ) : null}
          </View>
        ) : null}
        {summary.categories.length > 0 ? (
          <View style={styles.card}>
            <AppText variant="h4">Where it went</AppText>
            {summary.categories.map((category) => (
              <Pressable
                accessibilityRole="button"
                key={category.id}
                onPress={() => {
                  setFinanceCategory(category.id);
                  setInsights(false);
                }}
                style={styles.catRow}>
                <View style={styles.catIcon}>
                  <Ionicons color={colors.primary[600]} name={CATEGORY_ICONS[category.id] ?? 'ellipse-outline'} size={18} />
                </View>
                <AppText style={styles.copy} variant="bodySmall">
                  {category.label}
                </AppText>
                <AppText variant="labelSmall">{formatInr(category.amount)}</AppText>
                <Ionicons color={colors.neutral[500]} name="chevron-forward" size={16} />
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.card}>
            <AppText variant="h4">No category split yet</AppText>
            <AppText style={styles.muted} variant="bodySmall">
              Refresh bank alerts to see grocery, dining, bills, and the rest.
            </AppText>
          </View>
        )}
      </AppBottomSheet>

      <View style={styles.listHead}>
        <AppText variant="h4">Transactions</AppText>
        <View style={styles.sorts}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: sort === 'recent' }}
            onPress={() => {
              onSort('recent');
            }}
            style={[styles.sort, sort === 'recent' ? styles.sortOn : undefined]}>
            <AppText style={sort === 'recent' ? styles.sortOnLabel : styles.muted} variant="labelSmall">
              Newest
            </AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: sort === 'amount' }}
            onPress={() => {
              onSort('amount');
            }}
            style={[styles.sort, sort === 'amount' ? styles.sortOn : undefined]}>
            <AppText style={sort === 'amount' ? styles.sortOnLabel : styles.muted} variant="labelSmall">
              Amount
            </AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.lg,
  },
  summary: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    gap: spacing.xs,
  },
  muted: {
    color: colors.neutral[600],
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  insightsButton: {
    minHeight: 64,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  insightsIcon: {
    width: 44,
    height: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  card: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  catIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[50],
  },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sorts: {
    flexDirection: 'row',
    padding: spacing.xs,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[200],
  },
  sort: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
  },
  sortOn: {
    backgroundColor: colors.neutral[0],
  },
  sortOnLabel: {
    color: colors.primary[600],
  },
});
