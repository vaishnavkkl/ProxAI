import { type Href, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { colors, gradients, spacing } from '@/styles';

const SPLASH_HOLD_MS = 1200;

export function Splash() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/home' as Href);
    }, SPLASH_HOLD_MS);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <View
      accessibilityLabel="ProxAI"
      accessibilityRole="image"
      style={styles.root}>
      <Animated.View entering={ZoomIn.duration(400)} style={styles.mark}>
        <AppText style={styles.markText} variant="h2">
          PX
        </AppText>
      </Animated.View>
      <Animated.View entering={FadeInDown.delay(120).duration(360)}>
        <AppText style={styles.title} variant="h1">
          ProxAI
        </AppText>
      </Animated.View>
      <Animated.View entering={FadeIn.delay(280).duration(360)}>
        <AppText style={styles.tagline} variant="bodyRegular">
          Organize money and life, on your device
        </AppText>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary[800],
    experimental_backgroundImage: gradients.hero,
    paddingHorizontal: spacing['2xl'],
    gap: spacing.md,
  },
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 88,
    height: 88,
    borderRadius: 16,
    backgroundColor: colors.neutral[0],
    marginBottom: spacing.sm,
  },
  markText: {
    color: colors.primary[500],
  },
  title: {
    color: colors.neutral[0],
    textAlign: 'center',
  },
  tagline: {
    color: colors.primary[100],
    textAlign: 'center',
  },
});
