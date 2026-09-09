import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { ProgressMeter } from '@/components/progress-meter';
import { ScreenBack } from '@/components/screen-back';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import {
  TTI_STOPPED,
  attachImagine,
  detachImagine,
  downloadTextToImage,
  generateTextToImage,
  hasCachedTextToImage,
  interruptTextToImage,
  isTextToImageAvailable,
  isTextToImageLoaded,
} from '@/services/text-to-image';
import {
  DEFAULT_TTI_VARIANT,
  TTI_MODEL_NAME,
  TTI_PROMPTS,
  getTtiVariant,
} from '@/services/text-to-image-catalog';
import { useSettingsStore } from '@/store/settings-store';
import { useUiStore } from '@/store/ui-store';
import { useModelDownloadStore } from '@/store/model-download-store';
import { borderRadius, colors, gradients, layout, spacing } from '@/styles';
import { formatBytes } from '@/utils/format-bytes';
import { bottomSafeInset } from '@/utils/safe-area';

export function Imagine() {
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const setToast = useUiStore((s) => s.setToast);
  const variant = useSettingsStore((s) => s.ttiVariantId) ?? DEFAULT_TTI_VARIANT;
  const isProcessing = useUiStore((s) => s.isProcessing);
  const downloadKind = useModelDownloadStore((s) => s.kind);
  const imageInRam = useUiStore((s) => s.imageInRam);
  const imageBusy = useUiStore((s) => s.imageBusy);
  const downloadProgress = useModelDownloadStore((s) => s.progress);
  const downloadLabel = useModelDownloadStore((s) => s.label);
  const mounted = useRef(true);
  const [prompt, setPrompt] = useState(TTI_PROMPTS[0]);
  const [seedText, setSeedText] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const ready = isTextToImageAvailable();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState('');
  // File cache changes when a download/generation finishes, without a new variant.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cached = useMemo(() => hasCachedTextToImage(variant), [variant, downloadKind, busy]);

  const selected = getTtiVariant(variant);
  const working = busy || imageBusy || downloadKind === 'image';
  const scanBusy = isProcessing;
  const blocked = working || scanBusy || (!cached && downloadKind != null);
  const available = ready;
  const loaded = imageInRam || isTextToImageLoaded();
  const meterProgress = busy ? progress : downloadProgress;
  const meterLabel = busy ? label : downloadLabel;

  useEffect(() => {
    mounted.current = true;
    attachImagine();
    return () => {
      mounted.current = false;
      detachImagine();
    };
  }, []);

  function seedValue() {
    const parsed = Number.parseInt(seedText.trim(), 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
  }

  function onProgress(value: number, next: string) {
    if (!mounted.current) {
      return;
    }
    setProgress(value);
    setLabel(next);
  }

  function failMessage(error: unknown) {
    const message = error instanceof Error ? error.message : 'Download failed. Check internet and try again.';
    if (/abort|ECONNABORTED|software caused connection/i.test(message)) {
      return 'Download was interrupted. Tap Save model to resume. Going back does not stop it.';
    }
    return message;
  }

  async function saveModel() {
    if (blocked || !available) {
      return;
    }
    setBusy(true);
    setProgress(0.02);
    setLabel(`Starting ${formatBytes(selected.downloadBytes)} download…`);
    try {
      await downloadTextToImage(variant, onProgress);
      if (!mounted.current) {
        return;
      }
      setToast({ kind: 'success', message: `${selected.modelName} ${selected.label} is on this phone.` });
    } catch (error) {
      if (!mounted.current) {
        return;
      }
      if (error instanceof Error && error.message === TTI_STOPPED) {
        setToast({ kind: 'info', message: 'Download stopped. Tap Save model to try again.' });
        return;
      }
      setToast({ kind: 'error', message: failMessage(error) });
    } finally {
      if (mounted.current) {
        setBusy(false);
        setProgress(0);
        setLabel('');
      }
    }
  }

  async function generate() {
    if (blocked) {
      return;
    }
    if (!available) {
      setToast({ kind: 'error', message: 'Needs the Android development build. Expo Go cannot generate images.' });
      return;
    }
    if (scanBusy) {
      setToast({ kind: 'info', message: 'Wait for Refresh to finish, then generate.' });
      return;
    }
    setBusy(true);
    setProgress(0.02);
    setLabel(cached ? 'Loading the image model…' : `Saving ${formatBytes(selected.downloadBytes)} first…`);
    try {
      const uri = await generateTextToImage(prompt, variant, seedValue(), onProgress);
      if (!mounted.current) {
        return;
      }
      setImageUri(uri);
      setToast({ kind: 'success', message: 'Image saved on this phone.' });
    } catch (error) {
      if (!mounted.current) {
        return;
      }
      const message = error instanceof Error ? error.message : 'Could not generate the image.';
      if (message === TTI_STOPPED) {
        setToast({ kind: 'info', message: 'Stopped. Downloaded files stay on this phone.' });
        return;
      }
      setToast({
        kind: 'error',
        message: message === 'unavailable' ? 'Needs the Android development build.' : failMessage(error),
      });
    } finally {
      if (mounted.current) {
        setBusy(false);
        setProgress(0);
        setLabel('');
      }
    }
  }

  return (
    <ScreenScaffold scroll={false}>
      <View style={[styles.page, { paddingBottom: keyboard > 0 ? keyboard : bottomSafeInset(insets.bottom) }]}>
        <View style={styles.bar}>
          <ScreenBack accessibilityLabel="Go back" />
          <View style={styles.barCopy}>
            <AppText variant="h3">Imagine</AppText>
            <AppText variant="caption">{TTI_MODEL_NAME} · {selected.label} · {formatBytes(selected.downloadBytes)}</AppText>
          </View>
          <View style={styles.liveWrap}>
            <View style={[styles.live, loaded ? styles.liveOn : styles.liveOff]} />
            <AppText style={loaded ? styles.liveOnLabel : styles.liveOffLabel} variant="caption">
              {loaded ? 'In RAM' : cached ? 'On disk' : 'Not saved'}
            </AppText>
          </View>
        </View>

        <View style={styles.canvas}>
          {imageUri ? (
            <Image
              accessibilityLabel="Generated image"
              contentFit="contain"
              source={{ uri: imageUri }}
              style={styles.preview}
            />
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons color={colors.primary[600]} name="image-outline" size={28} />
              </View>
              <AppText variant="labelRegular">No image yet</AppText>
              <AppText style={styles.emptyCopy} variant="bodySmall">
                {cached
                  ? 'Write a prompt, then generate on this phone.'
                  : `Save the ${formatBytes(selected.downloadBytes)} model once, then generate offline.`}
              </AppText>
            </View>
          )}
        </View>

        <View style={styles.card}>
          <TextInput
            accessibilityLabel="Image prompt"
            editable={!blocked}
            multiline
            onChangeText={setPrompt}
            placeholder="Describe the image"
            placeholderTextColor={colors.neutral[500]}
            style={styles.prompt}
            value={prompt}
          />
          <View style={styles.chips}>
            {TTI_PROMPTS.map((item) => (
              <Pressable
                accessibilityRole="button"
                disabled={blocked}
                key={item}
                onPress={() => {
                  setPrompt(item);
                }}
                style={[styles.chip, prompt === item ? styles.chipOn : undefined]}>
                <AppText numberOfLines={1} style={prompt === item ? styles.chipOnLabel : styles.chipLabel} variant="labelSmall">
                  {item}
                </AppText>
              </Pressable>
            ))}
          </View>
          <TextInput
            accessibilityLabel="Optional seed"
            editable={!blocked}
            keyboardType="number-pad"
            onChangeText={setSeedText}
            placeholder="Seed (optional)"
            placeholderTextColor={colors.neutral[500]}
            style={styles.seed}
            value={seedText}
          />
        </View>

        {!ready ? (
          <AppText variant="bodySmall">
            Image generation needs the Android development build. Expo Go cannot run SDXS 512 DreamShaper.
          </AppText>
        ) : null}

        {working ? <ProgressMeter label={meterLabel || 'Working on this phone…'} progress={meterProgress} /> : null}

        <View style={styles.actions}>
          {!cached && !working ? (
            <Pressable
              accessibilityRole="button"
              disabled={blocked || !available}
              onPress={() => {
                void saveModel();
              }}
              style={[styles.secondary, blocked || !available ? styles.disabled : undefined]}>
              <Ionicons color={colors.primary[600]} name="download-outline" size={18} />
              <AppText variant="labelLarge">Save {formatBytes(selected.downloadBytes)}</AppText>
            </Pressable>
          ) : null}
          {working ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Stop download or generation"
              onPress={() => {
                interruptTextToImage();
                setToast({ kind: 'info', message: 'Stopping. Going back does not stop a download.' });
              }}
              style={styles.stop}>
              <Ionicons color={colors.neutral[0]} name="stop" size={16} />
              <AppText style={styles.stopLabel} variant="labelLarge">
                Stop
              </AppText>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={blocked || !prompt.trim()}
              onPress={() => {
                void generate();
              }}
              style={[styles.primary, blocked || !prompt.trim() ? styles.disabled : undefined]}>
              <Ionicons color={colors.neutral[0]} name="sparkles" size={18} />
              <AppText style={styles.primaryLabel} variant="labelLarge">
                Generate
              </AppText>
            </Pressable>
          )}
        </View>
      </View>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    gap: spacing.md,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  barCopy: {
    flex: 1,
    gap: 2,
  },
  liveWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
  },
  live: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  liveOn: {
    backgroundColor: colors.semantic.success,
  },
  liveOff: {
    backgroundColor: colors.semantic.danger,
  },
  liveOnLabel: {
    color: colors.semantic.successDark,
  },
  liveOffLabel: {
    color: colors.neutral[600],
  },
  canvas: {
    flex: 1,
    minHeight: 180,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    overflow: 'hidden',
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['2xl'],
    gap: spacing.sm,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: {
    textAlign: 'center',
    color: colors.neutral[600],
  },
  card: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[0],
  },
  prompt: {
    minHeight: 72,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[50],
    padding: spacing.md,
    color: colors.neutral[900],
    fontSize: 14,
    textAlignVertical: 'top',
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    maxWidth: '100%',
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    backgroundColor: colors.neutral[50],
    justifyContent: 'center',
  },
  chipOn: {
    backgroundColor: colors.primary[50],
    borderColor: colors.primary[500],
  },
  chipLabel: {
    color: colors.neutral[700],
  },
  chipOnLabel: {
    color: colors.primary[600],
  },
  seed: {
    height: 48,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    borderRadius: borderRadius.md,
    backgroundColor: colors.neutral[50],
    paddingHorizontal: spacing.md,
    color: colors.neutral[900],
    fontSize: 14,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primary: {
    flex: 1,
    height: layout.touchTarget,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
    experimental_backgroundImage: gradients.action,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryLabel: {
    color: colors.neutral[0],
  },
  secondary: {
    flex: 1,
    height: layout.touchTarget,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    backgroundColor: colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stop: {
    flex: 1,
    height: layout.touchTarget,
    borderRadius: borderRadius.md,
    backgroundColor: colors.semantic.dangerDark,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  stopLabel: {
    color: colors.neutral[0],
  },
  disabled: {
    backgroundColor: colors.neutral[100],
    experimental_backgroundImage: undefined,
  },
});
