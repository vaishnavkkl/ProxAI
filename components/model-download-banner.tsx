import { StyleSheet, View } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { stopModelDownload, useModelDownloadStore } from '@/store/model-download-store';
import { colors, spacing } from '@/styles';

/** Kept at the root so navigating away from Settings cannot hide a transfer. */
export function ModelDownloadBanner() {
  const kind = useModelDownloadStore((s) => s.kind);
  const label = useModelDownloadStore((s) => s.label);
  const stopping = useModelDownloadStore((s) => s.stopping);
  const insets = useSafeAreaInsets();
  if (!kind) return null;
  return (
    <View style={[styles.banner, { top: insets.top }]}>
      <AppText numberOfLines={2} variant="caption" style={styles.label}>{label}</AppText>
      <Pressable accessibilityRole="button" accessibilityLabel="Stop model download"
        disabled={stopping} onPress={stopModelDownload} style={styles.stop}>
        <AppText variant="labelRegular">{stopping ? 'Stopping…' : 'Stop download'}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { position: 'absolute', left: 0, right: 0, zIndex: 1000, elevation: 12,
    backgroundColor: colors.primary[50], borderBottomWidth: 1, borderColor: colors.primary[500],
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.md, gap: spacing.sm },
  label: { flex: 1 },
  stop: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.sm },
});
