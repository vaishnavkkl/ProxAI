import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, StyleSheet, TextInput, View } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';

import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { ExpandableOptions } from '@/components/expandable-options';
import { IMAGINE_SHEET, ImagineGenerating } from '@/components/imagine-generating';
import { ModelRamCaption } from '@/components/model-ram-caption';
import { ProgressMeter } from '@/components/progress-meter';
import { ScreenBack } from '@/components/screen-back';
import { ScreenScaffold } from '@/components/screen-scaffold';
import { useKeyboardInset } from '@/hooks/use-keyboard-inset';
import { saveImagineImage } from '@/services/imagine-save';
import {
  IMAGINE_DETAILS,
  IMAGINE_LOOKS,
  enhanceImaginePrompt,
  hydrateImaginePrompt,
  imagineSuggestions,
  lastImaginePrompt,
  parseImagineSeed,
  randomImagineSeed,
  rememberImaginePrompt,
  type ImagineDetailId,
  type ImagineLookId,
} from '@/services/imagine-prompt';
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
  getTtiVariant,
} from '@/services/text-to-image-catalog';
import { useModelDownloadStore } from '@/store/model-download-store';
import { useSettingsStore } from '@/store/settings-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, gradients, layout, spacing } from '@/styles';
import { formatBytes } from '@/utils/format-bytes';
import { bottomSafeInset } from '@/utils/safe-area';
import { paintFeedback } from '@/utils/paint-feedback';

const PREVIEW_MAX = 320;
const PREVIEW_DEFAULT = 260;
const PREVIEW_KEYBOARD = 144;
const COLLAPSE_RANGE = 128;

export function Imagine({ tab = false }: { tab?: boolean }) {
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardInset();
  const setToast = useUiStore((s) => s.setToast);
  const variant = useSettingsStore((s) => s.ttiVariantId) ?? DEFAULT_TTI_VARIANT;
  const isProcessing = useUiStore((s) => s.isProcessing);
  const downloadKind = useModelDownloadStore((s) => s.kind);
  const imageInRam = useUiStore((s) => s.imageInRam);
  const imageBusy = useUiStore((s) => s.imageBusy);
  const mounted = useRef(true);
  const lastProgressAt = useRef(0);
  const scrollY = useSharedValue(0);
  const keyboardOpen = useSharedValue(0);
  const [prompt, setPrompt] = useState('');
  const [lastPrompt, setLastPrompt] = useState('');
  const [ideaPage, setIdeaPage] = useState(0);
  const [look, setLook] = useState<ImagineLookId | null>(null);
  const [detail, setDetail] = useState<ImagineDetailId | null>(null);
  const [seedText, setSeedText] = useState('');
  const [lastSeed, setLastSeed] = useState<number | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [fullScreen, setFullScreen] = useState(false);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const ready = isTextToImageAvailable();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState('');
  // File cache changes when a download/generation finishes, without a new variant.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cached = useMemo(() => hasCachedTextToImage(variant), [variant, downloadKind, busy]);
  const suggestions = imagineSuggestions(prompt.trim() || lastPrompt, ideaPage);

  const selected = getTtiVariant(variant);
  const generating = imageBusy || (busy && downloadKind !== 'image');
  const working = busy || imageBusy || downloadKind === 'image';
  const scanBusy = isProcessing;
  const blocked = working || scanBusy || (!cached && downloadKind != null);
  const loaded = imageInRam || isTextToImageLoaded();
  const compactPreview = keyboard > 0;

  useEffect(() => {
    keyboardOpen.value = keyboard > 0 ? 1 : 0;
  }, [keyboard, keyboardOpen]);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.value = event.contentOffset.y;
    },
  });

  const previewStyle = useAnimatedStyle(() => {
    if (keyboardOpen.value) {
      return { height: PREVIEW_KEYBOARD };
    }
    return {
      height: interpolate(scrollY.value, [0, COLLAPSE_RANGE], [PREVIEW_MAX, PREVIEW_DEFAULT], Extrapolation.CLAMP),
    };
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!focused) return;
    attachImagine();
    return () => detachImagine();
  }, [focused]);

  useEffect(() => {
    if (!focused) {
      return;
    }
    let cancelled = false;
    void hydrateImaginePrompt().then(() => {
      if (cancelled || !mounted.current) {
        return;
      }
      setLastPrompt(lastImaginePrompt());
    });
    return () => {
      cancelled = true;
    };
  }, [focused]);

  function editPrompt(text: string) {
    setPrompt(text);
    setIdeaPage(0);
  }

  function selectOptions(nextLook: ImagineLookId | null, nextDetail: ImagineDetailId | null) {
    // Options are separate from the draft, so a selection cannot restore old text.
    setLook(nextLook);
    setDetail(nextDetail);
  }

  function onProgress(value: number, next: string) {
    if (!mounted.current) {
      return;
    }
    const now = Date.now();
    if (value < 1 && now - lastProgressAt.current < 250) {
      return;
    }
    lastProgressAt.current = now;
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
    if (blocked || !ready) {
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
    if (!ready) {
      setToast({ kind: 'error', message: 'Needs the Android development build. Expo Go cannot generate images.' });
      return;
    }
    if (scanBusy) {
      setToast({ kind: 'info', message: 'Wait for Refresh to finish, then generate.' });
      return;
    }
    const subject = prompt.trim();
    if (!subject) {
      setToast({ kind: 'info', message: 'Write a short description first.' });
      return;
    }
    const used = parseImagineSeed(seedText) ?? randomImagineSeed();
    const sent = enhanceImaginePrompt(subject, look ?? '', detail ?? '');
    rememberImaginePrompt(subject);
    setLastPrompt(subject);
    setBusy(true);
    setProgress(0.02);
    setLabel(cached ? 'Loading the image model…' : `Saving ${formatBytes(selected.downloadBytes)} first…`);
    try {
      await paintFeedback();
      if (!mounted.current) {
        return;
      }
      const uri = await generateTextToImage(sent, variant, used, onProgress);
      if (!mounted.current) {
        return;
      }
      setImageUri(uri);
      setLastSeed(used);
      setToast({ kind: 'success', message: 'Picture ready. You can save it to Photos.' });
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

  async function downloadImage() {
    if (!imageUri || savingPhoto) {
      return;
    }
    setSavingPhoto(true);
    try {
      await saveImagineImage(imageUri);
      if (mounted.current) {
        setToast({ kind: 'success', message: 'Saved to Photos.' });
      }
    } catch (error) {
      if (mounted.current) {
        setToast({
          kind: 'error',
          message: error instanceof Error ? error.message : 'Could not save the picture.',
        });
      }
    } finally {
      if (mounted.current) {
        setSavingPhoto(false);
      }
    }
  }

  return (
    <ScreenScaffold scroll={false}>
      <View style={[styles.page, { paddingBottom: keyboard > 0 ? keyboard : tab ? 0 : bottomSafeInset(insets.bottom) }]}>
        <View style={styles.bar}>
          {!tab && <ScreenBack accessibilityLabel="Go back" />}
          <View style={styles.barCopy}>
            <AppText variant="h3">Imagine</AppText>
            <AppText variant="caption">
              {TTI_MODEL_NAME} · {selected.label}
            </AppText>
            <ModelRamCaption loadBytes={selected.downloadBytes} loaded={loaded} paused={working} />
          </View>
        </View>

        <Animated.View style={[styles.previewCard, generating ? (compactPreview ? styles.previewSheetCompact : styles.previewSheet) : previewStyle]}>
          {generating ? (
            <ImagineGenerating compact={compactPreview} label={label} progress={progress} />
          ) : imageUri ? (
            <View style={styles.previewHit}>
              <Pressable
                accessibilityLabel="Open generated image full screen"
                accessibilityRole="button"
                onPress={() => {
                  setFullScreen(true);
                }}
                style={styles.previewHit}>
                <Image accessibilityLabel="Generated image" contentFit="contain" source={{ uri: imageUri }} style={styles.preview} />
              </Pressable>
              {lastSeed != null ? (
                <View style={styles.seedBadge}>
                  <AppText style={styles.seedBadgeLabel} variant="caption">
                    Seed {lastSeed}
                  </AppText>
                </View>
              ) : null}
              <Pressable
                accessibilityLabel="Download image to Photos"
                accessibilityRole="button"
                disabled={savingPhoto}
                onPress={() => {
                  void downloadImage();
                }}
                style={styles.downloadBtn}>
                <Ionicons color={colors.neutral[0]} name="download-outline" size={18} />
                <AppText style={styles.downloadLabel} variant="labelSmall">
                  {savingPhoto ? 'Saving' : 'Save'}
                </AppText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons color={colors.primary[600]} name="image-outline" size={22} />
              </View>
              <AppText variant="labelSmall">No image yet</AppText>
              <AppText numberOfLines={compactPreview ? 1 : 2} style={styles.emptyCopy} variant="caption">
                {cached ? 'Describe a picture, then generate on this phone.' : `Save ${formatBytes(selected.downloadBytes)} once, then generate offline.`}
              </AppText>
            </View>
          )}
        </Animated.View>

        <Animated.ScrollView
          contentContainerStyle={styles.scroll}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <AppText variant="labelSmall">Your prompt</AppText>
            <TextInput
              accessibilityLabel="Custom image prompt"
              editable={!blocked}
              multiline
              onChangeText={editPrompt}
              placeholder="Describe the picture in your own words — a place, object, person, or scene."
              placeholderTextColor={colors.neutral[500]}
              style={styles.prompt}
              value={prompt}
            />
          </View>

          <View style={styles.card}>
            <ExpandableOptions title="Idea" icon="bulb-outline">
            <AppText style={styles.hint} variant="caption">{prompt.trim() ? 'Ideas from your current prompt' : lastPrompt ? 'Ideas from your previous prompt' : 'Try a starting idea'}</AppText>
            <View style={styles.chipRow}>
              {suggestions.map((item) => (
                <Pressable
                  accessibilityRole="button"
                  disabled={blocked}
                  key={item.id}
                  onPress={() => {
                    editPrompt(item.prompt);
                  }}
                  style={[styles.chip, prompt === item.prompt ? styles.chipOn : undefined]}>
                  <Ionicons
                    color={prompt === item.prompt ? colors.primary[600] : colors.neutral[700]}
                    name={item.icon}
                    size={16}
                  />
                  <AppText numberOfLines={1} style={prompt === item.prompt ? styles.chipOnLabel : styles.chipLabel} variant="labelSmall">
                    {item.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
            <Pressable accessibilityRole="button" disabled={blocked} onPress={() => setIdeaPage((page) => page + 1)} style={styles.chip}>
              <Ionicons name="refresh-outline" size={16} color={colors.primary[600]} />
              <AppText variant="labelSmall">More ideas</AppText>
            </Pressable>
            </ExpandableOptions>
          </View>

          <View style={styles.card}>
            <ExpandableOptions icon="color-palette-outline" title={look ? `Look · ${IMAGINE_LOOKS.find((item) => item.id === look)?.label}` : 'Look · optional'}>
            <AppText style={styles.hint} variant="caption">Applies when you generate. Your prompt stays unchanged.</AppText>
            <View style={styles.chipRow}>
              {IMAGINE_LOOKS.map((item) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: look === item.id }}
                  disabled={blocked}
                  key={item.id}
                  onPress={() => {
                    selectOptions(look === item.id ? null : item.id, detail);
                  }}
                  style={[styles.chip, look === item.id ? styles.chipOn : undefined]}>
                  <Ionicons color={look === item.id ? colors.primary[600] : colors.neutral[700]} name={item.icon} size={16} />
                  <AppText style={look === item.id ? styles.chipOnLabel : styles.chipLabel} variant="labelSmall">
                    {item.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
            </ExpandableOptions>
          </View>

          <View style={styles.card}>
            <ExpandableOptions icon="options-outline" title={detail ? `Detail · ${IMAGINE_DETAILS.find((item) => item.id === detail)?.label}` : 'Detail · optional'}>
            <View style={styles.chipRow}>
              {IMAGINE_DETAILS.map((item) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: detail === item.id }}
                  disabled={blocked}
                  key={item.id}
                  onPress={() => {
                    selectOptions(look, detail === item.id ? null : item.id);
                  }}
                  style={[styles.chip, detail === item.id ? styles.chipOn : undefined]}>
                  <Ionicons color={detail === item.id ? colors.primary[600] : colors.neutral[700]} name={item.icon} size={16} />
                  <AppText style={detail === item.id ? styles.chipOnLabel : styles.chipLabel} variant="labelSmall">
                    {item.label}
                  </AppText>
                </Pressable>
              ))}
            </View>
            </ExpandableOptions>
          </View>

          <View style={styles.card}>
            <View style={styles.seedTitle}>
              <Ionicons color={colors.neutral[700]} name="key-outline" size={16} />
              <AppText variant="labelSmall">Seed</AppText>
            </View>
            <AppText style={styles.hint} variant="caption">
              A seed is a recipe number for the picture. Same words + same seed = the same picture again. Leave it empty for a new version. Tap Last used to keep a look.
            </AppText>
            <TextInput
              accessibilityLabel="Optional seed"
              editable={!blocked}
              keyboardType="number-pad"
              onChangeText={setSeedText}
              placeholder="Leave empty for a new variation"
              placeholderTextColor={colors.neutral[500]}
              style={styles.seed}
              value={seedText}
            />
            <View style={styles.chipRow}>
              <Pressable
                accessibilityRole="button"
                disabled={blocked}
                onPress={() => {
                  setSeedText('');
                }}
                style={styles.chip}>
                <Ionicons color={colors.neutral[700]} name="shuffle-outline" size={16} />
                <AppText style={styles.chipLabel} variant="labelSmall">
                  Random
                </AppText>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={blocked}
                onPress={() => {
                  setSeedText('42');
                }}
                style={[styles.chip, seedText === '42' ? styles.chipOn : undefined]}>
                <Ionicons color={seedText === '42' ? colors.primary[600] : colors.neutral[700]} name="key-outline" size={16} />
                <AppText style={seedText === '42' ? styles.chipOnLabel : styles.chipLabel} variant="labelSmall">
                  Example 42
                </AppText>
              </Pressable>
              {lastSeed != null ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={blocked}
                  onPress={() => {
                    setSeedText(String(lastSeed));
                  }}
                  style={[styles.chip, seedText === String(lastSeed) ? styles.chipOn : undefined]}>
                  <Ionicons color={seedText === String(lastSeed) ? colors.primary[600] : colors.neutral[700]} name="refresh-outline" size={16} />
                  <AppText style={seedText === String(lastSeed) ? styles.chipOnLabel : styles.chipLabel} variant="labelSmall">
                    Last used {lastSeed}
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          </View>

          {!ready ? (
            <AppText variant="bodySmall">
              Image generation needs the Android development build. Expo Go cannot run SDXS 512 DreamShaper.
            </AppText>
          ) : null}

          {working && !generating ? <ImagineDownloadMeter /> : null}
        </Animated.ScrollView>

        <View style={styles.actions}>
          {!cached && !working ? (
            <Pressable
              accessibilityRole="button"
              disabled={blocked || !ready}
              onPress={() => {
                void saveModel();
              }}
              style={[styles.secondary, blocked || !ready ? styles.disabled : undefined]}>
              <Ionicons color={colors.primary[600]} name="cloud-download-outline" size={18} />
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

      <Modal animationType="fade" onRequestClose={() => setFullScreen(false)} transparent visible={fullScreen && imageUri != null}>
        <View style={styles.fullScreen}>
          <Pressable accessibilityRole="button" onPress={() => setFullScreen(false)} style={styles.fullHit}>
            {imageUri ? <Image contentFit="contain" source={{ uri: imageUri }} style={styles.fullImage} /> : null}
          </Pressable>
          {imageUri ? (
            <Pressable
              accessibilityLabel="Download image to Photos"
              accessibilityRole="button"
              disabled={savingPhoto}
              onPress={() => {
                void downloadImage();
              }}
              style={styles.fullDownload}>
              <Ionicons color={colors.neutral[0]} name="download-outline" size={18} />
              <AppText style={styles.downloadLabel} variant="labelLarge">
                {savingPhoto ? 'Saving' : 'Save to Photos'}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      </Modal>
    </ScreenScaffold>
  );
}

function ImagineDownloadMeter() {
  const progress = useModelDownloadStore((s) => s.progress);
  const label = useModelDownloadStore((s) => s.label);
  return <ProgressMeter label={label || 'Working on this phone…'} progress={progress} />;
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    gap: spacing.sm,
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
  previewCard: {
    borderRadius: borderRadius.lg,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    overflow: 'hidden',
  },
  previewSheet: {
    width: '100%',
    maxWidth: IMAGINE_SHEET,
    maxHeight: IMAGINE_SHEET,
    aspectRatio: 1,
    alignSelf: 'center',
  },
  previewSheetCompact: {
    width: 168,
    maxWidth: 168,
    aspectRatio: 1,
    alignSelf: 'center',
  },
  previewHit: {
    flex: 1,
  },
  preview: {
    width: '100%',
    height: '100%',
  },
  seedBadge: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: 'rgba(31, 41, 55, 0.72)',
  },
  seedBadgeLabel: {
    color: colors.neutral[0],
  },
  downloadBtn: {
    position: 'absolute',
    right: spacing.sm,
    bottom: spacing.sm,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[600],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  downloadLabel: {
    color: colors.neutral[0],
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    gap: spacing.xs,
  },
  emptyIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCopy: {
    textAlign: 'center',
    color: colors.neutral[600],
  },
  scroll: {
    gap: spacing.sm,
    paddingBottom: spacing.sm,
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
  hint: {
    color: colors.neutral[600],
  },
  seedTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    backgroundColor: colors.neutral[50],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
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
  fullScreen: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
  },
  fullHit: {
    flex: 1,
  },
  fullImage: {
    width: '100%',
    height: '100%',
  },
  fullDownload: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: spacing['3xl'],
    minHeight: layout.touchTarget,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary[600],
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});
