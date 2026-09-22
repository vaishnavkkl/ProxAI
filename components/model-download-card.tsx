import { StyleSheet, View } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';


import { AppText } from '@/components/app-text';
import { ProgressMeter } from '@/components/progress-meter';
import { stopModelDownload, useModelDownloadStore } from '@/store/model-download-store';
import { borderRadius, colors, spacing } from '@/styles';

export function ModelDownloadCard() {
  const kind = useModelDownloadStore((state) => state.kind);
  const progress = useModelDownloadStore((state) => state.progress);
  const label = useModelDownloadStore((state) => state.label);
  const stopping = useModelDownloadStore((state) => state.stopping);
  if (!kind) return null;
  return (
    <View style={styles.card}>
      <AppText variant="labelLarge">{kind === 'image' ? 'Image model download' : 'Language model download'}</AppText>
      <ProgressMeter progress={progress} label={label} />
      <AppText variant="caption">You can keep using chat with a model already on this phone.</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel="Stop model download" disabled={stopping} onPress={stopModelDownload} style={styles.stop}>
        <AppText variant="labelRegular">{stopping ? 'Stopping…' : 'Stop download'}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.sm, borderWidth: 1, borderColor: colors.neutral[200], borderRadius: borderRadius.lg },
  stop: { minHeight: 48, justifyContent: 'center', alignItems: 'center' },
});
