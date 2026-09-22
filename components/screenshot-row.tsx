import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import { AppPressable as Pressable } from '@/components/app-pressable';


import { AppText } from '@/components/app-text';
import type { ScreenshotScan } from '@/services/screenshot-scanner';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, spacing } from '@/styles';
import { ocrTextBlocks } from '@/utils/ocr-blocks';

export function screenshotOcrPreview(text = '') {
  return ocrTextBlocks(text)[0]?.text.replace(/\s+/g, ' ').trim() || text.replace(/\s+/g, ' ').trim();
}

export function ScreenshotRow({ item }: { item: ScreenshotScan }) {
  const preview = screenshotOcrPreview(item.text);
  const captured = new Date(item.capturedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  const detail = item.itemIds.length
    ? `${item.itemIds.length} ${item.itemIds.length === 1 ? 'plan' : 'plans'}`
    : preview
      ? 'OCR saved'
      : 'No text';

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${captured}`}
      onPress={() => {
        useUiStore.getState().setSelectedScreenshotId(item.id);
      }}
      style={styles.row}>
      <Image contentFit="cover" recyclingKey={item.id} source={{ uri: item.uri }} style={styles.thumbnail} />
      <View style={styles.copy}>
        <AppText numberOfLines={2} variant="labelRegular">
          {preview || item.name || 'Screenshot'}
        </AppText>
        <AppText variant="caption">
          {captured} · {detail}
        </AppText>
      </View>
      <Ionicons color={colors.primary[600]} name="chevron-forward" size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 72,
    padding: spacing.md,
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.xl,
  },
  thumbnail: {
    width: 52,
    height: 66,
    borderRadius: 10,
    backgroundColor: colors.primary[50],
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
    minWidth: 0,
  },
});
