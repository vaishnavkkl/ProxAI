import { useEffect } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle, useAnimatedValue } from 'react-native';

/** Small decoded asset; animation stays on the native thread while models work. */
export function LogoLoader({ size = 'small', style }: {
  size?: 'small' | 'large' | number; style?: StyleProp<ViewStyle>; color?: string;
}) {
  const rotation = useAnimatedValue(0);
  const pixels = typeof size === 'number' ? size : size === 'large' ? 48 : 24;
  useEffect(() => {
    const animation = Animated.loop(Animated.timing(rotation, {
      toValue: 1, duration: 1400, easing: Easing.linear, useNativeDriver: true, isInteraction: false,
    }));
    animation.start();
    return () => animation.stop();
  }, [rotation]);
  return <Animated.View accessibilityRole="progressbar" accessibilityLabel="Loading" style={style}>
    <Animated.Image source={require('@/assets/images/logo-loading.png')} resizeMode="contain"
      style={{ width: pixels, height: pixels, borderRadius: pixels / 2,
        transform: [{ rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }} />
  </Animated.View>;
}
