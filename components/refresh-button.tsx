import Ionicons from '@expo/vector-icons/Ionicons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { borderRadius, colors, gradients, spacing } from '@/styles';

type RefreshButtonProps = {
  onPress?: () => void;
  busy?: boolean;
};

export function RefreshButton({ onPress, busy = false }: RefreshButtonProps) {
  function handlePress() {
    if (busy) {
      return;
    }
    if (process.env.EXPO_OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }
    onPress?.();
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Refresh. Scan SMS and Google Calendar or Gmail on this phone"
      accessibilityState={{ busy, disabled: busy }}
      disabled={busy}
      onPress={handlePress}
      style={[styles.button, busy ? styles.busy : undefined]}>
      <View style={styles.iconWrap}>
        <Ionicons color={colors.neutral[0]} name="refresh" size={22} />
      </View>
      <View style={styles.copy}>
        <AppText style={styles.title} variant="labelLarge">
          {busy ? 'Scanning…' : 'Refresh'}
        </AppText>
        <AppText style={styles.hint} variant="caption">
          Scan SMS and Google Calendar / Gmail already on this phone
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderRadius: borderRadius.md,
    experimental_backgroundImage: gradients.refresh,
    backgroundColor: colors.primary[500],
  },
  busy: {
    opacity: 0.7,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  title: {
    color: colors.neutral[0],
  },
  hint: {
    color: 'rgba(219,234,254,0.9)',
  },
});
