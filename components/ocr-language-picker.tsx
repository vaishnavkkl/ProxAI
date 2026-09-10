import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { ensureChatModelForOcr } from '@/services/ocr-chat-model';
import { useSettingsStore } from '@/store/settings-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, gradients, spacing } from '@/styles';

const OPTIONS = [
  { id: 'en' as const, label: 'English', caption: 'Latin text', icon: 'language-outline' as const, glyph: 'Aa' },
  { id: 'ml' as const, label: 'മലയാളം', caption: 'Malayalam + English', icon: 'earth-outline' as const, glyph: 'അ' },
];

export function OcrLanguagePicker() {
  const language = useSettingsStore((s) => s.ocrLanguage);
  const setLanguage = useSettingsStore((s) => s.setOcrLanguage);
  const busy = useUiStore((s) => s.isProcessing);
  return (
    <View style={styles.container}>
      <AppText variant="labelRegular">Image text language</AppText>
      <View style={styles.options}>
        {OPTIONS.map((item) => {
          const on = language === item.id;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: on, disabled: busy }}
              disabled={busy}
              key={item.id}
              onPress={() => {
                setLanguage(item.id);
                if (item.id === 'ml') {
                  ensureChatModelForOcr();
                }
              }}
              style={[styles.option, on ? styles.selected : undefined, busy ? styles.disabled : undefined]}>
              <View style={[styles.iconWrap, on ? styles.iconWrapOn : undefined]}>
                {item.id === 'ml' ? (
                  <AppText style={on ? styles.glyphOn : styles.glyph}>{item.glyph}</AppText>
                ) : (
                  <Ionicons color={on ? colors.primary[600] : colors.neutral[700]} name={item.icon} size={22} />
                )}
              </View>
              <View style={styles.copy}>
                <AppText variant="labelRegular">{item.label}</AppText>
                <AppText style={styles.caption} variant="caption">
                  {item.caption}
                </AppText>
              </View>
            </Pressable>
          );
        })}
      </View>
      <AppText variant="caption">
        {language === 'ml'
          ? 'Reads printed Malayalam and English on this phone. Chat about this text uses a Malayalam model, not an English-only one.'
          : 'Fast offline English and Latin text recognition. Choose Malayalam for mixed Malayalam and English images.'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  options: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  option: {
    flex: 1,
    minHeight: 72,
    padding: spacing.md,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary[100],
    experimental_backgroundImage: gradients.languageCard,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  selected: {
    borderColor: colors.primary[500],
    experimental_backgroundImage: gradients.languageCardOn,
  },
  disabled: {
    opacity: 0.5,
  },
  iconWrap: {
    width: 44,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.neutral[0],
    transform: [{ rotate: '-5deg' }],
  },
  iconWrapOn: {
    backgroundColor: colors.primary[50],
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  caption: {
    color: colors.neutral[600],
  },
  glyph: {
    color: colors.neutral[700],
    fontSize: 18,
    fontWeight: '700',
  },
  glyphOn: {
    color: colors.primary[600],
    fontSize: 18,
    fontWeight: '700',
  },
});
