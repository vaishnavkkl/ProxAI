import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppDialog, type DialogAction } from '@/components/app-dialog';
import { AppText } from '@/components/app-text';
import { MemoryUsageCard } from '@/components/memory-usage-card';
import { ProgressMeter } from '@/components/progress-meter';
import { freeAppMemory } from '@/services/app-memory';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, layout, spacing } from '@/styles';
import { bottomSafeInset } from '@/utils/safe-area';

export function Processing() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isProcessing = useUiStore((s) => s.isProcessing);
  const workKind = useUiStore((s) => s.workKind);
  const llmProgress = useUiStore((s) => s.llmProgress);
  const llmLabel = useUiStore((s) => s.llmLabel);
  const memoryModelMb = useUiStore((s) => s.memoryModelMb);
  const memoryUsedMb = useUiStore((s) => s.memoryUsedMb);
  const memoryAvailMb = useUiStore((s) => s.memoryAvailMb);
  const memoryTotalMb = useUiStore((s) => s.memoryTotalMb);
  const memoryDiskMb = useUiStore((s) => s.memoryDiskMb);
  const memorySamples = useUiStore((s) => s.memorySamples);
  const memoryDeviceUsedMb = useUiStore((s) => s.memoryDeviceUsedMb);
  const memoryDeviceTotalMb = useUiStore((s) => s.memoryDeviceTotalMb);
  const memoryDeviceSamples = useUiStore((s) => s.memoryDeviceSamples);
  const modelInRam = useUiStore((s) => s.modelInRam);
  const imageInRam = useUiStore((s) => s.imageInRam);
  const imageBusy = useUiStore((s) => s.imageBusy);
  const setToast = useUiStore((s) => s.setToast);
  const [dialog, setDialog] = useState<{ title: string; message: string; actions: DialogAction[] } | null>(null);

  const downloading = workKind === 'download';
  const freeBlocked = isProcessing || imageBusy;
  const title = isProcessing ? (downloading ? 'Downloading model' : 'Working…') : 'App resources';
  const fallback = downloading
    ? 'Saving the on-device model to this phone…'
    : isProcessing
      ? 'Reading messages on this phone…'
      : 'App heap is this process. Device RAM is the whole phone.';
  const slotLine = modelInRam && imageInRam
    ? 'Language model and image model both report RAM. Free memory now — two native models crash this app.'
    : modelInRam
      ? 'Language model (LLM) in RAM. Image generation is unloaded.'
      : imageInRam
        ? 'Image model in RAM. The chat LLM is unloaded.'
        : 'No AI model in RAM. Files on disk stay until you remove them in Settings.';

  function confirmFree() {
    if (freeBlocked) {
      setToast({
        kind: 'info',
        message: imageBusy ? 'Wait for the image to finish, or tap Stop first.' : 'Wait for Refresh or a download to finish.',
      });
      return;
    }
    setDialog({
      title: 'Free this app’s memory?',
      message:
        'Unloads the language model and image generator from RAM and clears this app’s image cache. Other apps keep running. Downloaded models on disk stay.',
      actions: [
        { label: 'Cancel', tone: 'secondary', onPress: () => undefined },
        {
          label: 'Free memory',
          tone: 'primary',
          onPress: () => {
            void freeAppMemory().then((result) => {
              setToast({
                kind: result.ok ? 'success' : 'info',
                message: result.message,
              });
            });
          },
        },
      ],
    });
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.handle} />
      <View style={styles.bar}>
        <AppText style={styles.title} variant="h3">
          {title}
        </AppText>
        <Pressable
          accessibilityLabel="Close status"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={styles.iconBtn}>
          <Ionicons color={colors.neutral[900]} name="close" size={22} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={[styles.body, { paddingBottom: spacing['3xl'] + bottomSafeInset(insets.bottom) }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator
        style={styles.scroll}>
        {isProcessing ? <ProgressMeter progress={llmProgress} label={llmLabel || fallback} /> : (
          <AppText style={styles.copy} variant="bodyRegular">
            {llmLabel || fallback}
          </AppText>
        )}
        <View style={styles.slot}>
          <AppText variant="overline">Native model slot</AppText>
          <AppText variant="labelRegular">{slotLine}</AppText>
          <View style={styles.pills}>
            <View style={[styles.pill, modelInRam ? styles.pillOn : undefined]}>
              <AppText style={modelInRam ? styles.pillOnLabel : styles.pillLabel} variant="labelSmall">LLM {modelInRam ? 'in RAM' : 'unloaded'}</AppText>
            </View>
            <View style={[styles.pill, imageInRam ? styles.pillImage : undefined]}>
              <AppText style={imageInRam ? styles.pillImageLabel : styles.pillLabel} variant="labelSmall">Image {imageInRam ? 'in RAM' : 'unloaded'}</AppText>
            </View>
          </View>
        </View>
        <MemoryUsageCard
          availMb={memoryAvailMb}
          diskMb={memoryDiskMb}
          modelMb={memoryModelMb}
          samples={memorySamples}
          totalMb={memoryTotalMb}
          usedMb={memoryUsedMb}
          deviceSamples={memoryDeviceSamples}
          deviceTotalMb={memoryDeviceTotalMb}
          deviceUsedMb={memoryDeviceUsedMb}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Free this app memory"
          disabled={freeBlocked}
          onPress={confirmFree}
          style={[styles.secondary, freeBlocked ? styles.secondaryOff : undefined]}>
          <AppText variant="labelLarge">Free app memory</AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss processing status"
          onPress={() => router.back()}
          style={styles.button}>
          <AppText style={styles.buttonLabel} variant="labelLarge">
            {isProcessing ? 'Hide' : 'Done'}
          </AppText>
        </Pressable>
      </ScrollView>
      <AppDialog
        visible={dialog != null}
        title={dialog?.title ?? ''}
        message={dialog?.message ?? ''}
        actions={dialog?.actions ?? []}
        onClose={() => {
          setDialog(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.neutral[0],
  },
  scroll: {
    flex: 1,
  },
  body: {
    paddingHorizontal: spacing['2xl'],
    gap: spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.neutral[400],
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing['2xl'],
  },
  title: {
    flex: 1,
  },
  iconBtn: {
    width: layout.touchTarget,
    height: layout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[100],
  },
  copy: {
    textAlign: 'center',
  },
  slot: {
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.neutral[200],
    backgroundColor: colors.neutral[50],
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pill: {
    minHeight: 32,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.neutral[100],
    justifyContent: 'center',
  },
  pillOn: {
    backgroundColor: colors.primary[100],
  },
  pillImage: {
    backgroundColor: colors.secondary[50],
  },
  pillLabel: {
    color: colors.neutral[600],
  },
  pillOnLabel: {
    color: colors.primary[600],
  },
  pillImageLabel: {
    color: colors.secondary[600],
  },
  button: {
    height: 48,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: {
    color: colors.neutral[0],
  },
  secondary: {
    height: 48,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.neutral[400],
    backgroundColor: colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryOff: {
    backgroundColor: colors.neutral[50],
    borderColor: colors.neutral[200],
  },
});
