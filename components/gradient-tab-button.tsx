import { type BottomTabBarButtonProps } from 'expo-router/js-tabs';
import { PlatformPressable } from 'expo-router/react-navigation';
import * as Haptics from 'expo-haptics';
import { StyleSheet, View } from 'react-native';

import { borderRadius, gradients, layout, spacing } from '@/styles';

export function GradientTabButton({
  children,
  onPressIn,
  style,
  ...props
}: BottomTabBarButtonProps) {
  const selected = props.accessibilityState?.selected === true;

  return (
    <PlatformPressable
      {...props}
      onPressIn={(event) => {
        if (process.env.EXPO_OS !== 'web') {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
        onPressIn?.(event);
      }}
      style={[style, styles.pressable]}>
      <View style={[styles.item, selected ? styles.itemActive : styles.itemIdle]}>{children}</View>
    </PlatformPressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
  },
  item: {
    minWidth: layout.touchTarget,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  itemActive: {
    experimental_backgroundImage: gradients.tabItemActive,
  },
  itemIdle: {
    experimental_backgroundImage: gradients.tabItemIdle,
  },
});
