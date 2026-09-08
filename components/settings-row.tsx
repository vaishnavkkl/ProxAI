import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { borderRadius, colors, spacing } from '@/styles';

type SettingsRowProps = {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  value: string;
  onPress?: () => void;
  accessory?: ReactNode;
  action?: string;
  expanded?: boolean;
};

export function SettingsRow({ icon, title, value, onPress, accessory, action, expanded }: SettingsRowProps) {
  const body = (
    <Animated.View layout={LinearTransition.duration(180)} style={[styles.row, expanded && styles.expanded]}>
      <View style={[styles.icon, expanded && styles.iconActive]}><Ionicons name={icon} size={21} color={expanded ? colors.neutral[0] : colors.primary[600]} /></View>
      <View style={styles.copy}>
        <View style={styles.titleLine}><AppText variant="labelRegular">{title}</AppText>{expanded ? <Animated.View entering={FadeIn.duration(180)} style={styles.liveDot} /> : null}</View>
        <AppText variant="bodySmall">{value}</AppText>
      </View>
      {action || expanded !== undefined ? (
        <AppText style={styles.action} variant="labelSmall">
          {expanded !== undefined ? (expanded ? 'Close' : 'Edit') : action}
        </AppText>
      ) : null}
      {accessory}
      {onPress ? (
        <Ionicons
          color={colors.primary[500]}
          name={expanded !== undefined ? (expanded ? 'remove' : 'add') : 'chevron-forward'}
          size={20}
        />
      ) : null}
    </Animated.View>
  );

  if (!onPress) {
    return body;
  }

  return (
    <Pressable
      accessibilityHint={action ? `Double tap to ${action.toLowerCase()}` : undefined}
      accessibilityRole="button"
      accessibilityState={expanded !== undefined ? { expanded } : undefined}
      onPress={onPress}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  expanded: { backgroundColor: colors.primary[50], borderColor: colors.primary[100], borderBottomLeftRadius: 0, borderBottomRightRadius: 0, experimental_backgroundImage: 'linear-gradient(120deg, #EFF6FF, #DBEAFE)' },
  icon: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary[50] },
  iconActive: { backgroundColor: colors.primary[600] },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary[500] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[100],
    borderRadius: borderRadius.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    minHeight: 48,
  },
  copy: {
    flex: 1,
    gap: spacing.xs,
  },
  action: {
    color: colors.primary[500],
  },
});
