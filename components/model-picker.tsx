import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { openBrowserAsync, WebBrowserPresentationStyle } from 'expo-web-browser';

import { AppText } from '@/components/app-text';
import {
  CATALOG,
  CUSTOM_URL_HELP,
  MODEL_SOURCE_DOCS,
  MODEL_SOURCE_ORG,
  getCatalogModel,
  isHttpsUrl,
  resolveModelSources,
  type ModelId,
} from '@/services/model-catalog';
import { hasCachedSources } from '@/services/model-storage';
import { useSettingsStore } from '@/store/settings-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, spacing } from '@/styles';

export function ModelPicker() {
  const processing = useUiStore((s) => s.isProcessing);
  const modelId = useSettingsStore((s) => s.modelId);
  const customModelUrl = useSettingsStore((s) => s.customModelUrl);
  const customTokenizerUrl = useSettingsStore((s) => s.customTokenizerUrl);
  const customTokenizerConfigUrl = useSettingsStore((s) => s.customTokenizerConfigUrl);
  const setModelId = useSettingsStore((s) => s.setModelId);
  const setCustomUrls = useSettingsStore((s) => s.setCustomUrls);
  const setToast = useUiStore((s) => s.setToast);

  const [modelUrl, setModelUrl] = useState(customModelUrl);
  const [tokenizerUrl, setTokenizerUrl] = useState(customTokenizerUrl);
  const [configUrl, setConfigUrl] = useState(customTokenizerConfigUrl);

  const selected = getCatalogModel(modelId);

  function selectModel(id: ModelId) {
    if (processing) return;
    setModelId(id);
    setToast({
      kind: 'success',
      message: id === 'custom' ? 'Paste three HTTPS URLs below' : `${getCatalogModel(id).label} selected`,
    });
  }

  function saveCustomUrls() {
    if (processing) return;
    if (!isHttpsUrl(modelUrl) || !isHttpsUrl(tokenizerUrl) || !isHttpsUrl(configUrl)) {
      setToast({ kind: 'error', message: 'Each custom field needs an https:// URL' });
      return;
    }
    setCustomUrls({
      customModelUrl: modelUrl.trim(),
      customTokenizerUrl: tokenizerUrl.trim(),
      customTokenizerConfigUrl: configUrl.trim(),
    });
    setModelId('custom');
    setToast({ kind: 'success', message: 'Custom model URLs saved' });
  }

  return (
    <View style={styles.block}>
      <AppText variant="h4">Language models</AppText>
      <AppText variant="bodySmall">
        These are chat and scan LLMs only. Image generation is a separate diffusion model in Settings.
        {selected.label} · {selected.sizeHint}. Inference stays on this phone. If the files are already
        in Documents/react-native-executorch they are used as-is. Select a model, then tap Download in
        the header.
      </AppText>

      {CATALOG.map((item) => {
        const cached = hasCachedSources(
          resolveModelSources({
            modelId: item.id,
            customModelUrl: item.id === 'custom' ? modelUrl : customModelUrl,
            customTokenizerUrl: item.id === 'custom' ? tokenizerUrl : customTokenizerUrl,
            customTokenizerConfigUrl: item.id === 'custom' ? configUrl : customTokenizerConfigUrl,
          }),
        );
        const active = item.id === modelId;

        return (
          <Pressable
            key={item.id}
            accessibilityRole="button"
            disabled={processing}
            accessibilityState={{ selected: active }}
            onPress={() => {
              selectModel(item.id);
            }}
            style={[styles.card, active ? styles.cardActive : undefined]}>
            <View style={styles.cardTop}>
              <AppText variant="labelRegular">{item.label}</AppText>
              {item.recommended ? <AppText style={styles.badge}>Recommended</AppText> : null}
              {item.compact ? <AppText style={styles.compact}>Fits older phones</AppText> : null}
              {item.warn ? <AppText style={styles.warnBadge}>Large</AppText> : null}
              {cached ? <AppText style={styles.cached}>On device</AppText> : null}
            </View>
            <AppText variant="bodySmall">
              {item.sizeHint} · {item.ramHint}
            </AppText>
            {active ? <AppText variant="caption">{item.note}</AppText> : null}
            {active && item.license ? <AppText variant="caption">{item.license} · no paid inference API</AppText> : null}
            {active && item.warn ? (
              <AppText style={styles.warn} variant="caption">
                Large download. Loading checks available memory; performance is not yet benchmarked.
              </AppText>
            ) : null}
          </Pressable>
        );
      })}

      {modelId === 'custom' ? <View style={styles.block}>
      <AppText variant="labelSmall">Custom .pte URL</AppText>
      <TextInput
        accessibilityLabel="Custom model URL"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setModelUrl}
        placeholder="https://huggingface.co/.../model.pte"
        placeholderTextColor={colors.neutral[500]}
        style={styles.input}
        value={modelUrl}
      />
      <AppText variant="labelSmall">tokenizer.json URL</AppText>
      <TextInput
        accessibilityLabel="Tokenizer URL"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setTokenizerUrl}
        placeholder="https://huggingface.co/.../tokenizer.json"
        placeholderTextColor={colors.neutral[500]}
        style={styles.input}
        value={tokenizerUrl}
      />
      <AppText variant="labelSmall">tokenizer_config.json URL</AppText>
      <TextInput
        accessibilityLabel="Tokenizer config URL"
        autoCapitalize="none"
        autoCorrect={false}
        onChangeText={setConfigUrl}
        placeholder="https://huggingface.co/.../tokenizer_config.json"
        placeholderTextColor={colors.neutral[500]}
        style={styles.input}
        value={configUrl}
      />
      <Pressable
        accessibilityRole="button"
        onPress={saveCustomUrls}
        style={styles.primary}>
        <AppText style={styles.primaryLabel} variant="labelLarge">
          Save custom URLs
        </AppText>
      </Pressable>

      <AppText variant="caption">{CUSTOM_URL_HELP}</AppText>
      </View> : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void openBrowserAsync(MODEL_SOURCE_ORG, {
            presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
          });
        }}>
        <AppText style={styles.link} variant="labelSmall">
          Open Hugging Face source
        </AppText>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          void openBrowserAsync(MODEL_SOURCE_DOCS, {
            presentationStyle: WebBrowserPresentationStyle.AUTOMATIC,
          });
        }}>
        <AppText style={styles.link} variant="labelSmall">
          How resource fetching works
        </AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: spacing.sm,
  },
  card: {
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.xs,
    minHeight: 48,
  },
  cardActive: {
    borderColor: colors.primary[500],
    backgroundColor: colors.primary[100],
  },
  cardTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  badge: {
    color: colors.primary[500],
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  compact: {
    color: colors.semantic.successDark,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  cached: {
    color: colors.semantic.successDark,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  warn: {
    color: colors.semantic.warningDark,
  },
  warnBadge: {
    color: colors.semantic.warningDark,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
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
  link: {
    color: colors.primary[500],
    minHeight: 48,
    textAlignVertical: 'center',
  },
});
