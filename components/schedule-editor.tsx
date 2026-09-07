import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
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
      setToast({ kind: 'error', message: 'Use 24-hour times like 06:00' });
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
        <View key={`window-${index}`} style={styles.row}>
          <TextInput
            accessibilityLabel={`Window ${index + 1} start`}
            onChangeText={(value) => {
              update(index, 'start', value);
            }}
            placeholder="06:00"
            placeholderTextColor={colors.neutral[500]}
            style={styles.input}
            value={item.start}
          />
          <AppText variant="bodySmall">to</AppText>
          <TextInput
            accessibilityLabel={`Window ${index + 1} end`}
            onChangeText={(value) => {
              update(index, 'end', value);
            }}
            placeholder="09:00"
            placeholderTextColor={colors.neutral[500]}
            style={styles.input}
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[0],
    paddingHorizontal: spacing.md,
    color: colors.neutral[900],
    fontSize: 14,
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
