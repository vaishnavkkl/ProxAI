import Ionicons from '@expo/vector-icons/Ionicons';
import { paintFeedback } from '@/utils/paint-feedback';
import { isModelTimeout } from '@/services/model-deadline';
import { useFocusEffect, useIsFocused, useNavigation } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';
import { LogoLoader as ActivityIndicator } from '@/components/logo-loader';
import { ChatContextUsage, ChatTokenSpeed } from '@/components/chat-metrics';

import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppBottomSheet } from '@/components/app-bottom-sheet';
import { AppDialog } from '@/components/app-dialog';
import { AppText } from '@/components/app-text';
import { CoachTyping } from '@/components/coach-typing';
import { ChatOcrButton } from '@/components/chat-ocr-button';
import { ModelRamCaption } from '@/components/model-ram-caption';
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
import { getCatalogModel, resolveModelSources, type ModelId } from '@/services/model-catalog';
import { chatModelsForOcr, ensureChatModelForOcr } from '@/services/ocr-chat-model';
import { hasCachedSources } from '@/services/model-storage';
import { useBudgetStore } from '@/store/budget-store';
import { useCoachStore, type CoachBubble } from '@/store/coach-store';
import { useEventStore } from '@/store/event-store';
import { useLifeStore } from '@/store/life-store';
import { useSettingsStore } from '@/store/settings-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import { useTransactionStore } from '@/store/transaction-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, gradients, layout, spacing } from '@/styles';
import { formatCoachTime } from '@/utils/coach-pin';
import { chatSuggestions, latestSuggestionContext } from '@/utils/chat-suggestions';
import { toInrText } from '@/utils/format-inr';
import { summarizeMonth } from '@/utils/month-finance';
import { relevantEvents } from '@/utils/relevant-events';
import { bottomSafeInset } from '@/utils/safe-area';
import { buildSpendPlan, coachDisplayedReply, coachOpenLife, coachSnapshot, fallbackCoachReply } from '@/utils/spend-coach';

function keyExtractor(item: CoachBubble) {
  return item.id;
}

const CoachBubbleRow = memo(function CoachBubbleRow({ item }: { item: CoachBubble }) {
  const pinned = useCoachStore((s) => s.pins.some((pin) => pin.messageId === item.id));
  const togglePin = useCoachStore((s) => s.togglePin);
  const setToast = useUiStore((s) => s.setToast);
  const user = item.role === 'user';
  const when = formatCoachTime(item.at);

  return (
    <View style={user ? styles.userWrap : styles.botWrap}>
      <AppText selectable={!item.pending} style={user ? styles.userText : styles.botText} variant="bodyRegular">
        {user ? item.text : toInrText(item.text)}
      </AppText>
      {item.pending ? null : user ? (
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
});

function renderBubble({ item }: { item: CoachBubble }) {
  return <CoachBubbleRow item={item} />;
}


const CoachThread = memo(function CoachThread({ switching, switchLabel }: { switching: boolean; switchLabel: string }) {
  const listRef = useRef<FlatList<CoachBubble>>(null);
  const followEnd = useRef(true);
  const messages = useCoachStore((s) => s.messages);
  const busy = useCoachStore((s) => s.busy);
  const status = useCoachStore((s) => s.status);
  const lastMessage = messages[messages.length - 1];
  const streaming = busy && lastMessage?.role === 'assistant' && lastMessage.text.length > 0;
  useEffect(() => {
    followEnd.current = true;
  }, [messages.length]);
  return (
        <FlatList
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <AppText variant="h4">Ask about your day and plans</AppText>
              <AppText style={styles.empty} variant="bodyRegular">
                Your assistant reads tasks, travel, deliveries, and reminders from this phone. Money stays
                in Finance. Replies stream as they are written. Pin a reply to keep a short summary on Home.
              </AppText>
            </View>
          }
          ListFooterComponent={!streaming && (busy || switching) ? <CoachTyping label={switching ? switchLabel : status} /> : null}
          contentContainerStyle={styles.thread}
          data={messages}
          keyExtractor={keyExtractor}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onContentSizeChange={() => {
            if (followEnd.current) listRef.current?.scrollToEnd({ animated: false });
          }}
          onLayout={() => {
            if (followEnd.current) listRef.current?.scrollToEnd({ animated: false });
          }}
          onScroll={({ nativeEvent: { contentOffset, contentSize, layoutMeasurement } }) => {
            followEnd.current = contentSize.height - layoutMeasurement.height - contentOffset.y < 100;
          }}
          scrollEventThrottle={100}
          initialNumToRender={12}
          maxToRenderPerBatch={6}
          windowSize={7}
          ref={listRef}
          renderItem={renderBubble}
          style={styles.flex}
        />
  );
});

export function Coach({ tab = false }: { tab?: boolean }) {
  const isFocused = useIsFocused();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const released = useRef(false);
  const replyStopped = useRef(false);
  const leaveAction = useRef<{ type: string } | null>(null);
  const items = useTransactionStore((s) => s.financeItems);
  const events = useEventStore((s) => s.items);
  const life = useLifeStore((s) => s.items);
  const lifeStates = useLifeStore((s) => s.states);
  const subscriptions = useSubscriptionStore((s) => s.items);
  const salary = useBudgetStore((s) => s.salary);
  const expenses = useBudgetStore((s) => s.expenses);
  const suggestionContext = useCoachStore((s) => latestSuggestionContext(s.messages));
  const busy = useCoachStore((s) => s.busy);
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
  const ocrLanguage = useSettingsStore((s) => s.ocrLanguage);
  const chatModels = chatModelsForOcr(ocrLanguage);
  const customModelUrl = useSettingsStore((s) => s.customModelUrl);
  const customTokenizerUrl = useSettingsStore((s) => s.customTokenizerUrl);
  const customTokenizerConfigUrl = useSettingsStore((s) => s.customTokenizerConfigUrl);
  const setModelId = useSettingsStore((s) => s.setModelId);
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const [picking, setPicking] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [switchLabel, setSwitchLabel] = useState('');
  const [loadingModel, setLoadingModel] = useState(true);
  const [loadLabel, setLoadLabel] = useState('Loading model…');
  const [loadError, setLoadError] = useState('');
  const [dialog, setDialog] = useState<'leave' | 'new' | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [stopping, setStopping] = useState(false);

  const catalog = getCatalogModel(modelId);
  const summary = useMemo(() => summarizeMonth(items, salary, expenses), [items, salary, expenses]);
  const plan = useMemo(() => buildSpendPlan(items, salary, expenses), [items, salary, expenses]);
  const prompts = useMemo(() => chatSuggestions(suggestionContext), [suggestionContext]);
  const blocked = !isFocused || busy || isProcessing || switching || leaving || loadingModel || !!loadError;
  const canSend = !blocked && draft.trim().length > 0;
  const composerPad = keyboard > 0 || tab ? spacing.sm : bottomSafeInset(insets.bottom) + spacing.sm;

  useFocusEffect(useCallback(() => {
    setLoadingModel(true);
    setLoadError('');
    let active = true;
    let acquired = false;
    released.current = false;
    ensureChatModelForOcr();
    useUiStore.getState().setModelInRam(getModelRamState().loaded);
    // Acquire immediately, before pending OCR asks or manual sends can run.
    void paintFeedback().then(() => {
      if (!active) return;
      acquired = true;
      return loadCoachSession((_progress, label) => {
      if (active && !released.current) setLoadLabel(label);
      });
    })
    .then(async () => {
      if (!active) return;
      if (!getModelRamState().loaded) {
        const availability = await getModelAvailability();
        throw new Error(availability.reason || 'Could not load the selected model.');
      }
    })
    .catch((error: unknown) => {
      if (active && !released.current) {
        setLoadError(error instanceof Error ? error.message : 'Could not load the selected model.');
      }
    })
    .finally(() => {
      useUiStore.getState().setModelInRam(getModelRamState().loaded);
      if (active && !released.current) setLoadingModel(false);
    });
    return () => {
      active = false;
      setLoadingModel(true);
      if (released.current || !acquired) {
        return;
      }
      interruptCoach();
      void unloadCoachSession().catch(() => undefined).finally(() => {
        useUiStore.getState().setModelInRam(getModelRamState().loaded);
      });
    };
  }, []));

  useEffect(() => {
    if (tab) return;
    const stop = navigation.addListener('beforeRemove', (event) => {
      if (released.current) {
        return;
      }
      event.preventDefault();
      leaveAction.current = event.data.action;
      setDialog('leave');
    });
    return stop;
  }, [navigation, tab]);

  useEffect(() => {
    if (!pendingAsk || blocked) {
      return;
    }
    const question = pendingAsk;
    setPendingAsk(null);
    void send(question);
  }, [pendingAsk, blocked]);


  function closeDialog() {
    setDialog(null);
  }

  function confirmLeave() {
    if (released.current) {
      return;
    }
    released.current = true;
    setDialog(null);
    setLeaving(true);
    interruptCoach();
    startNewChat();
    setDraft('');
    // Release the session through the inference queue without blocking navigation.
    void unloadCoachSession().catch(() => undefined).finally(() => {
      useUiStore.getState().setModelInRam(getModelRamState().loaded);
    });
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
    if (busy || isProcessing || switching || loadingModel || leaving) {
      setToast({ kind: 'info', message: 'Wait for the current reply to finish before switching models.' });
      return;
    }
    if (id === modelId && modelInRam && !loadError) {
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
      setLoadError(`${getCatalogModel(id).label} is not on this phone. Download it in Settings first.`);
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
      await paintFeedback();
      await switchOnDeviceModel((_progress, label) => {
        setSwitchLabel(label);
      });
      setLoadError('');
      useUiStore.getState().setModelInRam(getModelRamState().loaded);
      setToast({
        kind: 'success',
        message: `${getCatalogModel(id).label} is loaded on this phone.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not switch models.';
      setLoadError(message === 'unavailable' ? 'Needs the Android development build.' : message);
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
    if (!question || useCoachStore.getState().busy || loadingModel || loadError || leaving) {
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
    replyStopped.current = false;
    setStopping(false);
    const userId = append('user', question, true).id;
    setDraft('');
    setBusy(true);
    setStatus(getModelRamState().loaded ? 'Preparing response…' : `Loading ${catalog.label}…`);

    // Let the pending bubble/loading indicator render before reading context.
    await paintFeedback();
    if (useCoachStore.getState().epoch !== epoch) return;

    const openLife = coachOpenLife(life, lifeStates);
    const snapshot = coachSnapshot({
      plan,
      categories: summary.categories,
      transactions: items,
      expenses,
      subscriptions,
      events: relevantEvents(events, lifeStates),
      life: openLife,
    }, question);
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
                assistantId = useCoachStore.getState().append('assistant', streamed, true).id;
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
      const shown = replyStopped.current && !reply.trim()
        ? 'Response stopped.'
        : coachDisplayedReply(reply, fallback, ready, availability.reason);
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
      const text = isModelTimeout(error) ? reason : replyStopped.current ? 'Response stopped.' : coachDisplayedReply('', fallback, false, reason);
      if (!assistantId) {
        append('assistant', text);
      } else {
        patch(assistantId, text);
      }
    } finally {
      if (useCoachStore.getState().epoch === epoch) {
        useCoachStore.getState().finish(userId);
        if (assistantId) useCoachStore.getState().finish(assistantId);
        setStopping(false);
        setBusy(false);
        setStatus('');
      }
      useUiStore.getState().setModelInRam(getModelRamState().loaded);
    }
  }

  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.bar}>
        {!tab && <ScreenBack accessibilityLabel="Go back" />}
        <Pressable
          accessibilityHint="Opens models on this phone or marks one to download in Settings"
          accessibilityLabel={`${catalog.label}. ${modelInRam ? 'Loaded in RAM' : 'Not loaded'}. Tap to switch`}
          accessibilityRole="button"
          disabled={switching || loadingModel || leaving}
          onPress={openPicker}
          style={styles.titleCopy}>
          <View style={styles.titleRow}>
            <View style={[styles.live, modelInRam ? styles.liveOn : styles.liveOff]} />
            <AppText numberOfLines={1} variant="h3">
              {catalog.label}
            </AppText>
          </View>
          {catalog.malayalam ? (
            <AppText style={styles.modelOff} variant="caption">
              Malayalam supported
            </AppText>
          ) : null}
          {loadingModel ? (
            <AppText style={styles.loadingLabel} variant="caption">{loadLabel}</AppText>
          ) : switching ? (
            <AppText style={styles.modelOff} variant="caption">
              {switchLabel || 'Unloading the previous model…'}
            </AppText>
          ) : (
            <ModelRamCaption loadBytes={catalog.modelBytes} loaded={modelInRam} paused={busy || switching} />
          )}
        </Pressable>
        <ChatTokenSpeed />
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

      {picking ? <AppBottomSheet
        accessibilityLabel="Close on-device models"
        onClose={() => {
          setPicking(false);
        }}
        title="On this phone"
        visible={picking}>
        <AppText variant="bodyRegular">
          {ocrLanguage === 'ml'
            ? 'Malayalam OCR is on, so only Malayalam models are listed for chat. Others stay in Settings after you switch image text back to English.'
            : 'Models already on this phone load immediately. Others stay selected until you download them in Settings. No internet is required to switch a saved model.'}
        </AppText>
        {chatModels.filter((item) => item.id !== 'custom').map((item) => {
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
                  {item.malayalam ? (
                    <AppText variant="caption">Malayalam supported</AppText>
                  ) : null}
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
      </AppBottomSheet> : null}

      <View style={[styles.flex, { paddingBottom: keyboard }]}>
        <CoachThread switching={switching || loadingModel} switchLabel={loadingModel ? loadLabel : switchLabel} />

        {loadError && !switching ? (
          <View style={styles.loadError}>
            <AppText accessibilityRole="alert" style={styles.modelOff} variant="bodySmall">{loadError}</AppText>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Retry loading model"
              disabled={busy || isProcessing || loadingModel || leaving}
              onPress={() => void chooseModel(modelId)}
              style={styles.chip}>
              <AppText variant="labelSmall">Retry loading model</AppText>
            </Pressable>
          </View>
        ) : null}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={styles.chipsViewport} contentContainerStyle={styles.chips}>
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
        </ScrollView>

        <ChatContextUsage />
        <View style={[styles.composer, focused ? styles.composerOn : undefined, { marginBottom: composerPad }]}>
          <ChatOcrButton disabled={blocked} onAsk={setPendingAsk} />
          <TextInput
            accessibilityLabel="Ask the assistant"
            editable={!switching && !isProcessing && !leaving}
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
            accessibilityLabel={loadingModel ? 'Loading model' : stopping ? 'Stopping response' : busy ? 'Stop writing' : 'Send message'}
            disabled={stopping || (!busy && !canSend)}
            onPress={() => {
              if (busy) {
                setStopping(true);
                replyStopped.current = true;
                interruptCoach();
                return;
              }
              void send(draft);
            }}
            style={[styles.send, busy ? styles.sendStop : canSend ? styles.sendOn : styles.sendOff]}>
            {stopping ? <ActivityIndicator color={colors.neutral[0]} size="small" /> : busy ? (
              <Ionicons color={colors.neutral[0]} name="stop" size={16} />
            ) : switching || loadingModel ? (
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
  loadingLabel: {
    color: colors.primary[600],
  },
  loadError: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
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
  chipsViewport: {
    flexGrow: 0,
    flexShrink: 0,
  },
  chips: {
    flexDirection: 'row',
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
