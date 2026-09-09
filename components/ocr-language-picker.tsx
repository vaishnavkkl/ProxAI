import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { useSettingsStore } from '@/store/settings-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, spacing } from '@/styles';

export function OcrLanguagePicker() {
  const language = useSettingsStore((s) => s.ocrLanguage);
  const setLanguage = useSettingsStore((s) => s.setOcrLanguage);
  const busy = useUiStore((s) => s.isProcessing);
  return (
    <View style={styles.container}>
      <AppText variant="labelRegular">Image text language</AppText>
      <View style={styles.options}>
        {([{ id: 'en', label: 'English / Latin' }, { id: 'ml', label: 'മലയാളം + English' }] as const).map((item) => (
          <Pressable key={item.id} accessibilityRole="radio"
            accessibilityState={{ checked: language === item.id, disabled: busy }}
            disabled={busy} onPress={() => setLanguage(item.id)}
            style={[styles.option, language === item.id && styles.selected, busy && styles.disabled]}>
            <AppText variant="bodySmall">{item.label}</AppText>
          </Pressable>
        ))}
      </View>
      <AppText variant="caption">
        {language === 'ml'
          ? 'Reads printed Malayalam and English on this phone. Applies to photos and folder scans. Select a Malayalam model for chat about the text.'
          : 'Fast offline English and Latin text recognition. Choose Malayalam for mixed Malayalam and English images.'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderWidth: 1, borderColor: colors.neutral[200], borderRadius: borderRadius.md },
  selected: { borderColor: colors.primary[500], backgroundColor: colors.primary[50] },
  disabled: { opacity: 0.5 },
});
