import { KeyboardScreen } from '@/components/keyboard-screen';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/app-text';
import { persistParsedBatch } from '@/services/database';
import { useLifeStore } from '@/store/life-store';
import { useSubscriptionStore } from '@/store/subscription-store';
import { useUiStore } from '@/store/ui-store';
import { toLedgerItem, type LedgerItem } from '@/types/ledger';
import { localDay, parseLocalDate } from '@/utils/message-date';
import { formatLedgerWhen } from '@/utils/format-when';
import { colors, spacing, borderRadius } from '@/styles';

// Optional structured entry for plans that have no notification or screenshot.
export function MessageCapture({ visible, onClose, initialMode = 'task', initialTitle = '' }: { visible: boolean; onClose: () => void; initialMode?: 'task' | 'renewal'; initialTitle?: string }) {
  const [mode, setMode] = useState(initialMode);
  const [title, setTitle] = useState(initialTitle);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [preview, setPreview] = useState<LedgerItem | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const reset = () => { setPreview(null); setError(''); };
  function close() { if (busy) return; setTitle(''); setDate(''); setAmount(''); reset(); onClose(); }
  function prepare() {
    reset();
    if (!title.trim()) { setError('Enter a title first.'); return; }
    if (date && (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(date) || !Number.isFinite(parseLocalDate(date).getTime()) || localDay(parseLocalDate(date)) !== date.slice(0, 10))) { setError('Use a valid YYYY-MM-DD or YYYY-MM-DDTHH:mm date.'); return; }
    if (mode === 'renewal' && amount && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)) { setError('Enter a valid amount or leave it blank.'); return; }
    const id = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setPreview(toLedgerItem({ type: mode === 'renewal' ? 'subscription' : 'action', merchant: title.trim(), amount: mode === 'renewal' && amount ? Number(amount) : null, date: date || null, category: mode === 'renewal' ? 'bills' : 'action', note: 'Added by you', sourceId: id, receivedAt: Date.now() }, id));
  }
  async function save() {
    if (busy || !preview) return;
    setBusy(true); setError('');
    try {
      await persistParsedBatch({ items: [preview], processed: [] });
      useLifeStore.getState().addMany([preview]); useSubscriptionStore.getState().addMany([preview]);
      useUiStore.getState().setToast({ kind: 'success', message: 'Your plan is saved.' });
      setTitle(''); setDate(''); setAmount(''); reset(); onClose();
    } catch { setError('Could not save. Your input is still here; try again.'); }
    finally { setBusy(false); }
  }
  return <Modal visible={visible} animationType="slide" onRequestClose={close}>
    <SafeAreaView style={styles.safe}><KeyboardScreen><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      <View style={styles.row}><AppText variant="h3">Add a plan</AppText><Pressable accessibilityRole="button" onPress={close} disabled={busy} style={styles.button}><AppText>Close</AppText></Pressable></View>
      <View style={styles.row}>{(['task', 'renewal'] as const).map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: mode === value }} disabled={busy} onPress={() => { setMode(value); reset(); }} style={[styles.button, mode === value && styles.selected]}><AppText>{value === 'task' ? 'Task' : 'Renewal'}</AppText></Pressable>)}</View>
      <AppText variant="labelRegular">{mode === 'renewal' ? 'Subscription name' : 'Task title'}</AppText>
      <TextInput accessibilityLabel={mode === 'renewal' ? 'Subscription name' : 'Task title'} editable={!busy} placeholder={mode === 'renewal' ? 'Netflix, SonyLIV, Sun NXT…' : 'Submit college form'} placeholderTextColor={colors.neutral[600]} value={title} onChangeText={(value) => { setTitle(value); reset(); }} style={styles.input} />
      <AppText variant="labelRegular">{mode === 'renewal' ? 'Next renewal date (optional)' : 'Due date / time (optional)'}</AppText>
      <TextInput accessibilityLabel="Due date and time" editable={!busy} autoCapitalize="none" placeholder="YYYY-MM-DD" placeholderTextColor={colors.neutral[600]} value={date} onChangeText={(value) => { setDate(value); reset(); }} style={styles.input} />
      {mode === 'renewal' ? <><AppText variant="labelRegular">Renewal amount (optional)</AppText><TextInput accessibilityLabel="Renewal amount" editable={!busy} keyboardType="decimal-pad" placeholder="Amount in rupees" placeholderTextColor={colors.neutral[600]} value={amount} onChangeText={(value) => { setAmount(value); reset(); }} style={styles.input} /></> : null}
      <Pressable accessibilityRole="button" disabled={busy} onPress={prepare} style={styles.button}><AppText>Review plan</AppText></Pressable>
      {preview ? <View style={styles.preview}><AppText variant="h4">{preview.merchant}</AppText><AppText>{formatLedgerWhen(preview.date)}</AppText><Pressable accessibilityRole="button" disabled={busy} onPress={() => void save()} style={[styles.button, styles.selected]}><AppText>{busy ? 'Saving…' : 'Save plan'}</AppText></Pressable></View> : null}
      {error ? <AppText accessibilityRole="alert" style={styles.error}>{error}</AppText> : null}
    </ScrollView></KeyboardScreen></SafeAreaView>
  </Modal>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.neutral[50] }, content: { padding: spacing.lg, gap: spacing.md }, row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  input: { borderWidth: 1, borderColor: colors.neutral[400], borderRadius: borderRadius.md, padding: spacing.md, color: colors.neutral[900], backgroundColor: colors.neutral[0], minHeight: 48 }, error: { color: colors.semantic.dangerDark },
  button: { minHeight: 48, justifyContent: 'center', alignItems: 'center', padding: spacing.md, borderRadius: borderRadius.md, backgroundColor: colors.neutral[200] }, selected: { backgroundColor: colors.primary[100] }, preview: { padding: spacing.lg, gap: spacing.sm, backgroundColor: colors.neutral[0], borderRadius: borderRadius.lg },
});
