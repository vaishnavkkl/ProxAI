import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { FinanceStat } from '@/components/finance-stat';
import { useBudgetStore } from '@/store/budget-store';
import { useTransactionStore } from '@/store/transaction-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, gradients, spacing } from '@/styles';
import { formatInr } from '@/utils/format-inr';
import { inBankAccount, listBankAccounts } from '@/utils/bank-account';
import { summarizeMonth } from '@/utils/month-finance';
import type { LedgerSort } from '@/utils/sort-ledger';
import { buildSpendPlan } from '@/utils/spend-coach';

type FinanceAnalysisProps = {
  sort: LedgerSort;
  onSort: (sort: LedgerSort) => void;
};

export function FinanceAnalysis({ sort, onSort }: FinanceAnalysisProps) {
  const items = useTransactionStore((s) => s.items);
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
      <View style={styles.hero}>
        <AppText style={styles.onHeroOver} variant="overline">
          {selected ? selected.label : summary.monthLabel}
        </AppText>
        <AppText style={styles.onHero} variant="h1">
          {accountView
            ? formatInr(summary.net)
            : salary > 0
              ? formatInr(summary.leftover)
              : 'Add paycheck'}
        </AppText>
        <AppText style={styles.onHeroMuted} variant="bodySmall">
          {accountView
            ? 'Income minus spends in this account this month'
            : 'Left after bills and this month’s spends'}
        </AppText>
      </View>

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
        <FinanceStat
          hint="In this month"
          icon="calendar-outline"
          label="Days left"
          tone="days"
          value={String(plan.daysLeft)}
        />
      </View>

      <View style={styles.row}>
        <FinanceStat
          hint="Credits"
          icon="trending-up-outline"
          label="In"
          tone="in"
          value={formatInr(summary.income)}
        />
        <FinanceStat
          hint="Variable"
          icon="trending-down-outline"
          label="Out"
          tone="out"
          value={formatInr(summary.spend)}
        />
        <FinanceStat
          hint="In minus out"
          icon="pulse-outline"
          label="Net"
          tone="net"
          value={formatInr(summary.net)}
        />
      </View>

      {summary.fixed > 0 || summary.emiOwed > 0 ? (
        <View style={styles.card}>
          <AppText variant="labelRegular">Fixed this month {formatInr(summary.fixed)}</AppText>
          {summary.emiOwed > 0 ? (
            <AppText variant="bodySmall">Still owed on EMIs {formatInr(summary.emiOwed)}</AppText>
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
              }}
              style={styles.catRow}>
              <AppText variant="bodySmall">{category.label}</AppText>
              <AppText variant="subamount">{formatInr(category.amount)}</AppText>
            </Pressable>
          ))}
        </View>
      ) : null}

      {summary.reviews.length > 0 ? (
        <View style={styles.card}>
          <AppText variant="h4">Review</AppText>
          {summary.reviews.map((item) => (
            <View key={item.id} style={styles.review}>
              <AppText variant="labelRegular">{item.merchant ?? item.category}</AppText>
              <AppText variant="bodySmall">{item.review?.trim() || item.note}</AppText>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.listHead}>
        <AppText variant="h4">Recent spends</AppText>
        <View style={styles.sorts}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: sort === 'recent' }}
            onPress={() => {
              onSort('recent');
            }}
            style={[styles.sort, sort === 'recent' ? styles.sortOn : undefined]}>
            <AppText style={sort === 'recent' ? styles.sortLabelOn : styles.sortLabel} variant="labelSmall">
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
            <AppText style={sort === 'amount' ? styles.sortLabelOn : styles.sortLabel} variant="labelSmall">
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
  hero: {
    backgroundColor: colors.primary[800],
    experimental_backgroundImage: gradients.hero,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
    overflow: 'hidden',
    boxShadow: '0px 8px 18px rgba(11,18,32,0.18)',
  },
  onHero: {
    color: colors.neutral[0],
  },
  onHeroOver: {
    color: 'rgba(219,234,254,0.78)',
  },
  onHeroMuted: {
    color: 'rgba(219,234,254,0.82)',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 48,
  },
  review: {
    gap: 2,
  },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  sorts: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  sort: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    backgroundColor: colors.neutral[0],
    justifyContent: 'center',
  },
  sortOn: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[100],
  },
  sortLabel: {
    color: colors.neutral[700],
  },
  sortLabelOn: {
    color: colors.primary[500],
  },
});
