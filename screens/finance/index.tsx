import { KeyboardScreen } from '@/components/keyboard-screen';
import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { FinanceAnalysis } from '@/components/finance-analysis';
import { LedgerRow } from '@/components/ledger-row';
import { MoneyPlan } from '@/components/money-plan';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { useTransactionStore } from '@/store/transaction-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, layout, spacing } from '@/styles';
import type { LedgerItem } from '@/types/ledger';
import { inBankAccount, listBankAccounts } from '@/utils/bank-account';
import { formatInr } from '@/utils/format-inr';
import { CATEGORY_LABELS } from '@/utils/month-finance';
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
  const router = useRouter();
  const items = useTransactionStore((s) => s.financeItems);
  const bankId = useUiStore((s) => s.financeBankId);
  const setFinanceBankId = useUiStore((s) => s.setFinanceBankId);
  const accounts = listBankAccounts(items);
  const selected = accounts.find((account) => account.id === bankId);

  return (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <AppText variant="overline">
            {accounts.length > 0
              ? `${accounts.length} bank${accounts.length === 1 ? '' : 's'}`
              : 'Finance'}
          </AppText>
          <AppText variant="h2">
            {selected?.label ?? (category ? CATEGORY_LABELS[category] ?? category : 'All accounts')}
          </AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ask the money coach"
          onPress={() => {
            router.push('/coach' as Href);
          }}
          style={styles.iconBtn}>
          <Ionicons color={colors.primary[500]} name="chatbubble-ellipses-outline" size={22} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Paycheck and bills"
          onPress={onOpenPlan}
          style={styles.iconBtn}>
          <Ionicons color={colors.primary[500]} name="options-outline" size={22} />
        </Pressable>
      </View>
      {accounts.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.banks}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !bankId }}
            onPress={() => {
              setFinanceBankId(null);
            }}
            style={[styles.bankChip, !bankId ? styles.bankChipOn : undefined]}>
            <AppText style={!bankId ? styles.bankLabelOn : undefined} variant="labelSmall">
              Consolidated
            </AppText>
          </Pressable>
          {accounts.map((account) => {
            const on = bankId === account.id;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${account.label}, income ${formatInr(account.income)}, spend ${formatInr(account.spend)}`}
                accessibilityState={{ selected: on }}
                key={account.id}
                onPress={() => {
                  setFinanceBankId(on ? null : account.id);
                }}
                style={[styles.bankChip, on ? styles.bankChipOn : undefined]}>
                <AppText style={on ? styles.bankLabelOn : undefined} variant="labelSmall">
                  {account.label}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {category ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Show all categories"
          onPress={onClearCategory}
          style={styles.filterChip}>
          <AppText variant="labelSmall">Showing {CATEGORY_LABELS[category] ?? category}</AppText>
          <AppText style={styles.filterClear} variant="labelSmall">
            Clear
          </AppText>
        </Pressable>
      ) : null}
      <FinanceAnalysis onSort={onSort} sort={sort} />
      <View style={styles.flowTabs}>{(['all', 'debit', 'credit'] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: flow === value }} onPress={() => onFlow(value)} style={[styles.flowTab, flow === value && styles.flowOn]}><AppText variant="labelSmall" style={flow === value ? styles.bankLabelOn : undefined}>{value === 'all' ? 'All transactions' : value === 'debit' ? 'Debited' : 'Credited'}</AppText></Pressable>)}</View>
    </View>
  );
}

function EmptyFinance() {
  return (
    <View style={styles.empty}>
      <View style={styles.iconWrap}>
        <Ionicons color={colors.primary[600]} name="receipt-outline" size={28} />
      </View>
      <AppText variant="h4">No transactions to show</AppText>
      <AppText style={styles.copy} variant="bodyRegular">
        Refresh reads your bank alerts. Try another account or transaction filter to see more.
      </AppText>
    </View>
  );
}

export function Finance() {
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
  const scoped = items.filter((item) => {
    if (flow !== 'all' && (flow === 'credit') !== (item.category === 'income')) return false;
    if (category && item.category !== category) {
      return false;
    }
    return inBankAccount(item, bankId);
  });
  const data = sortLedgerItems(scoped, sort);

  return (
    <ScreenScaffold scroll={false}>
      <FlatList
        contentContainerStyle={styles.list}
        style={styles.listFill}
        data={data}
        extraData={`${sort}:${category ?? ''}:${bankId ?? ''}`}
        keyExtractor={keyExtractor}
        ListEmptyComponent={EmptyFinance}
        ListHeaderComponent={
          <FinanceHeader
            onOpenPlan={() => {
              setPlanOpen(true);
            }}
            onClearCategory={() => {
              setFinanceCategory(null);
            }}
            onSort={setSort}
            sort={sort}
            category={category}
            flow={flow}
            onFlow={setFlow}
          />
        }
        renderItem={renderTransaction}
        showsVerticalScrollIndicator={false}
      />
      <Modal
        animationType="slide"
        onRequestClose={() => {
          setPlanOpen(false);
        }}
        visible={planOpen}>
        <SafeAreaView edges={['top']} style={styles.sheet}>
        <KeyboardScreen>
          <View style={styles.sheetBar}>
            <AppText variant="h3">Paycheck and bills</AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close money plan"
              onPress={() => {
                setPlanOpen(false);
              }}
              style={styles.iconBtn}>
              <Ionicons color={colors.neutral[900]} name="close" size={22} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
            <MoneyPlan />
          </ScrollView>
        </KeyboardScreen>
      </SafeAreaView>
      </Modal>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  flowTabs: { flexDirection: 'row', padding: spacing.xs, backgroundColor: colors.neutral[200], borderRadius: borderRadius.lg },
  flowTab: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: borderRadius.md }, flowOn: { backgroundColor: colors.neutral[0] },
  listFill: {
    flex: 1,
  },
  list: {
    gap: spacing.md,
    flexGrow: 1,
    paddingBottom: 0,
  },
  header: {
    gap: spacing.lg,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  titleCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    backgroundColor: colors.neutral[100],
  },
  filterClear: {
    color: colors.primary[500],
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
    borderColor: colors.neutral[400],
    backgroundColor: colors.neutral[0],
    justifyContent: 'center',
  },
  bankChipOn: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[100],
  },
  bankLabelOn: {
    color: colors.primary[500],
  },
  iconBtn: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[100],
  },
  empty: {
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    boxShadow: '0px 1px 3px rgba(0,0,0,0.06)',
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    padding: spacing['2xl'],
    gap: spacing.sm,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[100],
    marginBottom: spacing.xs,
  },
  copy: {
    textAlign: 'center',
  },
  sheet: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  sheetBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sheetBody: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing['3xl'],
  },
});
