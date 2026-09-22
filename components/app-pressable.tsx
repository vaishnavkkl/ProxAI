import { Pressable, type PressableProps } from 'react-native';

/** Subtle feedback without an Android ripple over the component's bounds. */
export function AppPressable({ style, android_ripple, ...props }: PressableProps) {
  return <Pressable {...props} android_ripple={android_ripple ?? { color: 'transparent' }}
    style={(state) => [typeof style === 'function' ? style(state) : style, state.pressed && !props.disabled ? { opacity: 0.92 } : null]} />;
}
