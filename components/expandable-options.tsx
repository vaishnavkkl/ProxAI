import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppPressable } from '@/components/app-pressable';
import { AppText } from '@/components/app-text';
import { colors, spacing } from '@/styles';

export function ExpandableOptions({ title, icon, children }: {
  title: string; icon: ComponentProps<typeof Ionicons>['name']; children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.root}>
      <AppPressable accessibilityRole="button" accessibilityState={{ expanded }}
        accessibilityLabel={title} onPress={() => setExpanded((value) => !value)} style={styles.header}>
        <View style={styles.label}>
          <View style={styles.icon}>
            <Ionicons name={icon} color={colors.primary[600]} size={20} />
          </View>
          <AppText variant="labelSmall">{title}</AppText>
        </View>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} color={colors.neutral[600]} size={18} />
      </AppPressable>
      {expanded ? children : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.sm },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primary[50], alignItems: 'center', justifyContent: 'center' },
});
