import { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation, Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';

/** The same counter-rotating brand rings at every loading size. */
export function LogoLoader({ size = 'small', style, color }: {
  size?: 'small' | 'large' | number; style?: StyleProp<ViewStyle>; color?: string;
}) {
  const turn = useSharedValue(0);
  const reducedMotion = useReducedMotion();
  const pixels = typeof size === 'number' ? size : size === 'large' ? 48 : 24;
  const ringSize = pixels * 184 / 264;

  useEffect(() => {
    turn.value = 0;
    if (!reducedMotion) {
      turn.value = withRepeat(withTiming(1, { duration: 2250, easing: Easing.linear }), -1, false);
    }
    return () => cancelAnimation(turn);
  }, [reducedMotion, turn]);

  const leftStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }));
  const rightStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * -360}deg` }] }));

  return (
    <View accessibilityRole="progressbar" accessibilityLabel="Loading" accessibilityState={{ busy: true }} style={style}>
      <View style={{ width: pixels, height: pixels, justifyContent: 'center' }}>
        <View style={{ width: pixels, height: ringSize }}>
          <Animated.Image source={require('@/assets/images/splash-ring-left.png')} resizeMode="contain"
            style={[styles.ring, { width: ringSize, height: ringSize, left: 0, tintColor: color }, leftStyle]} />
          <Animated.Image source={require('@/assets/images/splash-ring-right.png')} resizeMode="contain"
            style={[styles.ring, { width: ringSize, height: ringSize, right: 0, tintColor: color }, rightStyle]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({ ring: { position: 'absolute', top: 0 } });
