import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';


import { AppText } from '@/components/app-text';
import { DateTimeField } from '@/components/date-time-field';
import { formatWindows, isClockTime, type ScheduleWindow } from '@/services/llm-schedule';
import { useSettingsStore } from '@/store/settings-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, spacing } from '@/styles';

export function ScheduleEditor() {
  const windows = useSettingsStore((s) => s.windows);
  const setWindows = useSettingsStore((s) => s.setWindows);
  const setToast = useUiStore((s) => s.setToast);
  const [draft, setDraft] = useState<ScheduleWindow[]>(windows);

  function update(index: number, key: keyof ScheduleWindow, value: string) {
    setDraft(draft.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)));
  }

  function save() {
    if (draft.some((item) => !isClockTime(item.start) || !isClockTime(item.end))) {
      setToast({ kind: 'error', message: 'Pick a start and end time for each window' });
      return;
    }
    setWindows(draft);
    setToast({ kind: 'success', message: `Schedule saved: ${formatWindows(draft)}` });
  }

  return (
    <View style={styles.block}>
      <AppText variant="h4">Edit schedule</AppText>
      <AppText variant="bodySmall">Background inference uses these windows. Refresh always runs.</AppText>
      {draft.map((item, index) => (
        <View key={`window-${index}`} style={styles.window}>
          <AppText variant="labelRegular">Window {index + 1}</AppText>
          <DateTimeField
            accessibilityLabel={`Window ${index + 1} start`}
            label="Starts"
            mode="time"
            onChange={(value) => {
              update(index, 'start', value);
            }}
            optional={false}
            value={item.start}
          />
          <DateTimeField
            accessibilityLabel={`Window ${index + 1} end`}
            label="Ends"
            mode="time"
            onChange={(value) => {
              update(index, 'end', value);
            }}
            optional={false}
            value={item.end}
          />
        </View>
      ))}
      <Pressable accessibilityRole="button" onPress={save} style={styles.primary}>
        <AppText style={styles.primaryLabel} variant="labelLarge">
          Save schedule
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.sm,
  },
  window: {
    gap: spacing.sm,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[0],
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
});
