import { type Href, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue,
  withDelay, withSequence, withTiming,
} from 'react-native-reanimated';

import { AppText } from '@/components/app-text';
import { colors, spacing } from '@/styles';
import { BRAND_BACKGROUND } from '@/styles/brand';

const SPLASH_HOLD_MS = 3000;

export function Splash() {
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const entrance = useSharedValue(0);
  const turn = useSharedValue(0);
  const wordmark = useSharedValue(0);
  const glow = useSharedValue(0);
  const exit = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      entrance.value = 1;
      wordmark.value = 1;
      glow.value = 0.35;
      return;
    }
    const reveal = Easing.bezier(0.16, 1, 0.3, 1);
    entrance.value = withTiming(1, { duration: 650, easing: reveal });
    // One deliberate revolution, ending in the supplied logo's original pose.
    turn.value = withDelay(100, withTiming(1, { duration: 2250, easing: Easing.bezier(0.45, 0, 0.2, 1) }));
    wordmark.value = withDelay(320, withTiming(1, { duration: 650, easing: reveal }));
    glow.value = withSequence(withTiming(0.9, { duration: 1000 }), withTiming(0.35, { duration: 1350 }));
    exit.value = withDelay(SPLASH_HOLD_MS - 280, withTiming(1, { duration: 280, easing: Easing.inOut(Easing.quad) }));
    return () => {
      for (const value of [entrance, turn, wordmark, glow, exit]) cancelAnimation(value);
    };
  }, [entrance, turn, wordmark, glow, exit, reducedMotion]);

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/home' as Href);
    }, SPLASH_HOLD_MS);

    return () => clearTimeout(timer);
  }, [router]);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: 1 - exit.value,
    transform: [{ scale: 1 + exit.value * 0.025 }],
  }));
  const leftStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [
      { translateX: (1 - entrance.value) * -18 },
      { scale: 0.92 + entrance.value * 0.08 },
      { rotate: `${turn.value * 360}deg` },
    ],
  }));
  const rightStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [
      { translateX: (1 - entrance.value) * 18 },
      { scale: 0.92 + entrance.value * 0.08 },
      { rotate: `${turn.value * -360}deg` },
    ],
  }));
  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmark.value,
    transform: [{ translateY: (1 - wordmark.value) * 12 }],
  }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glow.value,
    transform: [{ scale: 0.94 + glow.value * 0.06 }],
  }));

  return (
    <View
      accessibilityLabel="ProxAI"
      accessibilityRole="image"
      style={styles.root}>
      <StatusBar style="light" />
      <Animated.View style={[styles.brand, contentStyle]}>
        <View style={styles.symbol}>
          <Animated.View pointerEvents="none" style={[styles.glow, glowStyle]} />
          <Animated.View style={[styles.ring, styles.left, leftStyle]}>
            <Image source={require('@/assets/images/splash-ring-left.png')} contentFit="contain" style={styles.artwork} />
          </Animated.View>
          <Animated.View style={[styles.ring, styles.right, rightStyle]}>
            <Image source={require('@/assets/images/splash-ring-right.png')} contentFit="contain" style={styles.artwork} />
          </Animated.View>
        </View>
        <Animated.View style={[styles.copy, wordmarkStyle]}>
          <Image source={require('@/assets/images/splash-wordmark.png')} contentFit="contain" style={styles.wordmark} />
          <AppText style={styles.tagline} variant="bodySmall">
            Organize money and life, on your device
          </AppText>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BRAND_BACKGROUND,
    paddingHorizontal: spacing['2xl'],
  },
  brand: {
    alignItems: 'center',
    gap: 24,
  },
  symbol: { width: 264, height: 184 },
  ring: { position: 'absolute', top: 0, width: 184, height: 184 },
  left: { left: 0 },
  right: { right: 0 },
  artwork: { width: '100%', height: '100%' },
  glow: {
    position: 'absolute', left: 42, top: 8, width: 180, height: 170,
    borderRadius: 90, backgroundColor: 'rgba(37,99,235,0.025)',
    boxShadow: '0px 0px 70px 24px rgba(37,99,235,0.12)',
  },
  copy: {
    alignItems: 'center',
    gap: spacing.lg,
  },
  wordmark: { width: 232, height: 56 },
  tagline: {
    color: colors.primary[100],
    opacity: 0.7,
    textAlign: 'center',
    maxWidth: 264,
  },
});
