import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBottomSheet } from '@/components/app-bottom-sheet';
import { AppDialog } from '@/components/app-dialog';
import { AppText } from '@/components/app-text';
import { CoachTyping } from '@/components/coach-typing';
import { ScreenBack } from '@/components/screen-back';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import {
  askCoach,
  getModelAvailability,
  getModelRamState,
  interruptCoach,
  loadCoachSession,
  switchOnDeviceModel,
  unloadCoachSession,
} from '@/services/llm-service';
import { CATALOG, getCatalogModel, resolveModelSources, type ModelId } from '@/services/model-catalog';
import { hasCachedSources } from '@/services/model-storage';
import { useBudgetStore } from '@/store/budget-store';
import { useCoachStore, type CoachBubble } from '@/store/coach-store';
import { useLifeStore } from '@/store/life-store';
import { useEventStore } from '@/store/event-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import { useSettingsStore } from '@/store/settings-store';
import { useTransactionStore } from '@/store/transaction-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, gradients, layout, spacing } from '@/styles';
import { formatCoachTime } from '@/utils/coach-pin';
import { nextCoachPrompts } from '@/utils/coach-prompts';
import { toInrText } from '@/utils/format-inr';
import { summarizeMonth } from '@/utils/month-finance';
import { relevantEvents } from '@/utils/relevant-events';
import { bottomSafeInset } from '@/utils/safe-area';
import { buildSpendPlan, coachDisplayedReply, coachOpenLife, coachSnapshot, fallbackCoachReply } from '@/utils/spend-coach';

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

function CoachBubbleRow({ item }: { item: CoachBubble }) {
  const pinned = useCoachStore((s) => s.pins.some((pin) => pin.messageId === item.id));
  const togglePin = useCoachStore((s) => s.togglePin);
  const setToast = useUiStore((s) => s.setToast);
  const user = item.role === 'user';
  const when = formatCoachTime(item.at);

  return (
    <View style={user ? styles.userWrap : styles.botWrap}>
      <AppText style={user ? styles.userText : styles.botText} variant="bodyRegular">
        {user ? item.text : toInrText(item.text)}
      </AppText>
      {user ? (
        when ? <AppText style={styles.userTime} variant="caption">{when}</AppText> : null
      ) : (
        <View style={styles.meta}>
          {when ? <AppText style={styles.botTime} variant="caption">{when}</AppText> : <View style={styles.metaGrow} />}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={pinned ? 'Unpin from Home' : 'Pin a short summary to Home'}
            hitSlop={8}
            onPress={() => {
              void togglePin(item).then(() => {
                setToast({
                  kind: pinned ? 'info' : 'success',
                  message: pinned ? 'Removed from Home highlights' : 'Pinned a short summary on Home',
                });
              });
            }}
            style={styles.pinBtn}>
            <Ionicons
              color={pinned ? colors.primary[500] : colors.neutral[600]}
              name={pinned ? 'bookmark' : 'bookmark-outline'}
              size={16}
            />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function renderBubble({ item }: { item: CoachBubble }) {
  return <CoachBubbleRow item={item} />;
}

export function Coach() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const listRef = useRef<FlatList<CoachBubble>>(null);
  const released = useRef(false);
  const leaveAction = useRef<{ type: string } | null>(null);
  const items = useTransactionStore((s) => s.financeItems);
  const events = useEventStore((s) => s.items);
  const life = useLifeStore((s) => s.items);
  const lifeStates = useLifeStore((s) => s.states);
  const subscriptions = useSubscriptionStore((s) => s.items);
  const salary = useBudgetStore((s) => s.salary);
  const expenses = useBudgetStore((s) => s.expenses);
  const messages = useCoachStore((s) => s.messages);
  const busy = useCoachStore((s) => s.busy);
  const status = useCoachStore((s) => s.status);
  const append = useCoachStore((s) => s.append);
  const patch = useCoachStore((s) => s.patch);
  const setBusy = useCoachStore((s) => s.setBusy);
  const setStatus = useCoachStore((s) => s.setStatus);
  const pendingAsk = useCoachStore((s) => s.pendingAsk);
  const setPendingAsk = useCoachStore((s) => s.setPendingAsk);
  const startNewChat = useCoachStore((s) => s.startNewChat);
  const setToast = useUiStore((s) => s.setToast);
  const isProcessing = useUiStore((s) => s.isProcessing);
  const modelInRam = useUiStore((s) => s.modelInRam);
  const modelId = useSettingsStore((s) => s.modelId);
  const customModelUrl = useSettingsStore((s) => s.customModelUrl);
  const customTokenizerUrl = useSettingsStore((s) => s.customTokenizerUrl);
  const customTokenizerConfigUrl = useSettingsStore((s) => s.customTokenizerConfigUrl);
  const setModelId = useSettingsStore((s) => s.setModelId);
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const [picking, setPicking] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchLabel, setSwitchLabel] = useState('');
  const [dialog, setDialog] = useState<'leave' | 'new' | null>(null);
  const [leaving, setLeaving] = useState(false);

  const catalog = getCatalogModel(modelId);
  const summary = summarizeMonth(items, salary, expenses);
  const plan = buildSpendPlan(items, salary, expenses);
  const lastUser = lastUserQuestion(messages);
  const prompts = nextCoachPrompts(lastUser, plan);
  const blocked = busy || isProcessing || switching || leaving;
  const canSend = !blocked && draft.trim().length > 0;
  const lastMessage = messages.length ? messages[messages.length - 1] : null;
  const streaming = busy && lastMessage?.role === 'assistant' && lastMessage.text.length > 0;
  const composerPad = keyboard > 0 ? spacing.sm : bottomSafeInset(insets.bottom) + spacing.sm;

  useEffect(() => {
    released.current = false;
    useUiStore.getState().setModelInRam(getModelRamState().loaded);
    void loadCoachSession(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        useUiStore.getState().setModelInRam(getModelRamState().loaded);
      });
    return () => {
      if (released.current) {
        return;
      }
      interruptCoach();
      void unloadCoachSession().finally(() => {
        useUiStore.getState().setModelInRam(getModelRamState().loaded);
      });
    };
  }, []);

  useEffect(() => {
    const stop = navigation.addListener('beforeRemove', (event) => {
      if (released.current) {
        return;
      }
      event.preventDefault();
      leaveAction.current = event.data.action;
      setDialog('leave');
    });
    return stop;
  }, [navigation]);

  useEffect(() => {
    if (!pendingAsk || busy || isProcessing || switching || leaving) {
      return;
    }
    const question = pendingAsk;
    setPendingAsk(null);
    void send(question);
  }, [pendingAsk, busy, isProcessing, switching, leaving]);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length, lastMessage?.text, busy]);

  function closeDialog() {
    setDialog(null);
  }

  async function confirmLeave() {
    if (released.current) {
      return;
    }
    released.current = true;
    setDialog(null);
    setLeaving(true);
    interruptCoach();
    startNewChat();
    setDraft('');
    try {
      await unloadCoachSession();
    } catch {
      // Still leave so a stuck unload cannot keep this session open.
    }
    useUiStore.getState().setModelInRam(getModelRamState().loaded);
    const action = leaveAction.current;
    leaveAction.current = null;
    if (action) {
      navigation.dispatch(action);
      return;
    }
    navigation.goBack();
  }

  function confirmNewChat() {
    setDialog(null);
    interruptCoach();
    startNewChat();
    setDraft('');
    setToast({ kind: 'info', message: 'New chat. Earlier messages stay off this thread.' });
  }

  function openPicker() {
    setPicking(true);
  }

  async function chooseModel(id: ModelId) {
    if (busy || isProcessing || switching) {
      setToast({ kind: 'info', message: 'Wait for the current reply to finish before switching models.' });
      return;
    }
    if (id === modelId) {
      setPicking(false);
      return;
    }
    const onDisk = hasCachedSources(
      resolveModelSources({
        modelId: id,
        customModelUrl,
        customTokenizerUrl,
        customTokenizerConfigUrl,
      }),
    );
    if (!onDisk) {
      setModelId(id);
      setPicking(false);
      setToast({
        kind: 'info',
        message: `${getCatalogModel(id).label} is not on this phone. Download it in Settings, then it loads here.`,
      });
      return;
    }
    setPicking(false);
    setSwitching(true);
    setSwitchLabel('Unloading the previous model…');
    setModelId(id);
    try {
      await switchOnDeviceModel((_progress, label) => {
        setSwitchLabel(label);
      });
      useUiStore.getState().setModelInRam(getModelRamState().loaded);
      setToast({
        kind: 'success',
        message: `${getCatalogModel(id).label} is loaded on this phone.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not switch models.';
      setToast({
        kind: 'error',
        message: message === 'unavailable' ? 'Needs the Android development build.' : message,
      });
    } finally {
      setSwitching(false);
      setSwitchLabel('');
      useUiStore.getState().setModelInRam(getModelRamState().loaded);
    }
  }

  async function send(text: string) {
    const question = text.trim();
    if (!question || useCoachStore.getState().busy) {
      return;
    }
    if (isProcessing) {
      setToast({ kind: 'info', message: 'Wait for Refresh to finish, then ask again.' });
      return;
    }
    if (switching) {
      setToast({ kind: 'info', message: 'Wait for the model switch to finish.' });
      return;
    }

    const epoch = useCoachStore.getState().epoch;
    append('user', question);
    setDraft('');
    setBusy(true);
    setStatus('Looking at your plans…');

    const openLife = coachOpenLife(life, lifeStates);
    const snapshot = coachSnapshot({
      plan,
      categories: summary.categories,
      transactions: items,
      expenses,
      subscriptions,
      events: relevantEvents(events, lifeStates),
      life: openLife,
    });
    const prior = useCoachStore.getState().messages.slice(0, -1);
    const fallback = fallbackCoachReply(plan, question, openLife);
    let assistantId: string | null = null;

    try {
      if (useCoachStore.getState().epoch !== epoch) {
        return;
      }
      const availability = await getModelAvailability();
      const ready = availability.status === 'available';
      const reply = ready
        ? await askCoach(
            question,
            snapshot,
            (_progress, label) => {
              if (useCoachStore.getState().epoch === epoch) {
                setStatus(label);
              }
            },
            prior,
            (streamed) => {
              if (useCoachStore.getState().epoch !== epoch) {
                return;
              }
              if (!assistantId) {
                assistantId = useCoachStore.getState().append('assistant', streamed).id;
                setStatus('');
                return;
              }
              patch(assistantId, streamed);
            },
          )
        : '';
      if (useCoachStore.getState().epoch !== epoch) {
        return;
      }
      const shown = coachDisplayedReply(reply, fallback, ready, availability.reason);
      if (!assistantId) {
        append('assistant', shown);
      } else if (!reply.trim()) {
        patch(assistantId, shown);
      } else {
        patch(assistantId, shown);
      }
    } catch (error) {
      if (useCoachStore.getState().epoch !== epoch) {
        return;
      }
      const reason = error instanceof Error ? error.message : 'Could not run the on-device model.';
      const text = coachDisplayedReply('', fallback, false, reason);
      if (!assistantId) {
        append('assistant', text);
      } else {
        patch(assistantId, text);
      }
    } finally {
      if (useCoachStore.getState().epoch === epoch) {
        setBusy(false);
        setStatus('');
      }
      useUiStore.getState().setModelInRam(getModelRamState().loaded);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.bar}>
        <ScreenBack accessibilityLabel="Go back" />
        <Pressable
          accessibilityHint="Opens models on this phone or marks one to download in Settings"
          accessibilityLabel={`${catalog.label}. ${modelInRam ? 'Loaded in RAM' : 'Not loaded'}. Tap to switch`}
          accessibilityRole="button"
          disabled={switching}
          onPress={openPicker}
          style={styles.titleCopy}>
          <View style={styles.titleRow}>
            <View style={[styles.live, modelInRam ? styles.liveOn : styles.liveOff]} />
            <AppText numberOfLines={1} variant="h3">
              {catalog.label}
            </AppText>
          </View>
          <AppText style={modelInRam ? styles.modelOn : styles.modelOff} variant="caption">
            {switching
              ? switchLabel || 'Unloading the previous model…'
              : modelInRam
                ? 'Loaded · tap to switch'
                : 'Not in RAM · tap to switch'}
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start a new chat"
          disabled={leaving}
          onPress={() => {
            setDialog('new');
          }}
          style={styles.newChat}>
          <Ionicons color={colors.neutral[0]} name="add" size={22} />
        </Pressable>
      </View>

      <AppBottomSheet
        accessibilityLabel="Close on-device models"
        onClose={() => {
          setPicking(false);
        }}
        title="On this phone"
        visible={picking}>
        <AppText variant="bodyRegular">
          Models already on this phone load immediately. Others stay selected until you download them in Settings. No internet is required to switch a saved model.
        </AppText>
        {CATALOG.filter((item) => item.id !== 'custom').map((item) => {
            const active = item.id === modelId;
            const onDisk = hasCachedSources(
              resolveModelSources({
                modelId: item.id,
                customModelUrl,
                customTokenizerUrl,
                customTokenizerConfigUrl,
              }),
            );
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active, disabled: switching }}
                disabled={switching}
                key={item.id}
                onPress={() => {
                  void chooseModel(item.id);
                }}
                style={[styles.modelRow, active ? styles.modelRowOn : undefined]}>
                <View style={styles.modelCopy}>
                  <AppText variant="labelRegular">{item.label}</AppText>
                  <AppText variant="caption">
                    {onDisk ? `On this phone · ${item.sizeHint}` : `Not downloaded · ${item.sizeHint}`}
                  </AppText>
                </View>
                {active ? (
                  <View style={[styles.live, modelInRam && onDisk ? styles.liveOn : styles.liveOff]} />
                ) : onDisk ? (
                  <Ionicons color={colors.primary[600]} name="phone-portrait-outline" size={18} />
                ) : (
                  <Ionicons color={colors.neutral[400]} name="cloud-download-outline" size={18} />
                )}
              </Pressable>
            );
          })}
      </AppBottomSheet>

      <View style={[styles.flex, { paddingBottom: keyboard }]}>
        <FlatList
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <AppText variant="h4">Ask about your day, plans, and money</AppText>
              <AppText style={styles.empty} variant="bodyRegular">
                Your assistant reads tasks, travel, deliveries, bills, screenshots, and spends from this
                phone. Replies stream as they are written. Pin a reply to keep a short summary on Home.
              </AppText>
            </View>
          }
          ListFooterComponent={!streaming && (busy || switching) ? <CoachTyping label={switchLabel || status} /> : null}
          contentContainerStyle={styles.thread}
          data={messages}
          extraData={`${messages.length}:${lastMessage?.text ?? ''}:${busy}:${switching}`}
          keyExtractor={keyExtractor}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
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

        <View style={[styles.composer, focused ? styles.composerOn : undefined, { marginBottom: composerPad }]}>
          <TextInput
            accessibilityLabel="Ask the assistant"
            editable={!switching && !isProcessing}
            multiline
            onBlur={() => {
              setFocused(false);
            }}
            onChangeText={setDraft}
            onFocus={() => {
              setFocused(true);
            }}
            placeholder={busy ? 'Writing…' : 'Message'}
            placeholderTextColor={colors.neutral[500]}
            style={styles.input}
            value={draft}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={busy ? 'Stop writing' : 'Send message'}
            disabled={!busy && !canSend}
            onPress={() => {
              if (busy) {
                interruptCoach();
                return;
              }
              void send(draft);
            }}
            style={[styles.send, busy ? styles.sendStop : canSend ? styles.sendOn : styles.sendOff]}>
            {busy ? (
              <Ionicons color={colors.neutral[0]} name="stop" size={16} />
            ) : switching ? (
              <ActivityIndicator color={colors.neutral[0]} size="small" />
            ) : (
              <Ionicons color={colors.neutral[0]} name="arrow-up" size={18} />
            )}
          </Pressable>
        </View>
      </View>
      <AppDialog
        visible={dialog === 'leave'}
        title="Leave chat?"
        message="This ends the session. The model leaves RAM, this thread is cleared, and the next time you open chat it starts fresh. Only one chat and one model can be in memory."
        onClose={closeDialog}
        actions={[
          {
            label: 'Stay',
            tone: 'secondary',
            onPress: () => {
              leaveAction.current = null;
            },
          },
          { label: 'Leave', tone: 'primary', onPress: () => void confirmLeave() },
        ]}
      />
      <AppDialog
        visible={dialog === 'new'}
        title="Start a new chat?"
        message="This clears the current thread. The model stays in RAM until you leave chat."
        onClose={closeDialog}
        actions={[
          { label: 'Cancel', tone: 'secondary', onPress: () => undefined },
          { label: 'Start new chat', tone: 'primary', onPress: confirmNewChat },
        ]}
      />
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
    gap: 2,
    minWidth: 0,
    minHeight: layout.touchTarget,
    justifyContent: 'center',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minWidth: 0,
  },
  live: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  liveOn: {
    backgroundColor: colors.semantic.success,
  },
  liveOff: {
    backgroundColor: colors.semantic.danger,
  },
  modelOn: {
    color: colors.semantic.successDark,
  },
  modelOff: {
    color: colors.semantic.dangerDark,
  },
  newChat: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
    experimental_backgroundImage: gradients.action,
    alignItems: 'center',
    justifyContent: 'center',
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
    maxWidth: '78%',
    backgroundColor: colors.primary[500],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  botWrap: {
    alignSelf: 'flex-start',
    maxWidth: '86%',
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  userText: {
    color: colors.neutral[0],
  },
  botText: {
    color: colors.neutral[900],
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaGrow: {
    flex: 1,
  },
  userTime: {
    color: colors.primary[100],
    textAlign: 'right',
  },
  botTime: {
    flex: 1,
    color: colors.neutral[500],
  },
  pinBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  chip: {
    minHeight: 40,
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
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    paddingVertical: spacing.xs,
    minHeight: 52,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: borderRadius.xl,
    backgroundColor: colors.neutral[0],
  },
  composerOn: {
    borderColor: colors.primary[500],
    borderWidth: 2,
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    color: colors.neutral[900],
    fontSize: 16,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
  },
  send: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendOn: {
    backgroundColor: colors.primary[500],
    experimental_backgroundImage: gradients.action,
  },
  sendStop: {
    backgroundColor: colors.neutral[900],
  },
  sendOff: {
    backgroundColor: colors.neutral[400],
  },
  modelRow: {
    minHeight: 48,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modelRowOn: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[50],
  },
  modelCopy: {
    flex: 1,
    gap: spacing.xs,
  },
});
