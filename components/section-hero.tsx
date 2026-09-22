import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { borderRadius, colors, gradients, spacing } from '@/styles';

export function SectionHero({
  title,
  subtitle,
  icon,
  start,
}: {
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  start?: ReactNode;
}) {
  const iconTile = (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.icon}>
      <Ionicons color={colors.neutral[0]} name={icon} size={25} />
    </View>
  );

  return (
    <View style={styles.hero}>
      {start}
      {start ? null : iconTile}
      <View style={styles.copy}>
        <AppText style={styles.title} variant="h3">
          {title}
        </AppText>
        <AppText style={styles.subtitle} variant="bodySmall">
          {subtitle}
        </AppText>
      </View>
      {start ? iconTile : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
    borderRadius: borderRadius.xl,
    backgroundColor: colors.primary[800],
    experimental_backgroundImage: gradients.hero,
    boxShadow: '0px 6px 16px rgba(30,58,138,0.14)',
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: spacing.xs,
  },
  title: {
    color: colors.neutral[0],
  },
  subtitle: {
    color: colors.primary[100],
  },
});
