import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { CoachTyping } from '@/components/coach-typing';
import { askCoach, loadCoachSession, unloadCoachSession } from '@/services/llm-service';
import { useBudgetStore } from '@/store/budget-store';
import { useCoachStore, type CoachBubble } from '@/store/coach-store';
import { useEventStore } from '@/store/event-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import { useTransactionStore } from '@/store/transaction-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, layout, spacing } from '@/styles';
import { nextCoachPrompts } from '@/utils/coach-prompts';
import { formatInr, toInrText } from '@/utils/format-inr';
import { summarizeMonth } from '@/utils/month-finance';
import { buildSpendPlan, coachSnapshot, fallbackCoachReply } from '@/utils/spend-coach';

function lastUserQuestion(items: CoachBubble[]) {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (items[index].role === 'user') {
      return items[index].text;
    }
  }
  return null;
}

function keyExtractor(item: CoachBubble) {
  return item.id;
}

function renderBubble({ item }: { item: CoachBubble }) {
  return (
    <View style={item.role === 'user' ? styles.userWrap : styles.botWrap}>
      <AppText style={item.role === 'user' ? styles.userText : styles.botText} variant="bodyRegular">
        {item.role === 'assistant' ? toInrText(item.text) : item.text}
      </AppText>
    </View>
  );
}

export function Coach() {
  const router = useRouter();
  const listRef = useRef<FlatList<CoachBubble>>(null);
  const items = useTransactionStore((s) => s.financeItems);
  const events = useEventStore((s) => s.items);
  const subscriptions = useSubscriptionStore((s) => s.items);
  const salary = useBudgetStore((s) => s.salary);
  const expenses = useBudgetStore((s) => s.expenses);
  const messages = useCoachStore((s) => s.messages);
  const busy = useCoachStore((s) => s.busy);
  const status = useCoachStore((s) => s.status);
  const append = useCoachStore((s) => s.append);
  const setBusy = useCoachStore((s) => s.setBusy);
  const setStatus = useCoachStore((s) => s.setStatus);
  const setToast = useUiStore((s) => s.setToast);
  const isProcessing = useUiStore((s) => s.isProcessing);
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const [warming, setWarming] = useState(true);

  const summary = summarizeMonth(items, salary, expenses);
  const plan = buildSpendPlan(items, salary, expenses);
  const lastUser = lastUserQuestion(messages);
  const prompts = nextCoachPrompts(lastUser, plan);
  const blocked = busy || isProcessing || warming;
  const canSend = !blocked && draft.trim().length > 0;

  useEffect(() => {
    let alive = true;
    setWarming(true);
    setStatus('Loading the on-device coach…');
    void loadCoachSession((_progress, label) => {
      if (alive) {
        setStatus(label);
      }
    })
      .then(() => {
        if (!alive) {
          return;
        }
        setWarming(false);
        setStatus('Ready — ask in rupees');
      })
      .catch(() => {
        if (!alive) {
          return;
        }
        setWarming(false);
        setStatus('');
        setToast({
          kind: 'info',
          message: 'Coach will use your ledger numbers if the model is not ready.',
        });
      });

    return () => {
      alive = false;
      void unloadCoachSession();
    };
  }, [setStatus, setToast]);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, busy, warming]);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) {
      return;
    }
    if (isProcessing) {
      setToast({ kind: 'info', message: 'Wait for Refresh to finish, then ask again.' });
      return;
    }

    append('user', question);
    setDraft('');
    setBusy(true);
    setStatus('Reading your ledger…');

    const snapshot = coachSnapshot({
      plan,
      categories: summary.categories,
      transactions: items,
      expenses,
      subscriptions,
      events,
    });
    const prior = useCoachStore.getState().messages.slice(0, -1);
    const fallback = fallbackCoachReply(plan, question);

    try {
      const reply = await askCoach(
        question,
        snapshot,
        (_progress, label) => {
          setStatus(label);
        },
        prior,
      );
      append('assistant', reply || fallback);
    } catch {
      append('assistant', fallback);
    } finally {
      setBusy(false);
      setStatus('');
    }
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safe}>
      <View style={styles.bar}>
        <View style={styles.titleCopy}>
          <AppText variant="overline">Coach</AppText>
          <AppText variant="h3">Talk with your ledger</AppText>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close coach"
          onPress={() => {
            router.back();
          }}
          style={styles.iconBtn}>
          <Ionicons color={colors.neutral[900]} name="close" size={22} />
        </Pressable>
      </View>

      <View style={styles.planRow}>
        <View style={styles.plan}>
          <AppText style={styles.planLabel} variant="caption">
            Safe today
          </AppText>
          <AppText style={styles.planValue} variant="h3">
            {salary > 0 ? formatInr(plan.daily) : 'Set paycheck'}
          </AppText>
          <AppText style={styles.planMeta} variant="caption">
            {plan.daysLeft} days left
          </AppText>
        </View>
        <View style={styles.planSave}>
          <AppText style={styles.planLabel} variant="caption">
            Save this month
          </AppText>
          <AppText style={styles.planValue} variant="h3">
            {salary > 0 ? formatInr(plan.saveMonthly) : '—'}
          </AppText>
          <AppText style={styles.planMeta} variant="caption">
            20% after bills
          </AppText>
        </View>
      </View>

      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <FlatList
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <AppText variant="h4">Ask anything about this month</AppText>
              <AppText style={styles.empty} variant="bodyRegular">
                The coach reads paycheck, bills, income, and spends from this phone. Suggestions
                change after each question you send.
              </AppText>
            </View>
          }
          ListFooterComponent={busy || warming ? <CoachTyping label={status} /> : null}
          contentContainerStyle={styles.thread}
          data={messages}
          extraData={`${messages.length}:${busy}:${warming}`}
          keyExtractor={keyExtractor}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => {
            listRef.current?.scrollToEnd({ animated: true });
          }}
          ref={listRef}
          renderItem={renderBubble}
          style={styles.flex}
        />

        <View style={styles.chips}>
          {prompts.map((prompt) => (
            <Pressable
              accessibilityRole="button"
              disabled={blocked}
              key={prompt}
              onPress={() => {
                void send(prompt);
              }}
              style={[styles.chip, blocked ? styles.chipOff : undefined]}>
              <AppText style={blocked ? styles.chipLabelOff : undefined} variant="labelSmall">
                {prompt}
              </AppText>
            </Pressable>
          ))}
        </View>

        <View style={[styles.composer, focused ? styles.composerOn : undefined]}>
          <TextInput
            accessibilityLabel="Ask the coach"
            editable={!blocked}
            onBlur={() => {
              setFocused(false);
            }}
            onChangeText={setDraft}
            onFocus={() => {
              setFocused(true);
            }}
            onSubmitEditing={() => {
              void send(draft);
            }}
            placeholder={
              warming ? 'Loading coach…' : busy ? 'Coach is writing…' : 'Ask about spending or saving…'
            }
            placeholderTextColor={colors.neutral[500]}
            returnKeyType="send"
            style={styles.input}
            value={draft}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!canSend && !busy}
            onPress={() => {
              void send(draft);
            }}
            style={[styles.send, !canSend && !busy ? styles.sendOff : undefined]}>
            {busy ? (
              <ActivityIndicator color={colors.neutral[0]} size="small" />
            ) : (
              <Ionicons color={colors.neutral[0]} name="send" size={18} />
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.neutral[50],
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  titleCopy: {
    flex: 1,
    gap: spacing.xs,
  },
  iconBtn: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[100],
  },
  planRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  plan: {
    flex: 1,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.primary[800],
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 96,
  },
  planSave: {
    flex: 1,
    borderRadius: borderRadius.lg,
    backgroundColor: '#047857',
    padding: spacing.md,
    gap: spacing.xs,
    minHeight: 96,
  },
  planLabel: {
    color: 'rgba(219,234,254,0.78)',
    textTransform: 'uppercase',
  },
  planValue: {
    color: colors.neutral[0],
  },
  planMeta: {
    color: 'rgba(219,234,254,0.86)',
  },
  flex: {
    flex: 1,
  },
  thread: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  emptyCard: {
    gap: spacing.sm,
  },
  empty: {
    color: colors.neutral[600],
  },
  userWrap: {
    alignSelf: 'flex-end',
    maxWidth: '86%',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  botWrap: {
    alignSelf: 'flex-start',
    maxWidth: '86%',
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  userText: {
    color: colors.neutral[0],
  },
  botText: {
    color: colors.neutral[900],
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  chip: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    backgroundColor: colors.neutral[0],
    justifyContent: 'center',
  },
  chipOff: {
    backgroundColor: colors.neutral[100],
    borderColor: colors.neutral[200],
  },
  chipLabelOff: {
    color: colors.neutral[400],
  },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    minHeight: 56,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[0],
  },
  composerOn: {
    borderColor: colors.primary[500],
    borderWidth: 2,
  },
  input: {
    flex: 1,
    minHeight: 48,
    color: colors.neutral[900],
    fontSize: 14,
  },
  send: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOff: {
    backgroundColor: colors.neutral[400],
  },
});
