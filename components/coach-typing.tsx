import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { borderRadius, colors, spacing } from '@/styles';

type CoachTypingProps = {
  label: string;
};

export function CoachTyping({ label }: CoachTypingProps) {
  const pulse = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 420, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.35, duration: 420, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [pulse]);

  return (
    <View style={styles.wrap}>
      <View style={styles.dots}>
        <Animated.View style={[styles.dot, { opacity: pulse }]} />
        <Animated.View style={[styles.dot, styles.dotMid, { opacity: pulse }]} />
        <Animated.View style={[styles.dot, { opacity: pulse }]} />
      </View>
      <AppText style={styles.label} variant="caption">
        {label || 'Writing a review…'}
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
