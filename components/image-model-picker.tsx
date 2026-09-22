import { type Href, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';


import { AppText } from '@/components/app-text';
import { ModelDownloadCard } from '@/components/model-download-card';
import { hasCachedTextToImage, removeCachedTextToImage } from '@/services/text-to-image';
import { TTI_MODEL_NAME, TTI_VARIANTS, type TtiVariantId, ttiVariantSupported } from '@/services/text-to-image-catalog';
import { useModelDownloadStore } from '@/store/model-download-store';
import { useSettingsStore } from '@/store/settings-store';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, spacing } from '@/styles';
import { formatBytes } from '@/utils/format-bytes';

type ImageModelPickerProps = {
  onDiskChange?: () => void;
};

export function ImageModelPicker({ onDiskChange }: ImageModelPickerProps) {
  const router = useRouter();
  const processing = useUiStore((s) => s.isProcessing);
  const downloading = useModelDownloadStore((s) => s.kind === 'image');
  const ttiVariantId = useSettingsStore((s) => s.ttiVariantId);
  const setTtiVariantId = useSettingsStore((s) => s.setTtiVariantId);
  const setToast = useUiStore((s) => s.setToast);
  const [diskTick, setDiskTick] = useState(0);

  function refreshDisk() {
    setDiskTick(diskTick + 1);
    onDiskChange?.();
  }

  function selectModel(id: TtiVariantId) {
    if (processing || downloading) {
      return;
    }
    if (!ttiVariantSupported(id)) {
      setToast({ kind: 'info', message: 'This export is not used on this phone.' });
      return;
    }
    setTtiVariantId(id);
    setToast({ kind: 'success', message: `${TTI_MODEL_NAME} ${id === 'coreml' ? 'Core ML' : 'XNNPACK'} selected` });
  }

  function removeModel(id: TtiVariantId) {
    if (processing || downloading) {
      return;
    }
    void removeCachedTextToImage(id).then((removed) => {
      refreshDisk();
      setToast({
        kind: removed > 0 ? 'success' : 'info',
        message: removed > 0 ? `Removed ${removed} image-model files` : 'That image model is not on disk',
      });
    });
  }

  return (
    <View style={styles.block}>
      <ModelDownloadCard />
      <AppText variant="h4">Image models</AppText>
      <AppText variant="bodySmall">
        {TTI_MODEL_NAME} draws 512×512 on this phone. Downloading keeps chat available; generating an image uses the model slot. Select a
        backend, then tap Download in the header. Remove a download to free storage.
      </AppText>
      {TTI_VARIANTS.map((item) => {
        const cached = hasCachedTextToImage(item.id);
        const active = item.id === ttiVariantId;
        const supported = ttiVariantSupported(item.id);
        return (
          <View key={`${item.id}-${diskTick}`} style={[styles.card, active ? styles.cardActive : undefined, !supported ? styles.cardOff : undefined]}>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled: processing || downloading || !supported }}
              disabled={processing || downloading || !supported}
              onPress={() => {
                selectModel(item.id);
              }}>
              <View style={styles.cardTop}>
                <AppText variant="labelRegular">{item.label}</AppText>
                {item.warn ? <AppText style={styles.warnBadge}>Large</AppText> : null}
                {cached ? <AppText style={styles.cached}>On device</AppText> : null}
                {!supported ? <AppText style={styles.warnBadge}>Not this phone</AppText> : null}
              </View>
              <AppText variant="bodySmall">
                {formatBytes(item.downloadBytes)} · {item.ramHint}
              </AppText>
              {active ? <AppText variant="caption">{item.hint}</AppText> : null}
              {active && item.warn ? (
                <AppText style={styles.warn} variant="caption">
                  Large download. Image generation needs a development build, not Expo Go.
                </AppText>
              ) : null}
            </Pressable>
            {cached ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Remove ${item.label} from this phone`}
                disabled={processing || downloading}
                onPress={() => {
                  removeModel(item.id);
                }}
                style={styles.remove}>
                <AppText style={styles.danger} variant="labelSmall">
                  Remove from this phone
                </AppText>
              </Pressable>
            ) : null}
          </View>
        );
      })}
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          router.push('/imagine' as Href);
        }}>
        <AppText style={styles.link} variant="labelSmall">
          Open Imagine
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
  cardOff: {
    opacity: 0.7,
  },
  cardTop: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
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
  remove: {
    minHeight: 48,
    justifyContent: 'center',
  },
  danger: {
    color: colors.semantic.danger,
  },
  link: {
    color: colors.primary[500],
    minHeight: 48,
    textAlignVertical: 'center',
  },
});
