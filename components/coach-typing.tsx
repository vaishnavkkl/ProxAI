import { StyleSheet, View } from 'react-native';
import { LogoLoader as ActivityIndicator } from '@/components/logo-loader';


import { AppText } from '@/components/app-text';
import { borderRadius, colors, spacing } from '@/styles';

type CoachTypingProps = {
  label: string;
};

export function CoachTyping({ label }: CoachTypingProps) {
  return (
    <View accessibilityLiveRegion="polite" accessibilityLabel={label || 'Preparing response'} style={styles.wrap}>
      <ActivityIndicator size="small" style={styles.spinner} />
      <AppText style={styles.label} variant="caption">
        {label || 'Preparing response…'}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: 'flex-start',
    maxWidth: '86%',
    backgroundColor: colors.neutral[0],
    borderWidth: 1,
    borderColor: colors.neutral[200],
    borderRadius: borderRadius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.sm,
    minHeight: 56,
  },
  dots: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  spinner: {
    alignSelf: 'flex-start',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary[500],
  },
  dotMid: {
    backgroundColor: colors.primary[600],
  },
  label: {
    color: colors.neutral[600],
  },
});
