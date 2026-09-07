import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { deleteFixedExpense, saveSalary, upsertFixedExpense, type FixedExpenseKind } from '@/services/database';
import { useBudgetStore } from '@/store/budget-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, spacing } from '@/styles';
import { formatInr } from '@/utils/format-inr';
import { emiStillOwed, isEmiDone, monthlyFixedTotal, monthsLeft } from '@/utils/money-plan';

const MONTHLY_CHIPS = ['Rent', 'Wi-Fi', 'Electricity', 'SIMs', 'School', 'Maid'];
const EMI_CHIPS = ['Bike', 'Car', 'Phone', 'Laptop', 'Home loan', 'Personal loan'];
const TENURE_CHIPS = [6, 12, 18, 24, 36, 48];

export function MoneyPlan() {
  const salary = useBudgetStore((s) => s.salary);
  const expenses = useBudgetStore((s) => s.expenses);
  const setSalary = useBudgetStore((s) => s.setSalary);
  const upsertExpense = useBudgetStore((s) => s.upsertExpense);
  const removeExpense = useBudgetStore((s) => s.removeExpense);
  const setToast = useUiStore((s) => s.setToast);

  const [salaryText, setSalaryText] = useState(salary > 0 ? String(salary) : '');
  const [kind, setKind] = useState<FixedExpenseKind>('monthly');
  const [name, setName] = useState('');
  const [amountText, setAmountText] = useState('');
  const [monthsTotalText, setMonthsTotalText] = useState('');
  const [monthsPaidText, setMonthsPaidText] = useState('0');
  const [editingId, setEditingId] = useState<string | null>(null);

  const monthlyOut = monthlyFixedTotal(expenses);
  const leftover = salary - monthlyOut;
  const owed = emiStillOwed(expenses);
  const billCount = expenses.filter((item) => item.kind === 'monthly').length;
  const emiCount = expenses.filter((item) => item.kind === 'emi' && !isEmiDone(item)).length;

  async function persistSalary() {
    const next = Number(salaryText);
    if (!Number.isFinite(next) || next < 0) {
      return;
    }
    setSalary(next);
    await saveSalary(next);
    setToast({ kind: 'success', message: next > 0 ? `Paycheck set to ${formatInr(next)}` : 'Paycheck cleared' });
  }

  async function persistBill() {
    const amount = Number(amountText);
    if (!name.trim() || !Number.isFinite(amount) || amount <= 0) {
      setToast({ kind: 'error', message: 'Add a name and the amount you pay' });
      return;
    }

    let monthsTotal: number | null = null;
    let monthsPaid: number | null = null;

    if (kind === 'emi') {
      monthsTotal = Number(monthsTotalText);
      monthsPaid = Number(monthsPaidText || '0');
      if (!Number.isInteger(monthsTotal) || monthsTotal < 1) {
        setToast({ kind: 'error', message: 'How many months is this EMI for?' });
        return;
      }
      if (!Number.isInteger(monthsPaid) || monthsPaid < 0 || monthsPaid > monthsTotal) {
        setToast({ kind: 'error', message: 'Months already paid should be between 0 and the total' });
        return;
      }
    }

    const row = {
      id: editingId ?? `exp-${Date.now()}`,
      label: name.trim(),
      amount,
      kind,
      monthsTotal,
      monthsPaid,
    };
    upsertExpense(row);
    await upsertFixedExpense(row);
    setName('');
    setAmountText('');
    setMonthsTotalText('');
    setMonthsPaidText('0');
    setEditingId(null);
    setToast({
      kind: 'success',
      message: kind === 'emi' ? `${row.label} EMI saved` : `${row.label} added to monthly bills`,
    });
  }

  async function remove(id: string) {
    removeExpense(id);
    await deleteFixedExpense(id);
    if (editingId === id) {
      setEditingId(null);
      setName('');
      setAmountText('');
    }
    setToast({ kind: 'info', message: 'Removed from your plan' });
  }

  function startEdit(id: string) {
    const item = expenses.find((expense) => expense.id === id);
    if (!item) {
      return;
    }
    setEditingId(item.id);
    setKind(item.kind);
    setName(item.label);
    setAmountText(String(item.amount));
    setMonthsTotalText(item.monthsTotal != null ? String(item.monthsTotal) : '');
    setMonthsPaidText(item.monthsPaid != null ? String(item.monthsPaid) : '0');
  }

  return (
    <View style={styles.block}>
      <View style={styles.hero}>
        <AppText style={styles.heroOver} variant="overline">
          Left to live on
        </AppText>
        <AppText style={styles.heroAmount} variant="h1">
          {salary > 0 ? formatInr(leftover) : 'Add paycheck'}
        </AppText>
        <AppText style={styles.heroHint} variant="bodySmall">
          {salary > 0
            ? `${formatInr(salary)} in · ${formatInr(monthlyOut)} out${emiCount > 0 ? ` · ${emiCount} EMI${emiCount === 1 ? '' : 's'} running` : ''}`
            : 'Tell us what lands in your account. We’ll subtract rent, SIMs, and EMIs.'}
        </AppText>
        {owed > 0 ? (
          <AppText style={styles.heroHint} variant="caption">
            Still owed on EMIs {formatInr(owed)}
          </AppText>
        ) : null}
      </View>

      <View style={styles.card}>
        <AppText variant="h4">Your paycheck</AppText>
        <AppText variant="bodySmall">What usually hits your account each month?</AppText>
        <View style={styles.rupeeField}>
          <AppText style={styles.rupee} variant="h3">
            ₹
          </AppText>
          <TextInput
            accessibilityLabel="Monthly paycheck"
            keyboardType="numeric"
            onBlur={() => {
              void persistSalary();
            }}
            onChangeText={setSalaryText}
            placeholder="45,000"
            placeholderTextColor={colors.neutral[500]}
            style={styles.rupeeInput}
            value={salaryText}
          />
        </View>
      </View>

      <View style={styles.card}>
        <AppText variant="h4">{editingId ? 'Edit this bill' : 'Add a bill'}</AppText>
        <AppText variant="bodySmall">
          {kind === 'emi'
            ? 'A loan you pay down every month. We’ll keep the remaining months in view.'
            : 'Something that repeats, like rent or Wi-Fi.'}
        </AppText>

        <View style={styles.kindRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: kind === 'monthly' }}
            onPress={() => {
              setKind('monthly');
            }}
            style={[styles.kindCard, kind === 'monthly' ? styles.kindCardOn : undefined]}>
            <AppText variant="labelRegular">Monthly bill</AppText>
            <AppText variant="caption">Rent, SIMs, school</AppText>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: kind === 'emi' }}
            onPress={() => {
              setKind('emi');
            }}
            style={[styles.kindCard, kind === 'emi' ? styles.kindCardOn : undefined]}>
            <AppText variant="labelRegular">EMI / loan</AppText>
            <AppText variant="caption">Bike, phone, home</AppText>
          </Pressable>
        </View>

        <View style={styles.chips}>
          {(kind === 'emi' ? EMI_CHIPS : MONTHLY_CHIPS).map((chip) => (
            <Pressable
              key={chip}
              accessibilityRole="button"
              onPress={() => {
                setName(chip);
              }}
              style={[styles.chip, name === chip ? styles.chipOn : undefined]}>
              <AppText style={name === chip ? styles.chipOnLabel : undefined} variant="labelSmall">
                {chip}
              </AppText>
            </Pressable>
          ))}
        </View>

        <AppText variant="labelSmall">{kind === 'emi' ? 'What is this EMI for?' : 'What do you call it?'}</AppText>
        <TextInput
          accessibilityLabel="Bill name"
          onChangeText={setName}
          placeholder={kind === 'emi' ? 'Bike loan' : 'House rent'}
          placeholderTextColor={colors.neutral[500]}
          style={styles.input}
          value={name}
        />

        <AppText variant="labelSmall">You pay each month</AppText>
        <View style={styles.rupeeField}>
          <AppText style={styles.rupee} variant="h3">
            ₹
          </AppText>
          <TextInput
            accessibilityLabel="Monthly amount"
            keyboardType="numeric"
            onChangeText={setAmountText}
            placeholder={kind === 'emi' ? '8,500' : '12,000'}
            placeholderTextColor={colors.neutral[500]}
            style={styles.rupeeInput}
            value={amountText}
          />
        </View>

        {kind === 'emi' ? (
          <View style={styles.emiBlock}>
            <AppText variant="labelSmall">How many months in total?</AppText>
            <View style={styles.chips}>
              {TENURE_CHIPS.map((months) => (
                <Pressable
                  key={months}
                  accessibilityRole="button"
                  onPress={() => {
                    setMonthsTotalText(String(months));
                  }}
                  style={[styles.chip, monthsTotalText === String(months) ? styles.chipOn : undefined]}>
                  <AppText
                    style={monthsTotalText === String(months) ? styles.chipOnLabel : undefined}
                    variant="labelSmall">
                    {months} mo
                  </AppText>
                </Pressable>
              ))}
            </View>
            <TextInput
              accessibilityLabel="Total EMI months"
              keyboardType="numeric"
              onChangeText={setMonthsTotalText}
              placeholder="Or type 30"
              placeholderTextColor={colors.neutral[500]}
              style={styles.input}
              value={monthsTotalText}
            />
            <AppText variant="labelSmall">Months already paid</AppText>
            <TextInput
              accessibilityLabel="Months already paid"
              keyboardType="numeric"
              onChangeText={setMonthsPaidText}
              placeholder="0 if it just started"
              placeholderTextColor={colors.neutral[500]}
              style={styles.input}
              value={monthsPaidText}
            />
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            void persistBill();
          }}
          style={styles.primary}>
          <AppText style={styles.primaryLabel} variant="labelLarge">
            {editingId ? 'Save changes' : kind === 'emi' ? 'Add this EMI' : 'Add this bill'}
          </AppText>
        </Pressable>
        {editingId ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setEditingId(null);
              setName('');
              setAmountText('');
              setMonthsTotalText('');
              setMonthsPaidText('0');
            }}>
            <AppText style={styles.link} variant="labelSmall">
              Cancel edit
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {expenses.length > 0 ? (
        <View style={styles.list}>
          <AppText variant="h4">
            Your bills
            {billCount + emiCount > 0 ? ` · ${formatInr(monthlyOut)} / month` : ''}
          </AppText>
          {expenses.map((item) => {
            const left = monthsLeft(item);
            const done = isEmiDone(item);
            const subtitle =
              item.kind === 'emi'
                ? done
                  ? 'Paid off'
                  : `${left} of ${item.monthsTotal} months left · ${formatInr((left ?? 0) * item.amount)} remaining`
                : 'Every month';

            return (
              <View key={item.id} style={[styles.bill, done ? styles.billDone : undefined]}>
                <View style={styles.billCopy}>
                  <AppText variant="labelRegular">{item.label}</AppText>
                  <AppText variant="caption">{subtitle}</AppText>
                </View>
                <AppText variant="subamount">{formatInr(item.amount)}</AppText>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit ${item.label}`}
                  onPress={() => {
                    startEdit(item.id);
                  }}
                  style={styles.ghost}>
                  <AppText style={styles.link} variant="labelSmall">
                    Edit
                  </AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.label}`}
                  onPress={() => {
                    void remove(item.id);
                  }}
                  style={styles.ghost}>
                  <AppText style={styles.danger} variant="labelSmall">
                    Remove
                  </AppText>
                </Pressable>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.lg,
  },
  hero: {
    backgroundColor: colors.primary[800],
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  heroOver: {
    color: 'rgba(219,234,254,0.78)',
  },
  heroAmount: {
    color: colors.neutral[0],
  },
  heroHint: {
    color: 'rgba(219,234,254,0.82)',
  },
  card: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  rupeeField: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[50],
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  rupee: {
    color: colors.neutral[600],
  },
  rupeeInput: {
    flex: 1,
    height: 48,
    color: colors.neutral[900],
    fontSize: 18,
    fontWeight: '600',
  },
  kindRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  kindCard: {
    flex: 1,
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.xs,
    backgroundColor: colors.neutral[50],
  },
  kindCardOn: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[100],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[50],
    justifyContent: 'center',
  },
  chipOn: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[100],
  },
  chipOnLabel: {
    color: colors.primary[600],
  },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing.md,
    color: colors.neutral[900],
    fontSize: 14,
  },
  emiBlock: {
    gap: spacing.sm,
  },
  primary: {
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    color: colors.neutral[0],
  },
  list: {
    gap: spacing.sm,
  },
  bill: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  billDone: {
    opacity: 0.55,
  },
  billCopy: {
    flex: 1,
    gap: 2,
  },
  ghost: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  link: {
    color: colors.primary[500],
  },
  danger: {
    color: colors.semantic.danger,
  },
});
