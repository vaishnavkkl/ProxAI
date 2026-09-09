import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { DateTimeField } from '@/components/date-time-field';
import { useLifeStore } from '@/store/life-store';
import type { LedgerItem } from '@/types/ledger';
import { localDay, parseLocalDate } from '@/utils/message-date';
import { colors, spacing, borderRadius } from '@/styles';

export function ItemActions({ item }: { item: LedgerItem }) {
  const update = useLifeStore((s) => s.update);
  const status = useLifeStore((s) => s.states[item.id]?.status ?? 'open');
  const [title, setTitle] = useState(item.merchant ?? '');
  const [date, setDate] = useState(item.date && item.date.length > 10 ? (() => { const parsed = parseLocalDate(item.date!); return `${localDay(parsed)}T${String(parsed.getHours()).padStart(2, '0')}:${String(parsed.getMinutes()).padStart(2, '0')}`; })() : item.date ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function run(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setMessage('');
    try { await work(); } catch { setMessage('Could not complete this action. Please try again.'); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!title.trim()) { setMessage('Enter a title.'); return; }
    if (date && (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/.test(date) || !Number.isFinite(parseLocalDate(date).getTime()) || localDay(parseLocalDate(date)) !== date.slice(0, 10))) { setMessage('Enter a valid YYYY-MM-DD or YYYY-MM-DDTHH:mm date.'); return; }
    await run(async () => { await update(item.id, { title: title.trim(), date: date || null }); setMessage('Changes saved.'); });
  }
  async function reminder() {
    if (!item.date) { setMessage('Save a date first to create a reminder.'); return; }
    if (process.env.EXPO_OS === 'web') { setMessage('Calendar reminders are available in the Android or iOS app.'); return; }
    await run(async () => {
      const Calendar = await import('expo-calendar');
      const start = parseLocalDate(item.date!);
      const end = new Date(start);
      if (item.date!.length === 10) end.setDate(start.getDate() + 1);
      else end.setMinutes(start.getMinutes() + 30);
      const result = await Calendar.createEventInCalendarAsync({ title: item.merchant ?? 'ProxAI reminder', startDate: start, endDate: end, allDay: item.date!.length === 10, notes: item.review || item.note, alarms: [{ relativeOffset: -15 }] });
      setMessage(result.action === 'saved' ? 'Reminder saved in your calendar.' : 'Calendar editor closed. Check your calendar to confirm the reminder was saved.');
    });
  }
  if (item.type === 'transaction') return null;
  return <View style={styles.section}>
    {item.type === 'security' ? <AppText variant="bodyRegular">This is a possible risk based on message patterns, not a verified scam. Check the sender through an official app or a number you already trust. Links in this message are shown as text.</AppText> : null}
    <AppText variant="labelRegular">Correct this item</AppText>
    <TextInput accessibilityLabel="Item title" value={title} onChangeText={setTitle} style={styles.input} />
    {item.type !== 'security' ? (
      <DateTimeField
        accessibilityLabel="Item date and time"
        disabled={busy}
        label="Date / local time · leave blank if unknown"
        mode="datetime"
        onChange={setDate}
        value={date}
      />
    ) : null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void save()} style={styles.button}><AppText>Save changes</AppText></Pressable>
    {item.type !== 'security' ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => void reminder()} style={styles.button}><AppText>Add calendar reminder</AppText></Pressable> : null}
    <Pressable accessibilityRole="button" disabled={busy} onPress={() => void run(async () => { await update(item.id, { status: status === 'open' ? (item.type === 'security' ? 'dismissed' : 'done') : 'open' }); setMessage(status === 'open' ? 'Moved to completed. You can reopen it here.' : 'Reopened.'); })} style={styles.button}><AppText>{status !== 'open' ? 'Reopen item' : item.type === 'security' ? 'Dismiss after review' : 'Mark complete'}</AppText></Pressable>
    {message ? <AppText accessibilityLiveRegion="polite" variant="bodySmall">{message}</AppText> : null}
  </View>;
}
const styles = StyleSheet.create({ section: { gap: spacing.md, paddingBottom: spacing.xl }, input: { padding: spacing.md, minHeight: 48, borderWidth: 1, borderColor: colors.neutral[400], borderRadius: borderRadius.md, color: colors.neutral[900] }, button: { minHeight: 48, padding: spacing.md, backgroundColor: colors.primary[100], borderRadius: borderRadius.md, alignItems: 'center', justifyContent: 'center' } });
