import { AppBottomSheet } from '@/components/app-bottom-sheet';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';


import { AppText } from '@/components/app-text';
import { FinanceAnalysis } from '@/components/finance-analysis';
import { LedgerRow } from '@/components/ledger-row';
import { MoneyPlan } from '@/components/money-plan';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { SectionHero } from '@/components/section-hero';
import { useTransactionStore } from '@/store/transaction-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, spacing } from '@/styles';
import type { LedgerItem } from '@/types/ledger';
import { inBankAccount, listBankAccounts } from '@/utils/bank-account';
import { formatInr } from '@/utils/format-inr';
import { CATEGORY_LABELS } from '@/utils/month-finance';
import { openCoach } from '@/utils/open-coach';
import { sortLedgerItems, type LedgerSort } from '@/utils/sort-ledger';

function keyExtractor(item: LedgerItem) {
  return item.id.replace(/:/g, '|');
}

function renderTransaction({ item }: { item: LedgerItem }) {
  return <LedgerRow item={item} />;
}

function FinanceHeader({
  onOpenPlan,
  sort,
  onSort,
  category,
  onClearCategory,
  flow,
  onFlow,
}: {
  onOpenPlan: () => void;
  sort: LedgerSort;
  onSort: (sort: LedgerSort) => void;
  category: string | null;
  onClearCategory: () => void;
  flow: 'all' | 'debit' | 'credit';
  onFlow: (flow: 'all' | 'debit' | 'credit') => void;
}) {
  const items = useTransactionStore((s) => s.financeItems);
  const bankId = useUiStore((s) => s.financeBankId);
  const setFinanceBankId = useUiStore((s) => s.setFinanceBankId);
  const accounts = useMemo(() => listBankAccounts(items), [items]);
  const selected = accounts.find((account) => account.id === bankId);

  return (
    <View style={styles.header}>
      <SectionHero
        icon="wallet-outline"
        subtitle={selected ? selected.label : 'This month on this phone'}
        title="Your money"
      />
      <View style={styles.tools}>
        <View style={styles.copy}>
          <AppText variant="h4">{accounts.length > 0 ? `${accounts.length} bank${accounts.length === 1 ? '' : 's'}` : 'All accounts'}</AppText>
          <AppText style={styles.muted} variant="caption">
            {category ? CATEGORY_LABELS[category] ?? category : 'Credits, debits, and paycheck'}
          </AppText>
        </View>
        <Pressable
          accessibilityLabel="Ask your personal assistant"
          accessibilityRole="button"
          onPress={openCoach}
          style={styles.toolBtn}>
          <Ionicons color={colors.primary[600]} name="chatbubbles-outline" size={18} />
          <AppText style={styles.blue} variant="labelSmall">
            Ask
          </AppText>
        </Pressable>
        <Pressable
          accessibilityLabel="Paycheck and bills"
          accessibilityRole="button"
          onPress={onOpenPlan}
          style={styles.toolBtn}>
          <Ionicons color={colors.primary[600]} name="options-outline" size={18} />
          <AppText style={styles.blue} variant="labelSmall">
            Paycheck
          </AppText>
        </Pressable>
      </View>
      {accounts.length > 0 ? (
        <ScrollView contentContainerStyle={styles.banks} horizontal showsHorizontalScrollIndicator={false}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !bankId }}
            onPress={() => {
              setFinanceBankId(null);
            }}
            style={[styles.bankChip, !bankId ? styles.bankChipOn : undefined]}>
            <AppText style={!bankId ? styles.blue : styles.muted} variant="labelSmall">
              Consolidated
            </AppText>
          </Pressable>
          {accounts.map((account) => {
            const on = bankId === account.id;
            return (
              <Pressable
                accessibilityLabel={`${account.label}, income ${formatInr(account.income)}, spend ${formatInr(account.spend)}`}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                key={account.id}
                onPress={() => {
                  setFinanceBankId(on ? null : account.id);
                }}
                style={[styles.bankChip, on ? styles.bankChipOn : undefined]}>
                <AppText style={on ? styles.blue : styles.muted} variant="labelSmall">
                  {account.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {category ? (
        <Pressable
          accessibilityLabel="Show all categories"
          accessibilityRole="button"
          onPress={onClearCategory}
          style={styles.filterChip}>
          <AppText variant="labelSmall">Showing {CATEGORY_LABELS[category] ?? category}</AppText>
          <AppText style={styles.blue} variant="labelSmall">
            Clear
          </AppText>
        </Pressable>
      ) : null}
      <FinanceAnalysis onSort={onSort} sort={sort} />
      <View style={styles.filters}>
        {(['all', 'debit', 'credit'] as const).map((value) => (
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: flow === value }}
            key={value}
            onPress={() => {
              onFlow(value);
            }}
            style={[styles.filter, flow === value && styles.filterOn]}>
            <AppText style={flow === value ? styles.blue : styles.muted} variant="labelSmall">
              {value === 'all' ? 'All' : value === 'debit' ? 'Debited' : 'Credited'}
            </AppText>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function EmptyFinance() {
  return (
    <View style={styles.empty}>
      <Ionicons color={colors.primary[500]} name="receipt-outline" size={32} />
      <AppText variant="h4">No transactions to show</AppText>
      <AppText style={styles.emptyCopy} variant="bodySmall">
        Refresh reads your bank alerts. Try another account or filter to see more.
      </AppText>
    </View>
  );
}

export function Finance({ embedded = false }: { embedded?: boolean }) {
  const items = useTransactionStore((s) => s.financeItems);
  const category = useUiStore((s) => s.financeCategory);
  const bankId = useUiStore((s) => s.financeBankId);
  const setFinanceCategory = useUiStore((s) => s.setFinanceCategory);
  const setFinanceBankId = useUiStore((s) => s.setFinanceBankId);
  useEffect(() => {
    if (bankId && !items.some((item) => inBankAccount(item, bankId))) {
      setFinanceBankId(null);
    }
  }, [bankId, items, setFinanceBankId]);
  const [planOpen, setPlanOpen] = useState(false);
  const [sort, setSort] = useState<LedgerSort>('recent');
  const [flow, setFlow] = useState<'all' | 'debit' | 'credit'>('all');
  const data = useMemo(() => sortLedgerItems(items.filter((item) => {
    if (flow !== 'all' && (flow === 'credit') !== (item.category === 'income')) return false;
    if (category && item.category !== category) {
      return false;
    }
    return inBankAccount(item, bankId);
  }), sort), [items, flow, category, bankId, sort]);

  return (
    <ScreenScaffold scroll={false} embedded={embedded}>
      <FlatList
        initialNumToRender={8}
        maxToRenderPerBatch={8}
        windowSize={7}
        contentContainerStyle={styles.list}
        data={data}
        extraData={`${sort}:${category ?? ''}:${bankId ?? ''}:${flow}`}
        keyExtractor={keyExtractor}
        ListEmptyComponent={EmptyFinance}
        ListHeaderComponent={
          <FinanceHeader
            category={category}
            flow={flow}
            onClearCategory={() => {
              setFinanceCategory(null);
            }}
            onFlow={setFlow}
            onOpenPlan={() => {
              setPlanOpen(true);
            }}
            onSort={setSort}
            sort={sort}
          />
        }
        renderItem={renderTransaction}
        showsVerticalScrollIndicator={false}
        style={styles.listFill}
      />
      <AppBottomSheet
        accessibilityLabel="Close money plan"
        onClose={() => {
          setPlanOpen(false);
        }}
        title="Paycheck and bills"
        visible={planOpen}>
        <MoneyPlan />
      </AppBottomSheet>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  listFill: {
    flex: 1,
  },
  list: {
    flexGrow: 1,
    paddingBottom: spacing['2xl'],
  },
  header: {
    gap: spacing.lg,
  },
  tools: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  muted: {
    color: colors.neutral[600],
  },
  blue: {
    color: colors.primary[600],
  },
  toolBtn: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[50],
  },
  banks: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  bankChip: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
    justifyContent: 'center',
  },
  bankChipOn: {
    borderColor: colors.primary[100],
    backgroundColor: colors.primary[50],
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
  },
  filters: {
    flexDirection: 'row',
    padding: spacing.xs,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[200],
  },
  filter: {
    minHeight: 48,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
  },
  filterOn: {
    backgroundColor: colors.neutral[0],
  },
  empty: {
    padding: spacing.xl,
    gap: spacing.md,
    marginTop: spacing.lg,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.neutral[0],
  },
  emptyCopy: {
    color: colors.neutral[600],
  },
});
