import { Pressable, type PressableProps } from 'react-native';

/** Immediate touch feedback, preserving every button's existing resting style. */
export function AppPressable({ style, android_ripple, ...props }: PressableProps) {
  return <Pressable {...props} android_ripple={android_ripple ?? { color: 'rgba(37,99,235,0.16)' }}
    style={(state) => [typeof style === 'function' ? style(state) : style, state.pressed && !props.disabled ? { opacity: 0.7 } : null]} />;
}
