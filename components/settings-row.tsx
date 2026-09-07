import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { borderRadius, colors, spacing } from '@/styles';

type SettingsRowProps = {
  title: string;
  value: string;
  onPress?: () => void;
  accessory?: ReactNode;
  action?: string;
  expanded?: boolean;
};

export function SettingsRow({ title, value, onPress, accessory, action, expanded }: SettingsRowProps) {
  const body = (
    <View style={styles.row}>
      <View style={styles.copy}>
        <AppText variant="labelRegular">{title}</AppText>
        <AppText variant="bodySmall">{value}</AppText>
      </View>
      {action ? (
        <AppText style={styles.action} variant="labelSmall">
          {action}
        </AppText>
      ) : null}
      {accessory}
      {onPress ? (
        <Ionicons
          color={colors.primary[500]}
          name={expanded ? 'chevron-down' : 'chevron-forward'}
          size={18}
        />
      ) : null}
    </View>
  );

  if (!onPress) {
    return body;
  }

  return (
    <Pressable
      accessibilityHint={action ? `Double tap to ${action.toLowerCase()}` : undefined}
      accessibilityRole="button"
      onPress={onPress}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
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
