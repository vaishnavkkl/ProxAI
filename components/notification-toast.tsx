import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { useUiStore } from '@/store/ui-store';
import { borderRadius, colors, spacing } from '@/styles';

const TOAST_MS = 3200;

export function NotificationToast() {
  const insets = useSafeAreaInsets();
  const toast = useUiStore((s) => s.toast);
  const clearToast = useUiStore((s) => s.clearToast);

  useEffect(() => {
    if (!toast || toast.kind === 'info') {
      return;
    }

    const timer = setTimeout(() => {
      clearToast();
    }, TOAST_MS);

    return () => clearTimeout(timer);
  }, [toast, clearToast]);

  if (!toast) {
    return null;
  }

  const background =
    toast.kind === 'success'
      ? colors.semantic.successLight
      : toast.kind === 'error'
        ? colors.semantic.dangerLight
        : colors.semantic.infoLight;

  return (
    <Pressable
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      onPress={clearToast}
      style={[styles.wrap, { top: insets.top + spacing.sm }]}>
      <View style={[styles.card, { backgroundColor: background }]}>
        <AppText variant="labelRegular">{toast.message}</AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 20,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
});
